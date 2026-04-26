import type { ResumeDocument } from "@/lib/document/resume-document";
import { getDefaultUserContext } from "@/lib/default-user";
import { createApplicationRecord } from "@/lib/services/applications/application-record-service";
import { renderPdfFromHtml } from "@/lib/services/export/pdf-export-service";
import { buildResumePdfFilename, renderResumeDocumentHtml } from "@/lib/services/export/preview-renderer";
import { readSnapshotForDraft, saveSnapshotDocument } from "@/lib/services/snapshot/snapshot-service";

export type ExportResumeDocumentInput = {
  draftId: string;
  document?: ResumeDocument;
};

export async function exportResumeDocumentForDraft(input: ExportResumeDocumentInput) {
  const snapshot = input.document ?? (await readSnapshotForDraft(input.draftId));

  if (!snapshot) {
    throw new Error("Snapshot not found.");
  }

  if (input.document) {
    await saveSnapshotDocument(input.draftId, input.document);
  }

  const html = renderResumeDocumentHtml(snapshot);
  const { userId } = getDefaultUserContext();
  const result = await renderPdfFromHtml({
    userId,
    draftId: input.draftId,
    html,
    filename: buildResumePdfFilename(snapshot)
  });

  const record = await createApplicationRecord({
    draftId: input.draftId,
    exportStoragePath: result.storagePath
  });

  return {
    ...result,
    recordId: record.id,
    recordPath: `/applications/${input.draftId}/record`
  };
}
