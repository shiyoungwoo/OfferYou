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
        strengths: ["workflow fit"],
        gaps: ["metrics"],
        riskNotes: ["stay factual"]
      },
      suggestions: [
        {
          id: "s1",
          section: "project",
          title: "Accepted",
          beforeText: "Before",
          afterText: "Built AI product workflow",
          reasonText: "Reason",
          status: "accepted",
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
  });
});
