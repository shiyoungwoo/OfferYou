import type { ResumeDocument } from "@/lib/document/resume-document";
import type { CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";
import { composeSnapshotDocument } from "@/lib/services/snapshot/snapshot-composer";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";

type FinalResumeDraftInput = {
  calibratedResume: CalibratedResumeProfile;
  jdText: string;
  acceptedSuggestions: PersistedWorkspaceDraft["suggestions"];
  company?: string;
  jobTitle?: string;
  resumeExtractedText?: string;
};

export async function generateFinalResumeDraft(input: FinalResumeDraftInput): Promise<ResumeDocument> {
  const syntheticDraft: PersistedWorkspaceDraft = {
    id: "calibrated-final-draft",
    userId: "system",
    company: input.company ?? "OfferYou",
    jobTitle: input.jobTitle ?? "目标岗位",
    language: "zh",
    stage: "analysis_ready",
    status: "created",
    jdPreview: input.jdText,
    jdAsset: {
      storagePath: "/tmp/offeryou-final-resume-jd.txt",
      mimeType: "text/plain",
      originalFilename: "jd.txt"
    },
    resumeExtractedText: input.resumeExtractedText ?? input.calibratedResume.entries.map((entry) => entry.sourceText).join("\n"),
    calibratedResume: input.calibratedResume,
    analysis: {
      fitScore: 0,
      optimizationMode: "baseline_jd_match",
      strengths: [],
      gaps: [],
      riskNotes: []
    },
    suggestions: input.acceptedSuggestions,
    factSubmissions: [],
    masterFactsUsed: []
  };

  return composeSnapshotDocument(syntheticDraft);
}
