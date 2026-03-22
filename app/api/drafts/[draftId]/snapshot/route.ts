import { NextResponse } from "next/server";
import type { ResumeDocument } from "@/lib/document/resume-document";
import { generateSnapshotForDraft, saveSnapshotDocument } from "@/lib/services/snapshot/snapshot-service";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      draftId: string;
    }>;
  }
) {
  const { draftId } = await context.params;

  try {
    const snapshot = await generateSnapshotForDraft(draftId);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown snapshot generation error." },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      draftId: string;
    }>;
  }
) {
  const { draftId } = await context.params;
  const payload = (await request.json()) as { document?: ResumeDocument };

  if (!payload.document) {
    return NextResponse.json({ error: "Missing snapshot document." }, { status: 400 });
  }

  try {
    await saveSnapshotDocument(draftId, payload.document);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown snapshot save error." },
      { status: 400 }
    );
  }
}
