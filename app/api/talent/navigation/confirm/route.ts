import { NextResponse } from "next/server";
import { getDefaultUserContext } from "@/lib/default-user";
import { confirmCareerNavigation } from "@/lib/services/talent/talent-profile-service";
import { confirmCareerNavigationInputSchema } from "@/lib/validation/talent";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = confirmCareerNavigationInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userId } = getDefaultUserContext();

  try {
    const navigation = await confirmCareerNavigation({
      userId,
      talentProfileId: parsed.data.talentProfileId
    });

    return NextResponse.json(navigation, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Navigation confirmation failed." },
      { status: 404 }
    );
  }
}
