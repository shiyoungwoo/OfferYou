import { NextResponse } from "next/server";
import { createDraft } from "@/lib/services/ingestion/create-draft";
import { createDraftInputSchema } from "@/lib/validation/drafts";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = createDraftInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const draft = await createDraft(parsed.data);
  return NextResponse.json(draft, { status: 201 });
}
