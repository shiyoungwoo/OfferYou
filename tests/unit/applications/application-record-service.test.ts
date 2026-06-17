import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApplicationRecord,
  createManualApplicationRecord,
  deleteApplicationRecord,
  getApplicationRecordDisplayStatus,
  listApplicationRecords,
  updateApplicationRecordInterviewOutcome,
  updateApplicationRecordInterviewPrep,
  updateApplicationRecordInterviewSchedule
} from "@/lib/services/applications/application-record-service";
import { saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { saveSnapshotDocument } from "@/lib/services/snapshot/snapshot-service";
import { executeSql } from "@/lib/db";
import { readApplicationRecord } from "@/lib/services/applications/application-record-service";
import type { ResumeDocument } from "@/lib/document/resume-document";

vi.mock("@/lib/services/export/pdf-export-service", () => ({
  measureResumeHtmlPageCount: vi.fn(async () => 1),
  renderPdfFromHtml: vi.fn()
}));

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

    const snapshot: ResumeDocument = {
      templateKey: "professional-cn",
      header: {
        name: "示例候选人",
        title: "AI 产品经理",
        meta: ["手机：13800000000"]
      },
      sections: []
    };

    await saveSnapshotDocument("draft-1", snapshot);
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
    expect(record.interviewStatus).toBe("none");
    expect(record.interviewPrepId).toBeUndefined();
  });

  it("creates a manual interview source application record without a draft", async () => {
    const record = await createManualApplicationRecord({
      company: "月之暗面",
      jobTitle: "AI 应用产品经理",
      appliedAt: "2026-06-18T02:30:00.000Z"
    });
    const saved = await readApplicationRecord(record.id);

    expect(record.source).toBe("manual_interview");
    expect(record.company).toBe("月之暗面");
    expect(record.jobTitle).toBe("AI 应用产品经理");
    expect(record.draftId).toBe("");
    expect(record.snapshotId).toBe("");
    expect(record.acceptedSuggestionCount).toBe(0);
    expect(saved?.source).toBe("manual_interview");
  });

  it("normalizes older records without interview fields", async () => {
    await executeSql(`
      INSERT INTO application_records (id, draft_id, company, job_title, payload_json, applied_at, created_at)
      VALUES (
        'legacy-record-1',
        'draft-legacy',
        'Legacy Co',
        'Legacy Role',
        '{"id":"legacy-record-1","draftId":"draft-legacy","snapshotId":"draft-legacy-snapshot","company":"Legacy Co","jobTitle":"Legacy Role","appliedAt":"2026-04-23T00:00:00.000Z","acceptedSuggestionCount":2,"reusedMasterFacts":[]}',
        '2026-04-23T00:00:00.000Z',
        CURRENT_TIMESTAMP
      );
    `);

    const record = await readApplicationRecord("legacy-record-1");

    expect(record).not.toBeNull();
    expect(record?.interviewStatus).toBe("none");
    expect(record?.interviewPrepId).toBeUndefined();
  });

  it("returns null for corrupted records and filters them from listings", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    await executeSql(`
      INSERT INTO application_records (id, draft_id, company, job_title, payload_json, applied_at, created_at)
      VALUES (
        'broken-record',
        'draft-1',
        'Broken Co',
        'Broken Role',
        '{"id":',
        '2026-04-23T00:00:00.000Z',
        CURRENT_TIMESTAMP
      );
    `);

    const corrupted = await readApplicationRecord("broken-record");
    const records = await listApplicationRecords();

    expect(corrupted).toBeNull();
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe(record.id);
  });

  it("updates interview prep status on an existing record", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    const updated = await updateApplicationRecordInterviewPrep({
      recordId: record.id,
      interviewPrepId: "interview-record-1",
      interviewStatus: "preparing"
    });

    expect(updated.interviewPrepId).toBe("interview-record-1");
    expect(updated.interviewStatus).toBe("preparing");
  });

  it("schedules an interview on an existing record", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    const updated = await updateApplicationRecordInterviewSchedule({
      recordId: record.id,
      interviewAt: "2026-06-18T02:30:00.000Z",
      interviewRound: "一面",
      interviewNotes: "重点准备业务理解"
    });
    const saved = await readApplicationRecord(record.id);

    expect(updated.interviewStatus).toBe("scheduled");
    expect(updated.interviewAt).toBe("2026-06-18T02:30:00.000Z");
    expect(updated.interviewRound).toBe("一面");
    expect(updated.interviewNotes).toBe("重点准备业务理解");
    expect(saved?.interviewStatus).toBe("scheduled");
    expect(saved?.interviewAt).toBe("2026-06-18T02:30:00.000Z");
  });

  it("derives awaiting-result display status for past interviews that are not finished", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    const scheduled = await updateApplicationRecordInterviewSchedule({
      recordId: record.id,
      interviewAt: "2026-06-11T09:00:00.000Z",
      interviewRound: "一面",
      interviewNotes: "线上会议"
    });

    expect(
      getApplicationRecordDisplayStatus(scheduled, new Date("2026-06-12T00:00:00.000Z"))
    ).toBe("awaiting_result");
    expect(
      getApplicationRecordDisplayStatus(scheduled, new Date("2026-06-10T00:00:00.000Z"))
    ).toBe("scheduled");
  });

  it("records interview outcome and moves next-round time into the schedule", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    await updateApplicationRecordInterviewSchedule({
      recordId: record.id,
      interviewAt: "2026-06-11T09:00:00.000Z",
      interviewRound: "一面",
      interviewNotes: "腾讯会议"
    });

    const updated = await updateApplicationRecordInterviewOutcome({
      recordId: record.id,
      interviewOutcome: "next_round",
      nextInterviewAt: "2026-06-18T09:00:00.000Z",
      interviewFollowUpNotes: "二面准备业务问题"
    });
    const saved = await readApplicationRecord(record.id);
    const { listInterviewSchedules } = await import("@/lib/services/interview/interview-schedule-service");
    const schedules = await listInterviewSchedules();

    expect(updated.interviewStatus).toBe("scheduled");
    expect(saved?.nextInterviewAt).toBe("2026-06-18T09:00:00.000Z");
    expect(saved?.interviewOutcome).toBe("next_round");
    expect(saved?.interviewFollowUpNotes).toBe("二面准备业务问题");
    expect(schedules[0]?.applicationRecordId).toBe(record.id);
    expect(schedules[0]?.interviewAt).toBe("2026-06-18T09:00:00.000Z");
    expect(schedules[0]?.status).toBe("scheduled");
  });

  it("deletes an application record and its linked interview prep", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    await executeSql(`
      INSERT INTO interview_preps (id, application_record_id, payload_json, created_at, updated_at)
      VALUES (
        'prep-to-delete',
        '${record.id}',
        '{"id":"prep-to-delete","applicationRecordId":"${record.id}"}',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `);

    await updateApplicationRecordInterviewPrep({
      recordId: record.id,
      interviewPrepId: "prep-to-delete",
      interviewStatus: "preparing"
    });

    const deleted = await deleteApplicationRecord(record.id);
    const missingRecord = await readApplicationRecord(record.id);
    const records = await listApplicationRecords();

    const prepRows = await executeAndReadPrepCount(record.id);

    expect(deleted).toBe(true);
    expect(missingRecord).toBeNull();
    expect(records).toHaveLength(0);
    expect(prepRows).toBe(0);
  });

  it("returns false when deleting a missing application record", async () => {
    await expect(deleteApplicationRecord("missing-record")).resolves.toBe(false);
  });
});

async function executeAndReadPrepCount(recordId: string) {
  const { querySql } = await import("@/lib/db");
  const rows = await querySql<{ count: number }>(
    `SELECT COUNT(*) as count FROM interview_preps WHERE application_record_id = '${recordId}';`
  );
  return rows[0]?.count ?? 0;
}
