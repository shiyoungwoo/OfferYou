import { NextResponse } from "next/server";
import { generateSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      draftId: string;
    }>;
  }
) {
  const { draftId } = await context.params;

  try {
    const snapshot = await generateSnapshotForDraft(draftId);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown snapshot generation error." },
      { status: 400 }
    );
  }
}
