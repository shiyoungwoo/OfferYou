import Link from "next/link";
import { FactSubmissionReviewCard } from "@/components/master/fact-submission-review-card";
import { MasterFactList } from "@/components/master/master-fact-list";
import { MasterInsightList } from "@/components/master/master-insight-list";
import { getDefaultUserContext } from "@/lib/default-user";
import { listApplicationRecords } from "@/lib/services/applications/application-record-service";
import { listPendingFactSubmissions } from "@/lib/services/master/fact-submission-service";
import { listMasterFacts, listMasterInsights } from "@/lib/services/master/master-service";
import { listResumeVersions, type ResumeVersion } from "@/lib/services/resume/resume-version-service";
import { getLatestConfirmedTalentProfile } from "@/lib/services/talent/talent-profile-service";

export default async function MasterPage() {
  const { userId } = getDefaultUserContext();
  const facts = await listMasterFacts(userId);
  const records = await listApplicationRecords();
  const insights = await listMasterInsights(userId);
  const resumeVersions = await listResumeVersions(userId, 8);
  const talentProfile = normalizeTalentProfileForMaster(
    await getLatestConfirmedTalentProfile(userId)
  );
  const pendingSubmissions = await listPendingFactSubmissions();
  const factUsageCount = new Map<string, number>();
  const latestFactUsage = new Map<
    string,
    {
      company: string;
      jobTitle: string;
      appliedAt: string;
    }
  >();

  for (const record of records) {
    for (const fact of record.reusedMasterFacts) {
      factUsageCount.set(fact.id, (factUsageCount.get(fact.id) ?? 0) + 1);

      const existingLatest = latestFactUsage.get(fact.id);
      if (!existingLatest || new Date(record.appliedAt).getTime() > new Date(existingLatest.appliedAt).getTime()) {
        latestFactUsage.set(fact.id, {
          company: record.company,
          jobTitle: record.jobTitle,
          appliedAt: record.appliedAt
        });
      }
    }
  }

  const factsWithUsage = facts.map((fact) => ({
    ...fact,
    impactedApplicationCount: factUsageCount.get(fact.id) ?? 0,
    latestUsage: latestFactUsage.get(fact.id) ?? null
  }));

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accent">我的资料库</p>
              <h1 className="mt-4 text-4xl font-semibold">长期资料</h1>
            </div>
            <Link
              className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
              href="/me"
            >
              返回我的
            </Link>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
            已确认的经历、优势洞察和天赋说明书，会在这里集中保存。
          </p>
        </header>

        <TalentManualCard talentProfile={talentProfile} />

        <ResumeVersionLibraryCard resumeVersions={resumeVersions} />

        <div className="grid gap-6 lg:grid-cols-2">
          <MasterFactList facts={factsWithUsage} />
          <MasterInsightList insights={insights} />
        </div>

        <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">待确认资料</p>
              <h2 className="mt-3 text-2xl font-semibold">等待确认的经历事实</h2>
            </div>
            <div className="rounded-full border border-line px-4 py-2 text-sm text-slate-600">
              {pendingSubmissions.length} 条待确认
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {pendingSubmissions.length > 0 ? (
              pendingSubmissions.map((submission) => (
                <FactSubmissionReviewCard key={submission.id} submission={submission} />
              ))
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-line bg-paper p-5 text-sm leading-6 text-slate-700">
                目前还没有待确认的资料。
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function ResumeVersionLibraryCard({ resumeVersions }: { resumeVersions: ResumeVersion[] }) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">成品简历</p>
          <h2 className="mt-3 text-2xl font-semibold">已保存的简历版本</h2>
        </div>
        <Link
          className="inline-flex w-fit rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
          href="/applications/new"
        >
          新建简历
        </Link>
      </div>

      {resumeVersions.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {resumeVersions.map((version) => (
            <article key={version.id} className="rounded-[1.35rem] border border-line bg-paper p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{version.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {version.targetTitle} · {formatDate(version.updatedAt)} 更新
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                    href={`/applications/${version.draftId}/preview`}
                  >
                    查看简历
                  </Link>
                  <Link
                    className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                    href={`/applications/${version.draftId}`}
                  >
                    继续修改
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[1.35rem] border border-dashed border-line bg-paper p-5 text-sm leading-6 text-slate-700">
          保存或导出成品简历后，这里会自动出现简历版本。
        </div>
      )}
    </section>
  );
}

type ConfirmedTalentProfile = Awaited<ReturnType<typeof getLatestConfirmedTalentProfile>>;

function TalentManualCard({ talentProfile }: { talentProfile: ConfirmedTalentProfile }) {
  const manual = talentProfile?.profile.talentManual?.trim();

  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">天赋说明书</p>
          <h2 className="mt-3 text-2xl font-semibold">
            {talentProfile?.profile.headline ?? "还没有生成天赋说明书"}
          </h2>
        </div>
        <Link
          className="inline-flex w-fit rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
          href="/talent"
        >
          打开天赋发掘
        </Link>
      </div>

      {manual ? (
        <div className="mt-5 grid gap-4">
          <p className="text-sm leading-7 text-slate-700">{talentProfile?.profile.summary}</p>
          <div className="max-h-[28rem] overflow-auto rounded-[1.4rem] border border-line bg-paper p-5 text-sm leading-7 text-slate-700">
            {manual.split(/\n{2,}/).map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 20)}`} className="mb-4 last:mb-0 whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-[1.35rem] border border-dashed border-line bg-paper p-5 text-sm leading-6 text-slate-700">
          完成深度填写并保存后，这里会显示完整天赋说明书。
        </div>
      )}
    </section>
  );
}

function normalizeTalentProfileForMaster(record: ConfirmedTalentProfile): ConfirmedTalentProfile {
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
}
