import { NextResponse } from "next/server";
import { readWorkspaceDraft, saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";

type RouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { draftId } = await context.params;
  const draft = await readWorkspaceDraft(draftId);

  if (!draft) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }

  const body = await request.json();
  const personalInfo = body?.personalInfo;

  if (!personalInfo || typeof personalInfo !== "object") {
    return NextResponse.json({ error: "Missing personalInfo." }, { status: 400 });
  }

  draft.calibratedResume = {
    status: draft.calibratedResume?.status ?? "confirmed",
    entries: draft.calibratedResume?.entries ?? [],
    unclassifiedText: draft.calibratedResume?.unclassifiedText ?? [],
    parseWarnings: draft.calibratedResume?.parseWarnings ?? [],
    modelNotes: draft.calibratedResume?.modelNotes ?? [],
    modelProvider: draft.calibratedResume?.modelProvider,
    updatedAt: new Date().toISOString(),
    personalInfo: {
      ...draft.calibratedResume?.personalInfo,
      name: cleanOptionalString(personalInfo.name),
      phone: cleanOptionalString(personalInfo.phone),
      email: cleanOptionalString(personalInfo.email),
      educationSummary: cleanOptionalString(personalInfo.educationSummary),
      location: cleanOptionalString(personalInfo.location),
      github: cleanOptionalString(personalInfo.github),
      portfolio: cleanOptionalString(personalInfo.portfolio)
    }
  };

  await saveWorkspaceDraft(draft);

  return NextResponse.json({ personalInfo: draft.calibratedResume.personalInfo });
}

function cleanOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
