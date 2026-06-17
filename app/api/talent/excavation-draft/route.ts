import { NextResponse } from "next/server";
import { getDefaultUserContext } from "@/lib/default-user";
import {
  deleteTalentExcavationDraft,
  getTalentExcavationDraft,
  saveTalentExcavationDraft
} from "@/lib/services/talent/talent-profile-service";
import type { TalentProfile } from "@/lib/services/talent/talent-profile";
import { talentExcavationDraftInputSchema } from "@/lib/validation/talent";

export async function GET() {
  const { userId } = getDefaultUserContext();
  return NextResponse.json({
    draft: await getTalentExcavationDraft(userId)
  });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = talentExcavationDraftInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userId } = getDefaultUserContext();
  const draft = await saveTalentExcavationDraft({
    userId,
    turns: parsed.data.turns,
    talentManual: parsed.data.talentManual,
    profile: parsed.data.profile as TalentProfile | undefined,
    updatedAt: new Date().toISOString()
  });

  return NextResponse.json({ draft });
}

export async function DELETE() {
  const { userId } = getDefaultUserContext();
  await deleteTalentExcavationDraft(userId);
  return NextResponse.json({ ok: true });
}
