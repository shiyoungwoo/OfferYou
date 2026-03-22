import Link from "next/link";
import type { Route } from "next";
import { getDefaultUserContext } from "@/lib/default-user";
import { listApplicationRecords } from "@/lib/services/applications/application-record-service";
import { listMasterFacts } from "@/lib/services/master/master-service";
import {
  getLatestConfirmedCareerNavigation,
  getLatestConfirmedTalentProfile
} from "@/lib/services/talent/talent-profile-service";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const { userId } = getDefaultUserContext();
  const talentProfile = await getLatestConfirmedTalentProfile(userId);
  const careerNavigation = await getLatestConfirmedCareerNavigation(userId);
  const masterFacts = await listMasterFacts(userId);
  const applicationRecords = await listApplicationRecords();

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">我的</p>
          <h1 className="mt-4 text-4xl font-semibold">把简历、发现自己、长期资料放回同一个地方。</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
            这个页面聚合你的长期资料。用户可以在这里回看自己的资料库、最近一次发现自己的结果、职业方向，以及已经生成过的简历和申请记录。
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <MetricPill label="优势档案" value={talentProfile ? "已生成" : "未生成"} />
            <MetricPill label="职业方向" value={String(careerNavigation?.navigation.directions.length ?? 0)} />
            <MetricPill label="资料库事实" value={String(masterFacts.length)} />
            <MetricPill label="简历记录" value={String(applicationRecords.length)} />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <InfoCard
            actionHref="/talent"
            actionLabel="继续发现自己"
            items={
              talentProfile
                ? [talentProfile.profile.headline, talentProfile.profile.confidenceNote]
                : ["还没有保存的发现自己结果。"]
            }
            title="我的优势档案"
          />
          <InfoCard
            actionHref="/talent"
            actionLabel="查看职业方向"
            items={
              careerNavigation
                ? careerNavigation.navigation.directions.map((direction) => direction.label)
                : ["还没有确认的职业方向。"]
            }
            title="我的职业方向"
          />
          <InfoCard
            actionHref="/master"
            actionLabel="打开资料库详情"
            items={
              masterFacts.length > 0
                ? masterFacts.slice(0, 4).map((fact) => fact.title)
                : ["资料库里还没有确认过的经历事实。"]
            }
            title="我的资料库"
          />
          <InfoCard
            actionHref="/applications/new"
            actionLabel="继续修改简历"
            items={
              applicationRecords.length > 0
                ? applicationRecords.slice(0, 4).map((record) => `${record.company} · ${record.jobTitle}`)
                : ["还没有生成过简历版本或申请记录。"]
            }
            title="我的简历与申请"
          />
        </div>

        <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">最近简历版本</p>
              <h2 className="mt-3 text-2xl font-semibold">最近导出和投递过的简历</h2>
            </div>
            <Link
              className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
              href="/applications/new"
            >
              新建一版简历
            </Link>
          </div>

          {applicationRecords.length > 0 ? (
            <div className="mt-6 grid gap-4">
              {applicationRecords.slice(0, 6).map((record) => (
                <article key={record.id} className="rounded-[1.35rem] border border-line bg-paper p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{record.company}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{record.jobTitle}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        <span className="rounded-full bg-white px-3 py-1">{record.acceptedSuggestionCount} accepted</span>
                        <span className="rounded-full bg-white px-3 py-1">{record.reusedMasterFacts.length} facts reused</span>
                        <span className="rounded-full bg-white px-3 py-1">{formatAppliedAt(record.appliedAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                        href={`/applications/${record.draftId}/record`}
                      >
                        查看记录
                      </a>
                      <a
                        className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                        href={`/applications/${record.draftId}/preview`}
                      >
                        打开预览
                      </a>
                      <a
                        className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                        href={`/applications/${record.draftId}`}
                      >
                        继续修改
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              actionHref="/applications/new"
              actionLabel="开始修改简历"
              body="还没有生成过简历版本。先从修改简历开始，之后这里会自动累积你的版本与投递记录。"
              title="还没有最近版本"
            />
          )}
        </section>
      </section>
    </main>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-line bg-paper px-4 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InfoCard({
  title,
  items,
  actionHref,
  actionLabel
}: {
  title: string;
  items: string[];
  actionHref: Route;
  actionLabel: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="rounded-[1.1rem] bg-paper px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
      <Link
        className="mt-5 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
        href={actionHref}
      >
        {actionLabel}
      </Link>
    </section>
  );
}

function EmptyState({
  title,
  body,
  actionHref,
  actionLabel
}: {
  title: string;
  body: string;
  actionHref: Route;
  actionLabel: string;
}) {
  return (
    <div className="mt-6 rounded-[1.35rem] border border-dashed border-line bg-paper p-5">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-700">{body}</p>
      <Link
        className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
        href={actionHref}
      >
        {actionLabel}
      </Link>
    </div>
  );
}

function formatAppliedAt(value: string) {
  if (!value) {
    return "unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
}
