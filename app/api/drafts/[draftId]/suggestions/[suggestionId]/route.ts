import { NextResponse } from "next/server";
import { applySuggestionAction } from "@/lib/services/analysis/suggestion-action-service";

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
  const payload = (await request.json()) as {
    action: "accept" | "reject" | "revise";
    feedbackType?: "too_generic" | "too_aggressive" | "not_my_style" | "fact_inaccurate" | "wrong_focus" | "adding_new_fact" | "custom";
    feedbackText?: string;
  };

  try {
    const result = await applySuggestionAction({
      draftId,
      suggestionId,
      action: payload.action,
      feedbackType: payload.feedbackType,
      feedbackText: payload.feedbackText
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown suggestion action error." },
      { status: 400 }
    );
  }
}
