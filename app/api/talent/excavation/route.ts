import { NextResponse } from "next/server";
import {
  finalizeTalentExcavation,
  generateTalentExcavationQuestion
} from "@/lib/services/talent/talent-excavation-agent";
import { talentExcavationInputSchema } from "@/lib/validation/talent";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = talentExcavationInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.action === "finalize") {
    try {
      const result = await finalizeTalentExcavation({
        turns: parsed.data.turns
      });
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          error: "模型暂不可用，无法生成深度天赋说明书。",
          detail: error instanceof Error ? error.message : "unknown error"
        },
        { status: 503 }
      );
    }
  }

  const result = await generateTalentExcavationQuestion({
    turns: parsed.data.turns
  });

  return NextResponse.json(result);
}
