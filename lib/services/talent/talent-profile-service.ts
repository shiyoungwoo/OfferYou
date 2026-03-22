import { randomUUID } from "node:crypto";
import { executeSql, querySql, sqlString } from "@/lib/db";
import { buildTalentProfile, type TalentProfile, type TalentPromptAnswers } from "@/lib/services/talent/talent-profile";
import {
  buildCareerNavigation,
  findCareerDirectionBySlug as findCareerDirectionBySlugFromProfile,
  type CareerDirectionSummary,
  type CareerNavigationProfile
} from "@/lib/services/talent/career-navigation";

export type TalentProfileRecord = {
  id: string;
  userId: string;
  status: "confirmed";
  answers: TalentPromptAnswers;
  profile: TalentProfile;
  confirmedAt: string;
};

export type CareerNavigationRecord = {
  id: string;
  userId: string;
  talentProfileId: string;
  status: "confirmed";
  navigation: CareerNavigationProfile;
  confirmedAt: string;
};

export function createTalentProfileDraft(answers: TalentPromptAnswers) {
  return buildTalentProfile(answers);
}

export async function confirmTalentProfile(input: {
  userId: string;
  answers: TalentPromptAnswers;
}): Promise<TalentProfileRecord> {
  const confirmedAt = new Date().toISOString();
  const record: TalentProfileRecord = {
    id: `talent-${randomUUID()}`,
    userId: input.userId,
    status: "confirmed",
    answers: input.answers,
    profile: buildTalentProfile(input.answers),
    confirmedAt
  };

  await executeSql(`
    INSERT INTO talent_profiles (id, user_id, status, payload_json, confirmed_at, created_at, updated_at)
    VALUES (
      ${sqlString(record.id)},
      ${sqlString(record.userId)},
      ${sqlString(record.status)},
      ${sqlString(JSON.stringify(record))},
      ${sqlString(record.confirmedAt)},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  `);

  return record;
}

export async function getLatestConfirmedTalentProfile(userId: string): Promise<TalentProfileRecord | null> {
  const rows = await querySql<{ payload_json: string }>(`
    SELECT payload_json
    FROM talent_profiles
    WHERE user_id = ${sqlString(userId)} AND status = 'confirmed'
    ORDER BY confirmed_at DESC, created_at DESC
    LIMIT 1;
  `);

  if (rows.length === 0) {
    return null;
  }

  return JSON.parse(rows[0].payload_json) as TalentProfileRecord;
}

export async function confirmCareerNavigation(input: {
  userId: string;
  talentProfileId: string;
}): Promise<CareerNavigationRecord> {
  const talentProfile = await getTalentProfileById(input.talentProfileId);

  if (!talentProfile || talentProfile.userId !== input.userId) {
    throw new Error("Confirmed talent profile not found.");
  }

  const confirmedAt = new Date().toISOString();
  const record: CareerNavigationRecord = {
    id: `career-nav-${randomUUID()}`,
    userId: input.userId,
    talentProfileId: input.talentProfileId,
    status: "confirmed",
    navigation: buildCareerNavigation(talentProfile.profile),
    confirmedAt
  };

  await executeSql(`
    INSERT INTO career_navigation_profiles (id, user_id, talent_profile_id, status, payload_json, confirmed_at, created_at, updated_at)
    VALUES (
      ${sqlString(record.id)},
      ${sqlString(record.userId)},
      ${sqlString(record.talentProfileId)},
      ${sqlString(record.status)},
      ${sqlString(JSON.stringify(record))},
      ${sqlString(record.confirmedAt)},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  `);

  return record;
}

export async function getLatestConfirmedCareerNavigation(userId: string): Promise<CareerNavigationRecord | null> {
  const rows = await querySql<{ payload_json: string }>(`
    SELECT payload_json
    FROM career_navigation_profiles
    WHERE user_id = ${sqlString(userId)} AND status = 'confirmed'
    ORDER BY confirmed_at DESC, created_at DESC
    LIMIT 1;
  `);

  if (rows.length === 0) {
    return null;
  }

  return JSON.parse(rows[0].payload_json) as CareerNavigationRecord;
}

export async function getLatestConfirmedCareerNavigationForTalentProfile(
  userId: string,
  talentProfileId: string
): Promise<CareerNavigationRecord | null> {
  const rows = await querySql<{ payload_json: string }>(`
    SELECT payload_json
    FROM career_navigation_profiles
    WHERE user_id = ${sqlString(userId)}
      AND talent_profile_id = ${sqlString(talentProfileId)}
      AND status = 'confirmed'
    ORDER BY confirmed_at DESC, created_at DESC
    LIMIT 1;
  `);

  if (rows.length === 0) {
    return null;
  }

  return JSON.parse(rows[0].payload_json) as CareerNavigationRecord;
}

export function findCareerDirectionBySlug(
  navigation: CareerNavigationRecord | CareerNavigationProfile | null,
  slug: string
): CareerDirectionSummary | null {
  return findCareerDirectionBySlugFromProfile(navigation, slug);
}

async function getTalentProfileById(id: string): Promise<TalentProfileRecord | null> {
  const rows = await querySql<{ payload_json: string }>(`
    SELECT payload_json
    FROM talent_profiles
    WHERE id = ${sqlString(id)}
    LIMIT 1;
  `);

  if (rows.length === 0) {
    return null;
  }

  return JSON.parse(rows[0].payload_json) as TalentProfileRecord;
}
