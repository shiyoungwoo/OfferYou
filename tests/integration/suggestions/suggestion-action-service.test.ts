import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySuggestionAction } from "@/lib/services/analysis/suggestion-action-service";
import { readWorkspaceDraft, saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { generateSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";

vi.mock("@/lib/services/snapshot/snapshot-service", () => ({
  generateSnapshotForDraft: vi.fn().mockResolvedValue({
    draftId: "draft-1",
    templateKey: "professional-cn",
    snapshotPath: "sqlite://snapshots/draft-1",
    pageEstimate: 1,
    document: {
      templateKey: "professional-cn",
      header: {
        name: "OfferYou",
        title: "AI Product Manager",
        meta: []
      },
      sections: []
    }
  })
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

let tempDir: string;
let previousCwd: string;

describe("applySuggestionAction", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-suggestion-action-"));
    process.chdir(tempDir);

    await saveWorkspaceDraft({
      id: "draft-1",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI Product Manager",
      language: "en",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "Need AI workflow product thinking.",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeSourceRef: "manual://resume",
      resumeExtractedText: "Designed workflow systems.",
      analysis: {
        fitScore: 70,
        optimizationMode: "baseline_jd_match",
        strengths: ["workflow fit"],
        gaps: ["metrics"],
        riskNotes: ["stay factual"]
      },
      suggestions: [
        {
          id: "s1",
          section: "project",
          title: "OfferYou founder block",
          beforeText: "Designed workflow systems.",
          afterText: "Designed AI workflow systems.",
          reasonText: "Tie to the JD.",
          status: "pending",
          sourceKind: "master_fact",
          sourceLabel: "Master fact: OfferYou founder block"
        } as any
      ],
      factSubmissions: [],
      masterFactsUsed: []
    });
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates a revision-chain child suggestion when action is revise", async () => {
    const result = await applySuggestionAction({
      draftId: "draft-1",
      action: "revise",
      suggestionId: "s1",
      feedbackType: "too_generic",
      feedbackText: "Make the outcome sharper"
    });

    expect(result.status).toBe("needs_revision");
    expect(result.childSuggestion!.parentSuggestionId).toBe("s1");
    expect(result.childSuggestion!.revisionRound).toBe(1);
    expect(result.childSuggestion!.sourceKind).toBe("revision");
    expect(result.childSuggestion!.sourceLabel).toContain("Master fact");
  });

  it("defaults missing revisionRound to zero before incrementing", async () => {
    const persisted = await readWorkspaceDraft("draft-1");
    expect(persisted?.suggestions[0]?.revisionRound).toBeUndefined();

    const result = await applySuggestionAction({
      draftId: "draft-1",
      action: "revise",
      suggestionId: "s1",
      feedbackType: "too_generic",
      feedbackText: "Make the outcome sharper"
    });

    expect(result.childSuggestion!.revisionRound).toBe(1);
  });

  it("syncs the snapshot when a suggestion is accepted", async () => {
    const result = await applySuggestionAction({
      draftId: "draft-1",
      action: "accept",
      suggestionId: "s1"
    });

    expect(result.status).toBe("accepted");
    expect(result.snapshotSynced).toBe(true);
    expect(vi.mocked(generateSnapshotForDraft)).toHaveBeenCalledWith("draft-1");
  });

  it("blocks accepting failed verification suggestions without manual edits", async () => {
    const persisted = await readWorkspaceDraft("draft-1");
    expect(persisted).not.toBeNull();
    persisted!.suggestions[0]!.verification = { status: "fail", issues: ["事实缺少依据"] };
    await saveWorkspaceDraft(persisted!);

    await expect(
      applySuggestionAction({
        draftId: "draft-1",
        action: "accept",
        suggestionId: "s1"
      })
    ).rejects.toThrow("未通过事实校验");
  });

  it("allows accepting failed verification suggestions when afterText is manually provided", async () => {
    const persisted = await readWorkspaceDraft("draft-1");
    expect(persisted).not.toBeNull();
    persisted!.suggestions[0]!.verification = { status: "fail", issues: ["事实缺少依据"] };
    await saveWorkspaceDraft(persisted!);

    const result = await applySuggestionAction({
      draftId: "draft-1",
      action: "accept",
      suggestionId: "s1",
      afterText: "用户手动确认后的表达"
    });

    expect(result.status).toBe("accepted");
    expect(result.suggestion.acceptedAfterText).toBe("用户手动确认后的表达");
  });

  it("creates a pending fact submission when feedback adds new fact material", async () => {
    const result = await applySuggestionAction({
      draftId: "draft-1",
      action: "revise",
      suggestionId: "s1",
      feedbackType: "adding_new_fact",
      feedbackText: "I also led the post-launch instrumentation rollout."
    });

    expect(result.status).toBe("needs_revision");
    expect(result.childSuggestion!.userFeedbackType).toBe("adding_new_fact");
    const persisted = await readWorkspaceDraft("draft-1");
    expect(persisted?.factSubmissions.length).toBe(1);
    expect(persisted?.factSubmissions[0]?.submissionText).toContain("instrumentation rollout");
  });
});
