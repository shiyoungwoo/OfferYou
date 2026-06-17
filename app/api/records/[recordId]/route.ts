import { NextResponse } from "next/server";
import { deleteApplicationRecord } from "@/lib/services/applications/application-record-service";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await context.params;
  const deleted = await deleteApplicationRecord(recordId);

  if (!deleted) {
    return NextResponse.json({ error: "未找到投递记录。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
