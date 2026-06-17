import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { saveSnapshotDocument } from "@/lib/services/snapshot/snapshot-service";
import { createApplicationRecord, readApplicationRecord } from "@/lib/services/applications/application-record-service";
import {
  createOrUpdateInterviewSchedule,
  listInterviewSchedules
} from "@/lib/services/interview/interview-schedule-service";
import type { ResumeDocument } from "@/lib/document/resume-document";
import { executeSql } from "@/lib/db";

vi.mock("@/lib/services/export/pdf-export-service", () => ({
  measureResumeHtmlPageCount: vi.fn(async () => 1),
  renderPdfFromHtml: vi.fn()
}));

let tempDir: string;
let previousCwd: string;

describe("interview-schedule-service", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-interview-schedule-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates a manual interview schedule with a traceable application record", async () => {
    const schedule = await createOrUpdateInterviewSchedule({
      company: "深势科技",
      jobTitle: "AI 产品经理",
      interviewAt: "2026-06-18T02:30:00.000Z",
      interviewRound: "一面",
      interviewNotes: "重点准备智能体产品经验"
    });

    const schedules = await listInterviewSchedules();
    const record = schedule.applicationRecordId
      ? await readApplicationRecord(schedule.applicationRecordId)
      : null;

    expect(schedule.source).toBe("manual");
    expect(schedule.applicationRecordId).toBeTruthy();
    expect(schedule.company).toBe("深势科技");
    expect(schedule.jobTitle).toBe("AI 产品经理");
    expect(record?.source).toBe("manual_interview");
    expect(record?.interviewStatus).toBe("scheduled");
    expect(record?.interviewAt).toBe("2026-06-18T02:30:00.000Z");
    expect(schedules).toHaveLength(1);
    expect(schedules[0]?.source).toBe("manual");
    expect(schedules[0]?.applicationRecordId).toBe(schedule.applicationRecordId);
  });

  it("links to an application record when one is selected and keeps record status compatible", async () => {
    await seedDraftAndSnapshot();
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    const schedule = await createOrUpdateInterviewSchedule({
      applicationRecordId: record.id,
      interviewAt: "2026-06-19T08:00:00.000Z",
      interviewRound: "二面",
      interviewNotes: "准备业务增长问题"
    });
    const updatedRecord = await readApplicationRecord(record.id);

    expect(schedule.source).toBe("application_record");
    expect(schedule.company).toBe("OfferYou");
    expect(schedule.jobTitle).toBe("AI Product Manager");
    expect(schedule.draftId).toBe("draft-1");
    expect(updatedRecord?.interviewStatus).toBe("scheduled");
    expect(updatedRecord?.interviewAt).toBe("2026-06-19T08:00:00.000Z");
  });

  it("lists manual and linked schedules in interview time order", async () => {
    await seedDraftAndSnapshot();
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    await createOrUpdateInterviewSchedule({
      applicationRecordId: record.id,
      interviewAt: "2026-06-20T08:00:00.000Z"
    });
    await createOrUpdateInterviewSchedule({
      company: "月之暗面",
      jobTitle: "AI 应用产品经理",
      interviewAt: "2026-06-18T08:00:00.000Z"
    });

    const schedules = await listInterviewSchedules();

    expect(schedules.map((item) => item.company)).toEqual(["月之暗面", "OfferYou"]);
    expect(schedules.map((item) => item.source)).toEqual(["manual", "application_record"]);
  });

  it("backfills application records for legacy manual schedules", async () => {
    await executeSql(`
      INSERT INTO interview_schedules (
        id,
        application_record_id,
        user_id,
        company,
        job_title,
        interview_at,
        source,
        status,
        payload_json,
        created_at,
        updated_at
      )
      VALUES (
        'legacy-manual-schedule',
        NULL,
        'default-user',
        '国海证券',
        'AI 产品经理',
        '2026-06-20T08:00:00.000Z',
        'manual',
        'scheduled',
        '{"id":"legacy-manual-schedule","userId":"default-user","company":"国海证券","jobTitle":"AI 产品经理","interviewAt":"2026-06-20T08:00:00.000Z","source":"manual","status":"scheduled","createdAt":"2026-06-10T00:00:00.000Z","updatedAt":"2026-06-10T00:00:00.000Z"}',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `);

    const schedules = await listInterviewSchedules();
    const schedule = schedules.find((item) => item.id === "legacy-manual-schedule");
    const record = schedule?.applicationRecordId
      ? await readApplicationRecord(schedule.applicationRecordId)
      : null;

    expect(schedule?.applicationRecordId).toBeTruthy();
    expect(record?.source).toBe("manual_interview");
    expect(record?.company).toBe("国海证券");
    expect(record?.interviewStatus).toBe("scheduled");
  });
});

async function seedDraftAndSnapshot() {
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
    resumeExtractedText: "baseline",
    analysis: {
      fitScore: 81,
      optimizationMode: "baseline_jd_match",
      strengths: ["workflow fit"],
      gaps: ["metrics"],
      riskNotes: ["stay factual"]
    },
    masterFactsUsed: [],
    suggestions: [],
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
}
