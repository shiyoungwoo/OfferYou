import { NextResponse } from "next/server";
import { getDefaultUserContext } from "@/lib/default-user";
import { readSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import { renderResumeDocumentHtml } from "@/lib/services/export/preview-renderer";
import { renderPdfFromHtml } from "@/lib/services/export/pdf-export-service";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      draftId: string;
    }>;
  }
) {
  const { draftId } = await context.params;
  const snapshot = await readSnapshotForDraft(draftId);

  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
  }

  try {
    const html = renderResumeDocumentHtml(snapshot);
    const { userId } = getDefaultUserContext();
    const result = await renderPdfFromHtml({
      userId,
      draftId,
      html
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown PDF export error." },
      { status: 500 }
    );
  }
}
