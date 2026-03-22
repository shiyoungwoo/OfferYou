import { NextResponse } from "next/server";
import { getDefaultUserContext } from "@/lib/default-user";
import { confirmTalentProfile } from "@/lib/services/talent/talent-profile-service";
import { confirmTalentProfileInputSchema } from "@/lib/validation/talent";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = confirmTalentProfileInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userId } = getDefaultUserContext();
  const profile = await confirmTalentProfile({
    userId,
    answers: parsed.data.answers
  });

  return NextResponse.json(profile, { status: 201 });
}
