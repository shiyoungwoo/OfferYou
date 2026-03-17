import { NextResponse } from "next/server";
import { applyFactSubmissionAction } from "@/lib/services/master/fact-submission-service";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      submissionId: string;
    }>;
  }
) {
  const { submissionId } = await context.params;
  const payload = (await request.json()) as {
    action: "confirm" | "reject";
  };

  try {
    const result = await applyFactSubmissionAction({
      submissionId,
      action: payload.action
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown fact submission action error." },
      { status: 400 }
    );
  }
}
