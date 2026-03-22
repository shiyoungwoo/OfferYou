import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readWorkspaceDraft, saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { applyFactSubmissionAction } from "@/lib/services/master/fact-submission-service";
import { listMasterFacts } from "@/lib/services/master/master-service";

let tempDir: string;
let previousCwd: string;

describe("applyFactSubmissionAction", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-fact-submission-"));
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
      suggestions: [],
      factSubmissions: [
        {
          id: "submission-1",
          relatedSuggestionId: "s1",
          submissionText: "I also led the post-launch instrumentation rollout for workflow analytics.",
          sourceType: "user_feedback",
          truthConfirmed: false,
          reusableForMaster: false,
          status: "pending_confirmation"
        }
      ]
    });
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes confirmed submissions into the master fact store", async () => {
    const result = await applyFactSubmissionAction({
      submissionId: "submission-1",
      action: "confirm"
    });

    expect(result.status).toBe("confirmed");

    const persistedDraft = await readWorkspaceDraft("draft-1");
    expect(persistedDraft?.factSubmissions[0]?.truthConfirmed).toBe(true);
    expect(persistedDraft?.factSubmissions[0]?.reusableForMaster).toBe(true);

    const facts = await listMasterFacts("default-user");
    expect(facts).toHaveLength(1);
    expect(facts[0]?.summary).toContain("workflow analytics");
  });
});
