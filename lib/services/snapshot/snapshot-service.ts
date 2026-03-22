import { executeSql, querySql, sqlString } from "@/lib/db";
import { composeSnapshotDocument } from "@/lib/services/snapshot/snapshot-composer";
import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import type { ResumeDocument } from "@/lib/document/resume-document";

export async function generateSnapshotForDraft(draftId: string) {
  const draft = await readWorkspaceDraft(draftId);

  if (!draft) {
    throw new Error("Draft not found.");
  }

  const document = await composeSnapshotDocument(draft);
  await saveSnapshotDocument(draftId, document);

  return {
    draftId,
    templateKey: document.templateKey,
    snapshotPath: `sqlite://snapshots/${draftId}`,
    pageEstimate: Math.max(1, Math.ceil(document.sections.reduce((sum, section) => sum + section.items.length, 0) / 6)),
    document
  };
}

export async function readSnapshotForDraft(draftId: string): Promise<ResumeDocument | null> {
  const rows = await querySql<{ payload_json: string }>(
    `SELECT payload_json FROM snapshots WHERE draft_id = ${sqlString(draftId)} LIMIT 1;`
  );

  if (rows.length === 0) {
    return null;
  }

  return JSON.parse(rows[0].payload_json) as ResumeDocument;
}

export async function saveSnapshotDocument(draftId: string, document: ResumeDocument) {
  await executeSql(`
    INSERT INTO snapshots (draft_id, template_key, payload_json, created_at, updated_at)
    VALUES (
      ${sqlString(draftId)},
      ${sqlString(document.templateKey)},
      ${sqlString(JSON.stringify(document))},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(draft_id) DO UPDATE SET
      template_key = excluded.template_key,
      payload_json = excluded.payload_json,
      updated_at = CURRENT_TIMESTAMP;
  `);
}
