import { NextResponse } from "next/server";
import type { ResumeDocument, ResumeTemplateKey } from "@/lib/document/resume-document";
import { exportResumeDocumentForDraft } from "@/lib/services/export/resume-export-service";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      draftId: string;
    }>;
  }
) {
  const { draftId } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as {
    document?: ResumeDocument;
    templateKey?: ResumeTemplateKey;
  };

  try {
    const result = await exportResumeDocumentForDraft({
      draftId,
      document: payload.document,
      templateKey: payload.templateKey
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof Error && error.message === "Snapshot not found." ? 404 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown PDF export error." }, { status });
  }
}
