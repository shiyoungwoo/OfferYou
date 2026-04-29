import type { CareerNavigationRecord, TalentProfileRecord } from "@/lib/services/talent/talent-profile-service";
import { findCareerDirectionBySlug } from "@/lib/services/talent/talent-profile-service";

export type ApplicationDraftDefaults = {
  jobTitle: string;
  jdContent: string;
  resumeAssetRef: string;
  company: string;
};

const fallbackDefaults: ApplicationDraftDefaults = {
  company: "",
  jobTitle: "",
  jdContent: "",
  resumeAssetRef: ""
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
