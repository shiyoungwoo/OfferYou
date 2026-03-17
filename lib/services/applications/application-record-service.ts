import { randomUUID } from "node:crypto";
import { executeSql, querySql, sqlString } from "@/lib/db";
import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { readSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";

export type ApplicationRecord = {
  id: string;
  draftId: string;
  snapshotId: string;
  company: string;
  jobTitle: string;
  exportStoragePath?: string;
  appliedAt: string;
  acceptedSuggestionCount: number;
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
    appliedAt: new Date().toISOString(),
    acceptedSuggestionCount: draft.suggestions.filter((item) => item.status === "accepted").length
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

  return JSON.parse(rows[0].payload_json) as ApplicationRecord;
}

export async function listApplicationRecords(): Promise<ApplicationRecord[]> {
  const rows = await querySql<{ payload_json: string }>(
    "SELECT payload_json FROM application_records ORDER BY applied_at DESC;"
  );

  return rows.map((row) => JSON.parse(row.payload_json) as ApplicationRecord);
}
