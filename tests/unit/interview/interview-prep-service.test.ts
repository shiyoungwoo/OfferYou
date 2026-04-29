import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { generateSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import { createApplicationRecord } from "@/lib/services/applications/application-record-service";
import { readApplicationRecord } from "@/lib/services/applications/application-record-service";
import {
  createInterviewPrepFromRecord,
  readInterviewPrepForRecord,
  saveInterviewPrep
} from "@/lib/services/interview/interview-prep-service";

let tempDir: string;
let previousCwd: string;

describe("interview-prep-service", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-interview-prep-"));
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
      resumeExtractedText: "吴同学\nai product manager\nwsyoung@example.com",
      analysis: {
        fitScore: 86,
        optimizationMode: "baseline_jd_match",
        strengths: ["能够把混乱的需求梳理成清晰的下一步。"],
        gaps: ["还需要更强的量化表达。"],
        riskNotes: ["保持事实准确"]
      },
      masterFactsUsed: [
        {
          id: "fact-1",
          title: "岗位定制工作流",
          summary: "把岗位定制、确认和导出串成稳定链路。",
          blockType: "project"
        }
      ],
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

  it("creates a prep with questions and a self intro from the application record", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    const prep = await createInterviewPrepFromRecord(record.id);

    expect(prep.applicationRecordId).toBe(record.id);
    expect(prep.company).toBe("OfferYou");
    expect(prep.jobTitle).toBe("AI Product Manager");
    expect(prep.questions.length).toBeGreaterThanOrEqual(5);
    expect(prep.questions.length).toBeLessThanOrEqual(8);
    expect(prep.selfIntroDraft).toContain("OfferYou");
    expect(prep.selfIntroDraft).toContain("AI Product Manager");

    const updatedRecord = await readApplicationRecord(record.id);
    expect(updatedRecord?.interviewPrepId).toBe(prep.id);
    expect(updatedRecord?.interviewStatus).toBe("preparing");
  });

  it("persists question favorites and answer drafts", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    const prep = await createInterviewPrepFromRecord(record.id);
    prep.questions[0] = {
      ...prep.questions[0],
      favorite: true,
      answerDraft: "先用一条事实说明为什么匹配。"
    };
    prep.selfIntroDraft = "我会把真实经历讲清楚。";
    prep.updatedAt = new Date().toISOString();

    await saveInterviewPrep(prep);

    const reloaded = await readInterviewPrepForRecord(record.id);

    expect(reloaded).not.toBeNull();
    expect(reloaded?.questions[0]?.favorite).toBe(true);
    expect(reloaded?.questions[0]?.answerDraft).toContain("事实");
    expect(reloaded?.selfIntroDraft).toContain("真实经历");
  });
});
