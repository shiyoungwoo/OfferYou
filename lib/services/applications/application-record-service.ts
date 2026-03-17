import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
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

function getRecordsDir() {
  return path.join(process.cwd(), "storage", "application-records");
}

function getRecordPath(recordId: string) {
  return path.join(getRecordsDir(), `${recordId}.json`);
}

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

  await mkdir(getRecordsDir(), { recursive: true });
  await writeFile(getRecordPath(record.id), JSON.stringify(record, null, 2), "utf8");

  return record;
}

export async function readApplicationRecord(recordId: string): Promise<ApplicationRecord | null> {
  try {
    const contents = await readFile(getRecordPath(recordId), "utf8");
    return JSON.parse(contents) as ApplicationRecord;
  } catch {
    return null;
  }
}

export async function listApplicationRecords(): Promise<ApplicationRecord[]> {
  try {
    const files = await readdir(getRecordsDir());
    const records = await Promise.all(
      files.map(async (file) => {
        const contents = await readFile(path.join(getRecordsDir(), file), "utf8");
        return JSON.parse(contents) as ApplicationRecord;
      })
    );

    return records.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  } catch {
    return [];
  }
}
