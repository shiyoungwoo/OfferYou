import type {
  CareerNavigationRecord,
  TalentProfileRecord
} from "@/lib/services/talent/talent-profile-service";
import { findCareerDirectionBySlug } from "@/lib/services/talent/talent-profile-service";

export type CareerLaneCallout = {
  laneLabel: string;
  strengthHint: string;
  riskHint: string;
};

export function getCareerLaneCallout({
  lane,
  talentProfile,
  careerNavigation
}: {
  lane?: string | null;
  talentProfile?: TalentProfileRecord | null;
  careerNavigation?: CareerNavigationRecord | null;
}): CareerLaneCallout | null {
  if (!lane || !careerNavigation) {
    return null;
  }

  const direction = findCareerDirectionBySlug(careerNavigation, lane);

  if (!direction) {
    return null;
  }

  return {
    laneLabel: direction.label,
    strengthHint: talentProfile?.profile.headline ?? direction.rationale,
    riskHint: direction.watchOut
  };
}
