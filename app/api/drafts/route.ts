import { NextResponse } from "next/server";
import { createDraft } from "@/lib/services/ingestion/create-draft";
import { createDraftInputSchema } from "@/lib/validation/drafts";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const parsed = createDraftInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const draft = await createDraft(parsed.data);
    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    console.error("[API /drafts] createDraft failed:", error);
    return NextResponse.json(
      { error: "创建草稿失败，请稍后重试。" },
      { status: 500 }
    );
  }
}
