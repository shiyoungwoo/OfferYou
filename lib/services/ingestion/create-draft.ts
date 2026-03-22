import path from "node:path";
import { randomUUID } from "node:crypto";
import { analyzeDraft } from "@/lib/services/analysis/gap-analysis-service";
import { saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { getDefaultUserContext } from "@/lib/default-user";
import { extractTextFromResumeSource } from "@/lib/services/ingestion/extract-text";
import { listMasterFacts } from "@/lib/services/master/master-service";
import {
  findCareerDirectionBySlug,
  getLatestConfirmedCareerNavigationForTalentProfile,
  getLatestConfirmedTalentProfile
} from "@/lib/services/talent/talent-profile-service";
import { LocalStorageAdapter } from "@/lib/storage/local-storage-adapter";
import type { CreateDraftInput } from "@/lib/validation/drafts";

const storageAdapter = new LocalStorageAdapter(path.join(process.cwd(), "storage"));

export async function createDraft(input: CreateDraftInput): Promise<PersistedWorkspaceDraft> {
  const { userId } = getDefaultUserContext();
  const masterFacts = await listMasterFacts(userId);
  const talentProfile = await getLatestConfirmedTalentProfile(userId);
  const careerNavigation = talentProfile
    ? await getLatestConfirmedCareerNavigationForTalentProfile(userId, talentProfile.id)
    : null;
  const selectedCareerDirection =
    careerNavigation && input.careerDirectionSlug
      ? findCareerDirectionBySlug(careerNavigation, input.careerDirectionSlug)
      : null;

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
      text: resumeExtractedText || "Resume content pending richer extraction.",
      sourceKind: "resume_baseline" as const,
      sourceLabel: "Resume baseline"
    },
    ...masterFacts.map((fact) => ({
      title: fact.title,
      section: fact.blockType,
      text: fact.summary,
      sourceKind: "master_fact" as const,
      sourceLabel: `Master fact: ${fact.title}`
    })),
    ...(talentProfile
      ? [
          {
            title: "Confirmed strengths profile",
            section: "summary",
            text: `${talentProfile.profile.headline} ${talentProfile.profile.confidenceNote}`,
            sourceKind: "target_role_fit" as const,
            sourceLabel: "Talent lens"
          }
        ]
      : []),
    ...(selectedCareerDirection
      ? [
          {
            title: `Career direction: ${selectedCareerDirection.label}`,
            section: "summary",
            text: `${selectedCareerDirection.rationale} Watch-out: ${selectedCareerDirection.watchOut}`,
            sourceKind: "target_role_fit" as const,
            sourceLabel: "Career direction lens"
          }
        ]
      : []),
    {
      title: "Target role fit",
      section: "project",
      text: `Applying for ${input.jobTitle} at ${input.company} with an emphasis on truthful role alignment, transferable strengths, and evidence-backed readiness.`,
      sourceKind: "target_role_fit" as const,
      sourceLabel: "Role-fit framing"
    }
  ];

  const analysis = await analyzeDraft({
    jdText: input.jdContent,
    talentProfile: talentProfile
      ? {
          headline: talentProfile.profile.headline,
          confidenceNote: talentProfile.profile.confidenceNote
        }
      : undefined,
    careerDirection: selectedCareerDirection
      ? {
          label: selectedCareerDirection.label,
          rationale: selectedCareerDirection.rationale
        }
      : undefined,
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
    profilePhotoAssetRef: input.profilePhotoAssetRef,
    resumeExtractedText,
    analysis: {
      fitScore: analysis.fitScore,
      optimizationMode: analysis.optimizationMode,
      strengths: analysis.strengths,
      gaps: analysis.gaps,
      riskNotes: analysis.riskNotes
    },
    talentProfileUsed: talentProfile
      ? {
          id: talentProfile.id,
          headline: talentProfile.profile.headline,
          confidenceNote: talentProfile.profile.confidenceNote
        }
      : undefined,
    careerDirectionUsed:
      careerNavigation && selectedCareerDirection
        ? {
            id: careerNavigation.id,
            slug: selectedCareerDirection.slug,
            label: selectedCareerDirection.label,
            rationale: selectedCareerDirection.rationale,
            watchOut: selectedCareerDirection.watchOut
          }
        : undefined,
    masterFactsUsed: masterFacts,
    suggestions: analysis.suggestions,
    factSubmissions: []
  };

  await saveWorkspaceDraft(draft);

  return draft;
}
