import { NextResponse } from "next/server";
import type { ResumeDocument } from "@/lib/document/resume-document";
import { getDefaultUserContext } from "@/lib/default-user";
import { createApplicationRecord } from "@/lib/services/applications/application-record-service";
import { readSnapshotForDraft, saveSnapshotDocument } from "@/lib/services/snapshot/snapshot-service";
import { renderResumeDocumentHtml } from "@/lib/services/export/preview-renderer";
import { renderPdfFromHtml } from "@/lib/services/export/pdf-export-service";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      draftId: string;
    }>;
  }
) {
  const { draftId } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { document?: ResumeDocument };
  const snapshot = payload.document ?? (await readSnapshotForDraft(draftId));

  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
  }

  try {
    if (payload.document) {
      await saveSnapshotDocument(draftId, payload.document);
    }
    const html = renderResumeDocumentHtml(snapshot);
    const { userId } = getDefaultUserContext();
    const result = await renderPdfFromHtml({
      userId,
      draftId,
      html
    });

    const record = await createApplicationRecord({
      draftId,
      exportStoragePath: result.storagePath
    });

    return NextResponse.json({
      ...result,
      recordId: record.id,
      recordPath: `/applications/${draftId}/record`
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown PDF export error." },
      { status: 500 }
    );
  }
}
