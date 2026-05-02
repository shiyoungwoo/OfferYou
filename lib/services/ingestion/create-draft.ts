import path from "node:path";
import { randomUUID } from "node:crypto";
import { analyzeDraft } from "@/lib/services/analysis/gap-analysis-service";
import { calibrateResumeStructure } from "@/lib/services/calibration/resume-calibration-service";
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
  const calibratedResume = await calibrateResumeStructure({
    resumeText: resumeExtractedText || input.resumeContent || ""
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
      title: "简历原文",
      section: "summary",
      text: resumeExtractedText || "暂无提取到的简历内容。",
      sourceKind: "resume_baseline" as const,
      sourceLabel: "简历原文"
    },
    ...masterFacts.map((fact) => ({
      title: fact.title,
      section: fact.blockType,
      text: fact.summary,
      sourceKind: "master_fact" as const,
      sourceLabel: `默认事实: ${fact.title}`
    })),
    ...(talentProfile
      ? [
          {
            title: "已确认的优势档案",
            section: "summary",
            text: `${talentProfile.profile.headline} ${talentProfile.profile.confidenceNote}`,
            sourceKind: "target_role_fit" as const,
            sourceLabel: "天赋视角"
          }
        ]
      : []),
    ...(selectedCareerDirection
      ? [
          {
            title: `职业方向: ${selectedCareerDirection.label}`,
            section: "summary",
            text: `${selectedCareerDirection.rationale} 注意事项: ${selectedCareerDirection.watchOut}`,
            sourceKind: "target_role_fit" as const,
            sourceLabel: "职业方向视角"
          }
        ]
      : []),
    {
      title: "目标岗位契合度",
      section: "project",
      text: `正在申请 ${input.company} 的 ${input.jobTitle} 岗位，重点在于真实的岗位匹配、可迁移优势和有证据支撑的胜任力。`,
      sourceKind: "target_role_fit" as const,
      sourceLabel: "岗位适配框架"
    }
  ];

  const analysis = await analyzeDraft({
    company: input.company,
    jobTitle: input.jobTitle,
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
    facts: factSeeds,
    calibratedResume
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
    calibratedResume,
    jdInsight: analysis.jdInsight,
    rewriteStrategy: analysis.rewriteStrategy,
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
