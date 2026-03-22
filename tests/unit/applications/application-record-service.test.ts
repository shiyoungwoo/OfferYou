import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApplicationRecord } from "@/lib/services/applications/application-record-service";
import { saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { generateSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";

let tempDir: string;
let previousCwd: string;

describe("createApplicationRecord", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-record-"));
    process.chdir(tempDir);

    await saveWorkspaceDraft({
      id: "draft-1",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI Product Manager",
      language: "en",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "preview",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: "baseline",
      analysis: {
        fitScore: 81,
        optimizationMode: "baseline_jd_match",
        strengths: ["workflow fit"],
        gaps: ["metrics"],
        riskNotes: ["stay factual"]
      },
      masterFactsUsed: [
        {
          id: "fact-1",
          title: "Workflow instrumentation rollout",
          summary: "Led the post-launch instrumentation rollout for workflow analytics.",
          blockType: "project"
        }
      ],
      suggestions: [
        {
          id: "s1",
          section: "project",
          title: "Accepted",
          beforeText: "Before",
          afterText: "Built AI product workflow",
          reasonText: "Reason",
          status: "accepted",
          sourceKind: "master_fact",
          sourceLabel: "Master fact: Workflow instrumentation rollout",
          revisionRound: 0
        }
      ],
      factSubmissions: []
    });

    await generateSnapshotForDraft("draft-1");
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates a record linked to a draft and snapshot", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    expect(record.company).toBe("OfferYou");
    expect(record.snapshotId).toBe("draft-1-snapshot");
    expect(record.reusedMasterFacts).toHaveLength(1);
    expect(record.reusedMasterFacts[0]?.title).toBe("Workflow instrumentation rollout");
  });
});
