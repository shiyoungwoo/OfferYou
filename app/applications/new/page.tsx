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
    <main className="p-8 max-w-7xl mx-auto w-full h-full flex flex-col">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.28em] text-accent">job-apply / 岗位定制</p>
        <h1 className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
          先判断岗位值不值得投，再生成一版可导出的快照简历。
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          当前工作台严格参考 `job-apply` 原型：先做差距分析，再给出逐条建议，最后生成不污染主档的岗位快照。天赋发现会增强判断，但不会阻塞第一条投递链路。
        </p>

        {laneCallout ? (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-900">
            <p className="font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
              已选方向：{laneCallout.laneLabel}
            </p>
            <p className="mt-1 opacity-90">优势提醒：{laneCallout.strengthHint}</p>
            <p className="opacity-90">风险提醒：{laneCallout.riskHint}</p>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-black/5 bg-white/80 px-5 py-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Step 1</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">输入 JD 与现有简历，先拿到差距分析与匹配判断。</p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white/80 px-5 py-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Step 2</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">逐条查看改写建议，新增事实先进入待确认队列。</p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white/80 px-5 py-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Step 3</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">生成岗位快照，确认无误后导出 PDF 并沉淀投递记录。</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <NewApplicationForm draftDefaults={draftDefaults} selectedLane={lane} />
      </div>
    </main>
  );
}
