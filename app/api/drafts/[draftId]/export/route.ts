import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getStorageRoot } from "@/lib/runtime/storage-root";
import type { ResumeDocument, ResumeTemplateKey } from "@/lib/document/resume-document";
import { exportResumeDocumentForDraft } from "@/lib/services/export/resume-export-service";
import { LocalStorageAdapter } from "@/lib/storage/local-storage-adapter";

function getStorageAdapter() { return new LocalStorageAdapter(getStorageRoot()); }

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

    return NextResponse.json({
      ...result,
      downloadPath: `/api/drafts/${encodeURIComponent(draftId)}/export?path=${encodeURIComponent(result.storagePath)}`
    });
  } catch (error) {
    const status = error instanceof Error && error.message === "Snapshot not found." ? 404 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown PDF export error." }, { status });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const storagePath = url.searchParams.get("path");

  if (!storagePath) {
    return new NextResponse("Missing export path", { status: 400 });
  }

  try {
    getStorageAdapter().assertPathAllowed(storagePath);
    const fileBuffer = await readFile(storagePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"OfferYou_Resume.pdf\""
      }
    });
  } catch {
    return new NextResponse("File not found on disk", { status: 404 });
  }
}
