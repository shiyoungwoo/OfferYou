import { TalentProfileWorkbench } from "@/components/talent/talent-profile-workbench";
import { getDefaultUserContext } from "@/lib/default-user";
import {
  getLatestConfirmedCareerNavigationForTalentProfile,
  getLatestConfirmedTalentProfile,
  getTalentExcavationDraft
} from "@/lib/services/talent/talent-profile-service";

export const dynamic = "force-dynamic";

export default async function TalentPage() {
  const { userId } = getDefaultUserContext();
  const initialConfirmedTalentProfile = normalizeTalentProfileForDisplay(
    await getLatestConfirmedTalentProfile(userId)
  );
  const initialExcavationDraft = await getTalentExcavationDraft(userId);
  const initialConfirmedCareerNavigation = initialConfirmedTalentProfile
    ? await getLatestConfirmedCareerNavigationForTalentProfile(userId, initialConfirmedTalentProfile.id)
    : null;

  return (
    <section className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1f1f1f] flex items-center gap-3">
          <span className="text-[#1677ff]">🧠</span>
          天赋挖掘与职业规划
        </h1>
        <p className="text-[#666] mt-2">沉淀优势档案，用于简历优化、岗位匹配和面试准备。</p>
      </div>

      <TalentProfileWorkbench
        initialConfirmedCareerNavigation={initialConfirmedCareerNavigation}
        initialConfirmedTalentProfile={initialConfirmedTalentProfile}
        initialExcavationDraft={initialExcavationDraft}
      />
    </section>
  );
}

type ConfirmedTalentProfile = Awaited<ReturnType<typeof getLatestConfirmedTalentProfile>>;

function normalizeTalentProfileForDisplay(record: ConfirmedTalentProfile): ConfirmedTalentProfile {
  if (!record) {
    return record;
  }

  return {
    ...record,
    answers: {
      ...record.answers,
      talentManual: normalizeTalentManualHeadings(record.answers.talentManual)
    },
    profile: {
      ...record.profile,
      talentManual: normalizeTalentManualHeadings(record.profile.talentManual)
    }
  };
}

function normalizeTalentManualHeadings(value?: string) {
  if (!value) {
    return value;
  }

  return value
    .replace(/(^|\n)(\s*(?:#{1,4}\s*)?(?:(?:\d+|[一二三四五六七八九十]+)[.、]\s*)?)适合的?工作环境(?=\s*(?:\n|$))/g, "$1$2适合环境")
    .replace(/(^|\n)(\s*(?:#{1,4}\s*)?(?:(?:\d+|[一二三四五六七八九十]+)[.、]\s*)?)不适合的?工作环境(?=\s*(?:\n|$))/g, "$1$2不适合环境")
    .replace(/(^|\n)(\s*(?:#{1,4}\s*)?(?:(?:\d+|[一二三四五六七八九十]+)[.、]\s*)?)职业方向建议(?=\s*(?:\n|$))/g, "$1$2职业方向");
}
