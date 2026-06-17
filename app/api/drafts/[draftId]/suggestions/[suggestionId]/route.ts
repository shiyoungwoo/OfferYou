import { z } from "zod";
import { NextResponse } from "next/server";
import { applySuggestionAction } from "@/lib/services/analysis/suggestion-action-service";

const feedbackTypeSchema = z.enum([
  "too_generic", "too_aggressive", "not_my_style", "fact_inaccurate", "wrong_focus", "adding_new_fact", "custom"
]);

const suggestionActionSchema = z.object({
  action: z.enum(["accept", "reject", "revise"]),
  afterText: z.string().max(10_000).optional(),
  reasonText: z.string().max(5_000).optional(),
  feedbackType: feedbackTypeSchema.optional(),
  feedbackText: z.string().max(5_000).optional()
});

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      draftId: string;
      suggestionId: string;
    }>;
  }
) {
  const { draftId, suggestionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const parsed = suggestionActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await applySuggestionAction({
      draftId,
      suggestionId,
      action: parsed.data.action,
      afterText: parsed.data.afterText,
      reasonText: parsed.data.reasonText,
      feedbackType: parsed.data.feedbackType,
      feedbackText: parsed.data.feedbackText
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown suggestion action error.";
    const isNotFound = message.includes("not found");
    console.error(`[API /suggestions] ${isNotFound ? "not found" : "server error"}:`, error);
    return NextResponse.json(
      { error: message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
