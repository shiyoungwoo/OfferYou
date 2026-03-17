import path from "node:path";
import { randomUUID } from "node:crypto";
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

  const jdAsset = await storageAdapter.put({
    userId,
    kind: "jd_source",
    filename: `${input.company}-${input.jobTitle}.txt`,
    buffer: Buffer.from(input.jdContent),
    mimeType: "text/plain"
  });

  return {
    id: randomUUID(),
    userId,
    company: input.company,
    jobTitle: input.jobTitle,
    language: input.language,
    stage: "analysis_ready",
    status: "created",
    jdPreview: input.jdContent.slice(0, 140),
    jdAsset,
    resumeSourceRef: input.resumeAssetRef,
    resumeExtractedText
  };
}
