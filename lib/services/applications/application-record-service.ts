import { randomUUID } from "node:crypto";
import { executeSql, querySql, sqlString } from "@/lib/db";
import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { readSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import { parseJsonPayload } from "@/lib/services/persistence/json-payload";

export type ApplicationRecord = {
  id: string;
  draftId: string;
  snapshotId: string;
  company: string;
  jobTitle: string;
  exportStoragePath?: string;
  interviewPrepId?: string;
  interviewStatus?: "none" | "preparing" | "scheduled" | "finished";
  appliedAt: string;
  acceptedSuggestionCount: number;
  reusedMasterFacts: Array<{
    id: string;
    title: string;
    summary: string;
    blockType: "summary" | "experience" | "project" | "education" | "skill" | "certificate" | "other";
  }>;
};

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
    company: draft.company,
    jobTitle: draft.jobTitle,
    exportStoragePath: input.exportStoragePath,
    interviewStatus: "none",
    appliedAt: new Date().toISOString(),
    acceptedSuggestionCount: draft.suggestions.filter((item) => item.status === "accepted").length,
    reusedMasterFacts: draft.masterFactsUsed ?? []
  };

  await executeSql(`
    INSERT INTO application_records (id, draft_id, company, job_title, payload_json, applied_at, created_at)
    VALUES (
      ${sqlString(record.id)},
      ${sqlString(record.draftId)},
      ${sqlString(record.company)},
      ${sqlString(record.jobTitle)},
      ${sqlString(JSON.stringify(record))},
      ${sqlString(record.appliedAt)},
      CURRENT_TIMESTAMP
    );
  `);

  return record;
}

export async function readApplicationRecord(recordId: string): Promise<ApplicationRecord | null> {
  const rows = await querySql<{ payload_json: string }>(
    `SELECT payload_json FROM application_records WHERE id = ${sqlString(recordId)} LIMIT 1;`
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

  await executeSql(`
    UPDATE application_records
    SET payload_json = ${sqlString(JSON.stringify(updated))}
    WHERE id = ${sqlString(input.recordId)};
  `);

  return updated;
}

export async function listApplicationRecords(): Promise<ApplicationRecord[]> {
  const rows = await querySql<{ payload_json: string }>(
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

function normalizeApplicationRecord(record: Partial<ApplicationRecord>): ApplicationRecord {
  return {
    id: record.id ?? "",
    draftId: record.draftId ?? "",
    snapshotId: record.snapshotId ?? "",
    company: record.company ?? "",
    jobTitle: record.jobTitle ?? "",
    exportStoragePath: record.exportStoragePath,
    interviewPrepId: record.interviewPrepId,
    interviewStatus: record.interviewStatus ?? "none",
    appliedAt: record.appliedAt ?? "",
    acceptedSuggestionCount: record.acceptedSuggestionCount ?? 0,
    reusedMasterFacts: record.reusedMasterFacts ?? []
  };
}
