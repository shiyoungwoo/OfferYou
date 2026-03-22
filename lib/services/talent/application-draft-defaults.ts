import type { CareerNavigationRecord, TalentProfileRecord } from "@/lib/services/talent/talent-profile-service";
import { findCareerDirectionBySlug } from "@/lib/services/talent/talent-profile-service";

export type ApplicationDraftDefaults = {
  jobTitle: string;
  jdContent: string;
  resumeAssetRef: string;
  company: string;
};

const fallbackDefaults: ApplicationDraftDefaults = {
  company: "OfferYou 示例岗位",
  jobTitle: "客户成功经理",
  jdContent:
    "我们希望你能在复杂流程中带着客户往前走，快速建立信任，协调多方，并把模糊需求变成清晰行动。",
  resumeAssetRef: "manual://career-story-notes"
};

export function getApplicationDraftDefaults({
  lane,
  role,
  talentProfile,
  careerNavigation
}: {
  lane?: string | null;
  role?: string | null;
  talentProfile?: TalentProfileRecord | null;
  careerNavigation?: CareerNavigationRecord | null;
}): ApplicationDraftDefaults {
  const direction = lane ? findCareerDirectionBySlug(careerNavigation ?? null, lane) : null;
  const suggestedRole = direction?.suggestedRoles.find((item) => item.title === role) ?? direction?.suggestedRoles[0];

  return {
    company: fallbackDefaults.company,
    jobTitle: suggestedRole?.title ?? role ?? fallbackDefaults.jobTitle,
    jdContent: suggestedRole?.jdHint ?? fallbackDefaults.jdContent,
    resumeAssetRef: talentProfile ? "manual://confirmed-strengths-profile" : fallbackDefaults.resumeAssetRef
  };
}
