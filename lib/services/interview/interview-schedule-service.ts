import { randomUUID } from "node:crypto";
import { executeSqlParams, querySqlParams } from "@/lib/db";
import {
  createManualApplicationRecord,
  listApplicationRecords,
  readApplicationRecord,
  updateApplicationRecordInterviewSchedule
} from "@/lib/services/applications/application-record-service";
import { parseJsonPayload } from "@/lib/services/persistence/json-payload";

export type InterviewScheduleSource = "manual" | "application_record";
export type InterviewScheduleStatus = "scheduled" | "preparing" | "finished";

export type InterviewSchedule = {
  id: string;
  userId: string;
  applicationRecordId?: string;
  draftId?: string;
  company: string;
  jobTitle: string;
  interviewAt: string;
  interviewRound?: string;
  interviewNotes?: string;
  source: InterviewScheduleSource;
  status: InterviewScheduleStatus;
  createdAt: string;
  updatedAt: string;
};

export async function createOrUpdateInterviewSchedule(input: {
  userId?: string;
  applicationRecordId?: string;
  company?: string;
  jobTitle?: string;
  interviewAt: string;
  interviewRound?: string;
  interviewNotes?: string;
}): Promise<InterviewSchedule> {
  const now = new Date().toISOString();
  const interviewAt = normalizeRequired(input.interviewAt, "面试时间不能为空。");
  let record = input.applicationRecordId ? await readApplicationRecord(input.applicationRecordId) : null;

  if (input.applicationRecordId && !record) {
    throw new Error("Application record not found.");
  }

  if (!record) {
    record = await createManualApplicationRecord({
      company: normalizeRequired(input.company, "公司名称不能为空。"),
      jobTitle: normalizeRequired(input.jobTitle, "岗位名称不能为空。"),
      appliedAt: interviewAt
    });
  }

  const company = normalizeRequired(record.company, "公司名称不能为空。");
  const jobTitle = normalizeRequired(record.jobTitle, "岗位名称不能为空。");
  const schedule: InterviewSchedule = {
    id: randomUUID(),
    userId: input.userId ?? "default-user",
    applicationRecordId: record.id,
    draftId: record.draftId || undefined,
    company,
    jobTitle,
    interviewAt,
    interviewRound: normalizeOptional(input.interviewRound),
    interviewNotes: normalizeOptional(input.interviewNotes),
    source: record.source === "manual_interview" ? "manual" : "application_record",
    status: "scheduled",
    createdAt: now,
    updatedAt: now
  };

  await updateApplicationRecordInterviewSchedule({
    recordId: record.id,
    interviewAt,
    interviewRound: input.interviewRound,
    interviewNotes: input.interviewNotes
  });

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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(application_record_id) DO UPDATE SET
       company = excluded.company,
       job_title = excluded.job_title,
       interview_at = excluded.interview_at,
       source = excluded.source,
       status = excluded.status,
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at;`,
    [
      schedule.id,
      schedule.applicationRecordId ?? null,
      schedule.userId,
      schedule.company,
      schedule.jobTitle,
      schedule.interviewAt,
      schedule.source,
      schedule.status,
      JSON.stringify(schedule),
      schedule.createdAt,
      schedule.updatedAt
    ]
  );

  return schedule;
}

export async function listInterviewSchedules(): Promise<InterviewSchedule[]> {
  const rows = await querySqlParams<{ payload_json: string }>(
    "SELECT payload_json FROM interview_schedules ORDER BY interview_at ASC, created_at ASC;"
  );
  const schedules: InterviewSchedule[] = [];
  const linkedRecordIds = new Set<string>();

  for (const row of rows) {
    const parsed = parseJsonPayload<Partial<InterviewSchedule>>(row.payload_json, "面试安排");
    if (parsed.ok) {
      const schedule = await ensureManualScheduleHasApplicationRecord(normalizeInterviewSchedule(parsed.value));
      if (schedule.applicationRecordId) {
        linkedRecordIds.add(schedule.applicationRecordId);
      }
      schedules.push(schedule);
    }
  }

  const records = await listApplicationRecords();
  for (const record of records) {
    const isInterviewRecord = record.interviewStatus === "scheduled" || record.interviewStatus === "preparing";
    if (!isInterviewRecord || linkedRecordIds.has(record.id)) {
      continue;
    }

    schedules.push({
      id: `legacy-${record.id}`,
      userId: "default-user",
      applicationRecordId: record.id,
      draftId: record.draftId,
      company: record.company,
      jobTitle: record.jobTitle,
      interviewAt: record.interviewAt ?? record.appliedAt,
      interviewRound: record.interviewRound,
      interviewNotes: record.interviewNotes,
      source: "application_record",
      status: record.interviewStatus === "preparing" ? "preparing" : "scheduled",
      createdAt: record.appliedAt,
      updatedAt: record.appliedAt
    });
  }

  return schedules.sort((left, right) => {
    const byInterviewAt = left.interviewAt.localeCompare(right.interviewAt);
    return byInterviewAt === 0 ? left.createdAt.localeCompare(right.createdAt) : byInterviewAt;
  });
}

async function ensureManualScheduleHasApplicationRecord(schedule: InterviewSchedule): Promise<InterviewSchedule> {
  if (schedule.source !== "manual" || schedule.applicationRecordId) {
    return schedule;
  }

  const record = await createManualApplicationRecord({
    company: schedule.company,
    jobTitle: schedule.jobTitle,
    appliedAt: schedule.interviewAt || schedule.createdAt || new Date().toISOString()
  });

  await updateApplicationRecordInterviewSchedule({
    recordId: record.id,
    interviewAt: schedule.interviewAt,
    interviewRound: schedule.interviewRound,
    interviewNotes: schedule.interviewNotes
  });

  const updated: InterviewSchedule = {
    ...schedule,
    applicationRecordId: record.id,
    updatedAt: new Date().toISOString()
  };

  await executeSqlParams(
    `UPDATE interview_schedules
     SET application_record_id = ?,
         payload_json = ?,
         updated_at = ?
     WHERE id = ?;`,
    [record.id, JSON.stringify(updated), updated.updatedAt, schedule.id]
  );

  return updated;
}

function normalizeInterviewSchedule(schedule: Partial<InterviewSchedule>): InterviewSchedule {
  return {
    id: schedule.id ?? "",
    userId: schedule.userId ?? "default-user",
    applicationRecordId: schedule.applicationRecordId,
    draftId: schedule.draftId,
    company: schedule.company ?? "",
    jobTitle: schedule.jobTitle ?? "",
    interviewAt: schedule.interviewAt ?? "",
    interviewRound: schedule.interviewRound,
    interviewNotes: schedule.interviewNotes,
    source: schedule.source ?? "manual",
    status: schedule.status ?? "scheduled",
    createdAt: schedule.createdAt ?? "",
    updatedAt: schedule.updatedAt ?? ""
  };
}

function normalizeRequired(value: string | undefined, message: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(message);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
