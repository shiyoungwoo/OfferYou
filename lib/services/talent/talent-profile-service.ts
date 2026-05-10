import { randomUUID } from "node:crypto";
import { executeSql, querySql, sqlString } from "@/lib/db";
import { buildTalentProfile, buildTalentProfileWithModel, type TalentProfile, type TalentPromptAnswers } from "@/lib/services/talent/talent-profile";
import {
  buildCareerNavigation,
  findCareerDirectionBySlug as findCareerDirectionBySlugFromProfile,
  type CareerDirectionSummary,
  type CareerNavigationProfile
} from "@/lib/services/talent/career-navigation";
import { parseJsonPayload } from "@/lib/services/persistence/json-payload";
import { saveMasterInsight } from "@/lib/services/master/master-service";

export type TalentProfileRecord = {
  id: string;
  userId: string;
  status: "confirmed";
  answers: TalentPromptAnswers;
  profile: TalentProfile;
  generationMode?: "model" | "model_repaired" | "deterministic_fallback";
  riskNotes?: string[];
  modelProvider?: string;
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

  const modelResult = await buildTalentProfileWithModel(input.answers).catch(() => null);

  const profile = modelResult?.profile ?? buildTalentProfile(input.answers);

  const riskNotes = [
    ...(modelResult?.riskNotes ?? (modelResult ? [] : ["模型暂不可用，已使用规则生成天赋画像。"]))
  ];

  const record: TalentProfileRecord = {
    id: `talent-${randomUUID()}`,
    userId: input.userId,
    status: "confirmed",
    answers: input.answers,
    profile,
    generationMode: modelResult?.generationMode ?? "deterministic_fallback",
    riskNotes: riskNotes.length > 0 ? riskNotes : undefined,
    modelProvider: modelResult?.modelProvider,
    confirmedAt
  };

  for (const signal of profile.signals.filter((s) => s.evidence.length >= 2).slice(0, 3)) {
    try {
      await saveMasterInsight({
        userId: input.userId,
        title: signal.label,
        insightText: signal.description,
        evidenceFactIds: [],
        status: "confirmed"
      });
    } catch (error) {
      const message = "天赋洞察未能写入事实主档，后续岗位匹配可能暂时无法引用该洞察。";
      record.riskNotes = [...(record.riskNotes ?? []), message];
      console.warn("[TalentProfile] Failed to save master insight:", error instanceof Error ? error.message : "unknown error");
    }
  }

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

  const parsed = parseJsonPayload<TalentProfileRecord>(rows[0].payload_json, "天赋档案");
  return parsed.ok ? parsed.value : null;
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

  const parsed = parseJsonPayload<CareerNavigationRecord>(rows[0].payload_json, "职业路径");
  return parsed.ok ? parsed.value : null;
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

  const parsed = parseJsonPayload<CareerNavigationRecord>(rows[0].payload_json, "职业路径");
  return parsed.ok ? parsed.value : null;
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

  const parsed = parseJsonPayload<TalentProfileRecord>(rows[0].payload_json, "天赋档案");
  return parsed.ok ? parsed.value : null;
}
