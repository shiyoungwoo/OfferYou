import { z } from "zod";
import { NextResponse } from "next/server";
import type { ResumeDocument } from "@/lib/document/resume-document";
import { getDefaultUserContext } from "@/lib/default-user";
import { saveResumeVersionForDraft } from "@/lib/services/resume/resume-version-service";
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
    const message = error instanceof Error ? error.message : "Unknown snapshot generation error.";
    const isNotFound = message.includes("Draft not found");
    console.error(`[API /snapshot POST] ${isNotFound ? "not found" : "server error"}:`, error);
    return NextResponse.json(
      { error: message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}

const patchSnapshotSchema = z.object({
  document: z.record(z.unknown()).refine(
    (d) => typeof d.templateKey === "string",
    { message: "缺少快照文档字段。" }
  )
});

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      draftId: string;
    }>;
  }
) {
  const { draftId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const parsed = patchSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const document = parsed.data.document as unknown as ResumeDocument;
    await saveSnapshotDocument(draftId, document);
    const { userId } = getDefaultUserContext();
    const resumeVersion = await saveResumeVersionForDraft({
      userId,
      draftId,
      document,
      sourceType: "manual_save"
    });
    return NextResponse.json({ ok: true, resumeVersionId: resumeVersion.id });
  } catch (error) {
    console.error("[API /snapshot PATCH] server error:", error);
    return NextResponse.json(
      { error: "快照保存失败，请稍后重试。" },
      { status: 500 }
    );
  }
}
