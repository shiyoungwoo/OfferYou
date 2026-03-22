import { getDefaultUserContext } from "@/lib/default-user";
import { getApplicationDraftDefaults } from "@/lib/services/talent/application-draft-defaults";
import { getCareerLaneCallout } from "@/lib/services/talent/career-lane-callout";
import {
  getLatestConfirmedCareerNavigationForTalentProfile,
  getLatestConfirmedTalentProfile
} from "@/lib/services/talent/talent-profile-service";
import { NewApplicationForm } from "@/components/applications/new-application-form";

export const dynamic = "force-dynamic";

type NewApplicationPageProps = {
  searchParams?: Promise<{
    lane?: string;
    role?: string;
  }>;
};

export default async function NewApplicationPage({ searchParams }: NewApplicationPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const lane = resolvedSearchParams?.lane;
  const role = resolvedSearchParams?.role;
  const { userId } = getDefaultUserContext();
  const talentProfile = await getLatestConfirmedTalentProfile(userId);
  const careerNavigation = talentProfile
    ? await getLatestConfirmedCareerNavigationForTalentProfile(userId, talentProfile.id)
    : null;
  const laneCallout = getCareerLaneCallout({
    lane,
    talentProfile,
    careerNavigation
  });
  const draftDefaults = getApplicationDraftDefaults({
    lane,
    role,
    talentProfile,
    careerNavigation
  });

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">New Application</p>
          <h1 className="mt-4 text-4xl font-semibold">先改简历，再决定要不要继续深挖自己。</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
            这是 OfferYou 的主工作台。先输入岗位和初版简历，右侧会给出匹配判断、优势点和修改建议。客户确认后，再进入正式分析工作台生成优化简历。
          </p>
          {laneCallout ? (
            <div className="mt-6 rounded-[1.4rem] border border-accent/20 bg-accent/5 px-5 py-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-900">Current lane: {laneCallout.laneLabel}</p>
              <p className="mt-2">Strength signal: {laneCallout.strengthHint}</p>
              <p className="mt-2">Risk reminder: {laneCallout.riskHint}</p>
            </div>
          ) : null}
        </header>

        <NewApplicationForm draftDefaults={draftDefaults} selectedLane={lane} />
      </section>
    </main>
  );
}
