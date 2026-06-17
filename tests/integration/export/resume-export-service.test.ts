import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { generateSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import { exportResumeDocumentForDraft } from "@/lib/services/export/resume-export-service";
import { listApplicationRecords } from "@/lib/services/applications/application-record-service";
import { listResumeVersions } from "@/lib/services/resume/resume-version-service";

let tempDir: string;
let previousCwd: string;

describe("exportResumeDocumentForDraft", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-resume-export-"));
    process.chdir(tempDir);

    await saveWorkspaceDraft({
      id: "draft-1",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI Product Manager",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "preview",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: "王小明\nAI 产品经理\nwsyoung@example.com",
      analysis: {
        fitScore: 88,
        optimizationMode: "baseline_jd_match",
        strengths: ["能把复杂流程整理成稳定链路。"],
        gaps: ["需要更强的表达聚焦。"],
        riskNotes: ["保持事实准确"]
      },
      masterFactsUsed: [],
      suggestions: [
        {
          id: "s1",
          section: "project",
          title: "岗位定制链路",
          beforeText: "Before",
          afterText: "Built a job-apply workflow",
          reasonText: "Reason",
          status: "accepted",
          sourceKind: "master_fact",
          sourceLabel: "默认事实",
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

  it("exports the current resume snapshot without creating an application record", async () => {
    const result = await exportResumeDocumentForDraft({
      draftId: "draft-1"
    });

    const records = await listApplicationRecords();
    const resumeVersions = await listResumeVersions("default-user");

    expect(result.storagePath.endsWith(".pdf")).toBe(true);
    expect(records).toHaveLength(0);
    expect(resumeVersions).toHaveLength(1);
    expect(resumeVersions[0]?.draftId).toBe("draft-1");
    expect(resumeVersions[0]?.sourceType).toBe("pdf_export");
  }, 15000);
});
