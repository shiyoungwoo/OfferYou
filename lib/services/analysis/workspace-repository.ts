import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type PersistedWorkspaceDraft = {
  id: string;
  userId: string;
  company: string;
  jobTitle: string;
  language: string;
  stage: "analysis_ready";
  status: "created";
  jdPreview: string;
  jdAsset: {
    storagePath: string;
    mimeType: string;
    originalFilename: string;
  };
  resumeSourceRef?: string;
  resumeExtractedText: string;
  analysis: {
    fitScore: number;
    strengths: string[];
    gaps: string[];
    riskNotes: string[];
  };
  suggestions: Array<{
    id: string;
    section: string;
    title: string;
    beforeText: string;
    afterText: string;
    reasonText: string;
    status: "pending" | "accepted" | "rejected";
    parentSuggestionId?: string;
    revisionRound: number;
    userFeedbackType?: string;
    userFeedbackText?: string;
  }>;
  factSubmissions: Array<{
    id: string;
    relatedSuggestionId?: string;
    submissionText: string;
    factType?: string;
    sourceType: "user_feedback";
    truthConfirmed: false;
    reusableForMaster: false;
    status: "pending_confirmation" | "confirmed" | "rejected";
  }>;
};

function getDraftPath(draftId: string) {
  return path.join(process.cwd(), "storage", "drafts", `${draftId}.json`);
}

export async function saveWorkspaceDraft(draft: PersistedWorkspaceDraft) {
  const draftPath = getDraftPath(draft.id);
  await mkdir(path.dirname(draftPath), { recursive: true });
  await writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
}

export async function readWorkspaceDraft(draftId: string): Promise<PersistedWorkspaceDraft | null> {
  try {
    const contents = await readFile(getDraftPath(draftId), "utf8");
    return JSON.parse(contents) as PersistedWorkspaceDraft;
  } catch {
    return null;
  }
}
