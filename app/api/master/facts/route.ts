import { NextResponse } from "next/server";
import { getDefaultUserContext } from "@/lib/default-user";
import { createFactInputSchema } from "@/lib/validation/master";
import { createMasterFact, listMasterFacts } from "@/lib/services/master/master-service";

export async function GET() {
  const { userId } = getDefaultUserContext();
  return NextResponse.json({ facts: await listMasterFacts(userId) });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = createFactInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const created = await createMasterFact(parsed.data);
  return NextResponse.json({ fact: created }, { status: 201 });
}
