import path from "node:path";
import { randomUUID } from "node:crypto";
import { analyzeDraft } from "@/lib/services/analysis/gap-analysis-service";
import { saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { getDefaultUserContext } from "@/lib/default-user";
import { extractTextFromResumeSource } from "@/lib/services/ingestion/extract-text";
import { LocalStorageAdapter } from "@/lib/storage/local-storage-adapter";
import type { CreateDraftInput } from "@/lib/validation/drafts";

type DraftRecord = {
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
};

const storageAdapter = new LocalStorageAdapter(path.join(process.cwd(), "storage"));

export async function createDraft(input: CreateDraftInput): Promise<DraftRecord> {
  const { userId } = getDefaultUserContext();

  const resumeExtractedText = await extractTextFromResumeSource({
    content: input.resumeContent,
    rawReference: input.resumeAssetRef
  });

  const draftId = randomUUID();

  const jdAsset = await storageAdapter.put({
    userId,
    kind: "jd_source",
    filename: `${input.company}-${input.jobTitle}-${draftId}.txt`,
    buffer: Buffer.from(input.jdContent),
    mimeType: "text/plain"
  });

  const factSeeds = [
    {
      title: "Resume baseline",
      section: "summary",
      text: resumeExtractedText || "Resume content pending richer extraction."
    },
    {
      title: "Target role fit",
      section: "project",
      text: `Applying for ${input.jobTitle} at ${input.company} with an emphasis on workflow design and AI product execution.`
    }
  ];

  const analysis = await analyzeDraft({
    jdText: input.jdContent,
    facts: factSeeds
  });

  const draft: PersistedWorkspaceDraft = {
    id: draftId,
    userId,
    company: input.company,
    jobTitle: input.jobTitle,
    language: input.language,
    stage: "analysis_ready",
    status: "created",
    jdPreview: input.jdContent.slice(0, 140),
    jdAsset,
    resumeSourceRef: input.resumeAssetRef,
    resumeExtractedText,
    analysis: {
      fitScore: analysis.fitScore,
      strengths: analysis.strengths,
      gaps: analysis.gaps,
      riskNotes: analysis.riskNotes
    },
    suggestions: analysis.suggestions,
    factSubmissions: []
  };

  await saveWorkspaceDraft(draft);

  return draft;
}
