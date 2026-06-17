import { randomUUID } from "node:crypto";
import { executeSqlParams, querySqlParams } from "@/lib/db";
import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { readSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import { parseJsonPayload } from "@/lib/services/persistence/json-payload";

export type ApplicationRecord = {
  id: string;
  draftId: string;
  snapshotId: string;
  source?: "job_apply" | "manual_interview";
  company: string;
  jobTitle: string;
  exportStoragePath?: string;
  interviewPrepId?: string;
  interviewStatus?: "none" | "preparing" | "scheduled" | "finished";
  interviewAt?: string;
  interviewRound?: string;
  interviewNotes?: string;
  interviewOutcome?: "pending" | "passed" | "rejected" | "next_round" | "no_feedback";
  nextInterviewAt?: string;
  interviewFollowUpNotes?: string;
  interviewContextText?: string;
  interviewResearch?: {
    query: string;
    summary: string;
    sources: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
    provider: string;
    researchedAt: string;
    status: "ready" | "failed";
    errorMessage?: string;
  };
  appliedAt: string;
  acceptedSuggestionCount: number;
  reusedMasterFacts: Array<{
    id: string;
    title: string;
    summary: string;
    blockType: "summary" | "experience" | "project" | "education" | "skill" | "certificate" | "other";
  }>;
};

export type ApplicationRecordDisplayStatus =
  | NonNullable<ApplicationRecord["interviewStatus"]>
  | "awaiting_result"
  | "waiting_feedback"
  | "passed_waiting_schedule"
  | "next_round_pending_schedule";

export async function createApplicationRecord(input: {
  draftId: string;
  exportStoragePath?: string;
}) {
  const draft = await readWorkspaceDraft(input.draftId);
  const snapshot = await readSnapshotForDraft(input.draftId);

  if (!draft || !snapshot) {
    throw new Error("Draft or snapshot missing for application record.");
  }

  const record: ApplicationRecord = {
    id: randomUUID(),
    draftId: input.draftId,
    snapshotId: `${input.draftId}-snapshot`,
    source: "job_apply",
    company: draft.company,
    jobTitle: draft.jobTitle,
    exportStoragePath: input.exportStoragePath,
    interviewStatus: "none",
    appliedAt: new Date().toISOString(),
    acceptedSuggestionCount: draft.suggestions.filter((item) => item.status === "accepted").length,
    reusedMasterFacts: draft.masterFactsUsed ?? []
  };

  await executeSqlParams(
    `INSERT INTO application_records (id, draft_id, company, job_title, payload_json, applied_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
    [record.id, record.draftId, record.company, record.jobTitle, JSON.stringify(record), record.appliedAt]
  );

  return record;
}

export async function updateApplicationRecordInterviewContext(input: {
  recordId: string;
  interviewContextText?: string;
  interviewResearch?: ApplicationRecord["interviewResearch"];
}): Promise<ApplicationRecord> {
  const record = await readApplicationRecord(input.recordId);

  if (!record) {
    throw new Error("Application record not found.");
  }

  const updated: ApplicationRecord = {
    ...record,
    interviewContextText: input.interviewContextText?.trim() || undefined,
    interviewResearch: input.interviewResearch ?? record.interviewResearch
  };

  await executeSqlParams(
    "UPDATE application_records SET payload_json = ? WHERE id = ?;",
    [JSON.stringify(updated), input.recordId]
  );

  return updated;
}

async function syncInterviewScheduleAfterOutcomeUpdate(record: ApplicationRecord) {
  const now = new Date().toISOString();
  const nextInterviewAt = record.nextInterviewAt;
  const scheduleStatus = record.interviewStatus === "finished" ? "finished" : "scheduled";
  const rows = await querySqlParams<{ id: string; payload_json: string }>(
    "SELECT id, payload_json FROM interview_schedules WHERE application_record_id = ? LIMIT 1;",
    [record.id]
  );

  if (!nextInterviewAt && rows.length === 0) {
    return;
  }

  if (!nextInterviewAt && rows[0]) {
    const existing = parseJsonPayload<Record<string, unknown>>(rows[0].payload_json, "面试安排");
    const payload = {
      ...(existing.ok ? existing.value : {}),
      status: scheduleStatus,
      updatedAt: now
    };
    await executeSqlParams(
      "UPDATE interview_schedules SET status = ?, payload_json = ?, updated_at = ? WHERE application_record_id = ?;",
      [scheduleStatus, JSON.stringify(payload), now, record.id]
    );
    return;
  }

  if (!nextInterviewAt) {
    return;
  }

  const schedulePayload = rows[0]
    ? parseJsonPayload<Record<string, unknown>>(rows[0].payload_json, "面试安排")
    : null;
  const payload = {
    ...(schedulePayload?.ok ? schedulePayload.value : {}),
    id: rows[0]?.id ?? randomUUID(),
    userId: "default-user",
    applicationRecordId: record.id,
    draftId: record.draftId || undefined,
    company: record.company,
    jobTitle: record.jobTitle,
    interviewAt: nextInterviewAt,
    interviewRound: record.interviewRound,
    interviewNotes: record.interviewNotes,
    source: record.source === "manual_interview" ? "manual" : "application_record",
    status: "scheduled",
    updatedAt: now,
    createdAt: typeof schedulePayload?.ok === "boolean" && schedulePayload.ok && typeof schedulePayload.value.createdAt === "string"
      ? schedulePayload.value.createdAt
      : now
  };

  if (rows[0]) {
    await executeSqlParams(
      `UPDATE interview_schedules
       SET interview_at = ?,
           status = ?,
           payload_json = ?,
           updated_at = ?
      WHERE application_record_id = ?;`,
      [nextInterviewAt, "scheduled", JSON.stringify(payload), now, record.id]
    );
    return;
  }

  await executeSqlParams(
    `INSERT INTO interview_schedules (
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      payload.id,
      record.id,
      "default-user",
      record.company,
      record.jobTitle,
      nextInterviewAt,
      String(payload.source),
      "scheduled",
      JSON.stringify(payload),
      now,
      now
    ]
  );
}

export async function createManualApplicationRecord(input: {
  company: string;
  jobTitle: string;
  appliedAt?: string;
}): Promise<ApplicationRecord> {
  const appliedAt = input.appliedAt ?? new Date().toISOString();
  const record: ApplicationRecord = {
    id: randomUUID(),
    draftId: "",
    snapshotId: "",
    source: "manual_interview",
    company: input.company.trim(),
    jobTitle: input.jobTitle.trim(),
    interviewStatus: "none",
    appliedAt,
    acceptedSuggestionCount: 0,
    reusedMasterFacts: []
  };

  if (!record.company || !record.jobTitle) {
    throw new Error("Company and job title are required for manual application records.");
  }

  await executeSqlParams(
    `INSERT INTO application_records (id, draft_id, company, job_title, payload_json, applied_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
    [record.id, record.draftId, record.company, record.jobTitle, JSON.stringify(record), record.appliedAt]
  );

  return record;
}

export async function readApplicationRecord(recordId: string): Promise<ApplicationRecord | null> {
  const rows = await querySqlParams<{ payload_json: string }>(
    "SELECT payload_json FROM application_records WHERE id = ? LIMIT 1;",
    [recordId]
  );

  if (rows.length === 0) {
    return null;
  }

  const parsed = parseJsonPayload<Partial<ApplicationRecord>>(rows[0].payload_json, "投递记录");
  return parsed.ok ? normalizeApplicationRecord(parsed.value) : null;
}

export async function updateApplicationRecordInterviewPrep(input: {
  recordId: string;
  interviewPrepId: string;
  interviewStatus: NonNullable<ApplicationRecord["interviewStatus"]>;
}): Promise<ApplicationRecord> {
  const record = await readApplicationRecord(input.recordId);

  if (!record) {
    throw new Error("Application record not found.");
  }

  const updated: ApplicationRecord = {
    ...record,
    interviewPrepId: input.interviewPrepId,
    interviewStatus: input.interviewStatus
  };

  await executeSqlParams(
    "UPDATE application_records SET payload_json = ? WHERE id = ?;",
    [JSON.stringify(updated), input.recordId]
  );

  await syncInterviewScheduleAfterOutcomeUpdate(updated);

  return updated;
}

export async function updateApplicationRecordInterviewSchedule(input: {
  recordId: string;
  interviewAt: string;
  interviewRound?: string;
  interviewNotes?: string;
}): Promise<ApplicationRecord> {
  const record = await readApplicationRecord(input.recordId);

  if (!record) {
    throw new Error("Application record not found.");
  }

  const updated: ApplicationRecord = {
    ...record,
    interviewStatus: "scheduled",
    interviewAt: input.interviewAt,
    interviewRound: input.interviewRound?.trim() || undefined,
    interviewNotes: input.interviewNotes?.trim() || undefined
  };

  await executeSqlParams(
    "UPDATE application_records SET payload_json = ? WHERE id = ?;",
    [JSON.stringify(updated), input.recordId]
  );

  return updated;
}

export async function updateApplicationRecordInterviewOutcome(input: {
  recordId: string;
  interviewOutcome?: ApplicationRecord["interviewOutcome"];
  nextInterviewAt?: string;
  interviewFollowUpNotes?: string;
}): Promise<ApplicationRecord> {
  const record = await readApplicationRecord(input.recordId);

  if (!record) {
    throw new Error("Application record not found.");
  }

  const nextInterviewAt = input.nextInterviewAt?.trim() || undefined;
  const outcome = input.interviewOutcome ?? record.interviewOutcome ?? "pending";
  const interviewStatus: NonNullable<ApplicationRecord["interviewStatus"]> = nextInterviewAt
    ? "scheduled"
    : outcome === "rejected" || outcome === "no_feedback"
      ? "finished"
      : "preparing";

  const updated: ApplicationRecord = {
    ...record,
    interviewStatus,
    interviewOutcome: outcome,
    nextInterviewAt,
    interviewFollowUpNotes: input.interviewFollowUpNotes?.trim() || undefined,
    interviewAt: nextInterviewAt ?? record.interviewAt
  };

  await executeSqlParams(
    "UPDATE application_records SET payload_json = ? WHERE id = ?;",
    [JSON.stringify(updated), input.recordId]
  );

  return updated;
}

export async function deleteApplicationRecord(recordId: string): Promise<boolean> {
  const record = await readApplicationRecord(recordId);

  if (!record) {
    return false;
  }

  /* 先删关联面试准备，再删投递记录（两步参数化，避免多语句 executeSql） */
  await executeSqlParams(
    "DELETE FROM interview_preps WHERE application_record_id = ?;",
    [recordId]
  );
  await executeSqlParams(
    "DELETE FROM interview_schedules WHERE application_record_id = ?;",
    [recordId]
  );
  await executeSqlParams(
    "DELETE FROM application_records WHERE id = ?;",
    [recordId]
  );

  return true;
}

export async function listApplicationRecords(): Promise<ApplicationRecord[]> {
  const rows = await querySqlParams<{ payload_json: string }>(
    "SELECT payload_json FROM application_records ORDER BY applied_at DESC;"
  );

  const records: ApplicationRecord[] = [];

  for (const row of rows) {
    const parsed = parseJsonPayload<Partial<ApplicationRecord>>(row.payload_json, "投递记录");
    if (parsed.ok) {
      records.push(normalizeApplicationRecord(parsed.value));
    }
  }

  return records;
}

export function getApplicationRecordDisplayStatus(
  record: ApplicationRecord,
  now = new Date()
): ApplicationRecordDisplayStatus {
  const status = record.interviewStatus ?? "none";

  if (record.interviewOutcome === "rejected" || record.interviewOutcome === "no_feedback") {
    return "finished";
  }

  if (record.nextInterviewAt && isUpcomingInterviewTime(record.nextInterviewAt, now)) {
    return "scheduled";
  }

  if (record.interviewOutcome === "pending") {
    return "waiting_feedback";
  }

  if (record.interviewOutcome === "passed") {
    return "passed_waiting_schedule";
  }

  if (record.interviewOutcome === "next_round") {
    return "next_round_pending_schedule";
  }

  if (status === "finished") {
    return "finished";
  }

  if ((status === "scheduled" || status === "preparing") && isPastInterviewTime(record.interviewAt, now)) {
    return "awaiting_result";
  }

  return status;
}

export function isUpcomingInterviewTime(value: string | undefined, now = new Date()) {
  const date = parseInterviewDate(value);
  return Boolean(date && date.getTime() > now.getTime());
}

export function isPastInterviewTime(value: string | undefined, now = new Date()) {
  const date = parseInterviewDate(value);
  return Boolean(date && date.getTime() < now.getTime());
}

function parseInterviewDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeApplicationRecord(record: Partial<ApplicationRecord>): ApplicationRecord {
  return {
    id: record.id ?? "",
    draftId: record.draftId ?? "",
    snapshotId: record.snapshotId ?? "",
    source: record.source ?? "job_apply",
    company: record.company ?? "",
    jobTitle: record.jobTitle ?? "",
    exportStoragePath: record.exportStoragePath,
    interviewPrepId: record.interviewPrepId,
    interviewStatus: record.interviewStatus ?? "none",
    interviewAt: record.interviewAt,
    interviewRound: record.interviewRound,
    interviewNotes: record.interviewNotes,
    interviewOutcome: record.interviewOutcome,
    nextInterviewAt: record.nextInterviewAt,
    interviewFollowUpNotes: record.interviewFollowUpNotes,
    interviewContextText: record.interviewContextText,
    interviewResearch: record.interviewResearch,
    appliedAt: record.appliedAt ?? "",
    acceptedSuggestionCount: record.acceptedSuggestionCount ?? 0,
    reusedMasterFacts: record.reusedMasterFacts ?? []
  };
}
