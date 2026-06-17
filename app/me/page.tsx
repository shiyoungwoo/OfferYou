import Link from "next/link";
import type { Route } from "next";
import { getDefaultUserContext } from "@/lib/default-user";
import { listApplicationRecords } from "@/lib/services/applications/application-record-service";
import { listMasterFacts } from "@/lib/services/master/master-service";
import { listResumeVersions, type ResumeVersion } from "@/lib/services/resume/resume-version-service";
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
  const resumeVersions = await listResumeVersions(userId, 12);
  const applicationRecords = await listApplicationRecords();

  return (
    <main className="p-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1f1f1f] mb-2">个人中心</h1>
        <p className="text-[#666]">管理你的个人资料、简历记录和求职状态</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="优势档案" value={talentProfile ? "已生成" : "未生成"} />
        <StatCard label="职业方向" value={String(careerNavigation?.navigation.directions.length ?? 0)} />
        <StatCard label="资料库事实" value={String(masterFacts.length)} />
        <StatCard label="简历版本" value={String(resumeVersions.length)} />
      </div>

      {/* Info Cards */}
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
              ? careerNavigation.navigation.directions.map((d) => d.label)
              : ["还没有确认的职业方向。"]
          }
          title="我的职业方向"
        />
        <InfoCard
          actionHref="/master"
          actionLabel="打开资料库详情"
          items={
            masterFacts.length > 0
              ? masterFacts.slice(0, 4).map((f) => f.title)
              : ["资料库里还没有确认过的经历事实。"]
          }
          title="我的资料库"
        />
        <ResumeLibraryCard
          applicationRecordCount={applicationRecords.length}
          resumeVersions={resumeVersions.slice(0, 4)}
        />
      </div>

      {/* Recent Resume Versions */}
      <section className="mt-8 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs text-[#666] uppercase tracking-wider">最近简历版本</p>
            <h2 className="mt-2 text-xl font-semibold text-[#1f1f1f]">最近保存和导出的简历</h2>
          </div>
          <Link
            href="/applications/new"
            className="inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1677ff] hover:text-[#1677ff]"
          >
            新建一版简历
          </Link>
        </div>

        {resumeVersions.length > 0 ? (
          <div className="grid gap-4">
            {resumeVersions.slice(0, 6).map((version) => (
              <article key={version.id} className="rounded-xl border border-gray-100 bg-gray-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1f1f1f]">{version.title}</h3>
                    <p className="mt-1 text-sm text-[#666]">{version.targetTitle}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#666]">
                      <span className="rounded-full bg-white px-3 py-1">{formatResumeVersionSource(version.sourceType)}</span>
                      <span className="rounded-full bg-white px-3 py-1">{formatDate(version.updatedAt)} 更新</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1677ff] hover:text-[#1677ff]"
                      href={`/applications/${version.draftId}/preview`}
                    >
                      查看简历
                    </a>
                    <a
                      className="inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1677ff] hover:text-[#1677ff]"
                      href={`/applications/${version.draftId}`}
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
            body="还没有保存过成品简历。先从修改简历开始，保存或导出后这里会自动累积版本。"
            title="还没有最近版本"
          />
        )}
      </section>
    </main>
  );
}

function ResumeLibraryCard({
  resumeVersions,
  applicationRecordCount
}: {
  resumeVersions: ResumeVersion[];
  applicationRecordCount: number;
}) {
  return (
    <section className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1f1f1f]">我的简历与申请</h2>
          <p className="mt-1 text-sm text-[#666]">{applicationRecordCount} 条申请记录</p>
        </div>
        <Link
          className="inline-flex rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1677ff] hover:text-[#1677ff]"
          href="/applications/new"
        >
          新建简历
        </Link>
      </div>

      {resumeVersions.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {resumeVersions.map((version) => (
            <article key={version.id} className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1f1f1f]">{version.title}</p>
                  <p className="mt-1 text-xs text-[#666]">{formatDate(version.updatedAt)} 更新</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1f1f1f] transition hover:border-[#1677ff] hover:text-[#1677ff]"
                    href={`/applications/${version.draftId}/preview` as Route}
                  >
                    查看简历
                  </Link>
                  <Link
                    className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1f1f1f] transition hover:border-[#1677ff] hover:text-[#1677ff]"
                    href={`/applications/${version.draftId}` as Route}
                  >
                    继续修改
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-[#666]">
          保存或导出简历后，这里会显示可查看、可继续修改的简历版本。
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] px-4 py-4">
      <p className="text-xs text-[#666] uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#1f1f1f]">{value}</p>
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
  actionHref?: string;
  actionLabel: string;
}) {
  const href = actionHref ?? "#";
  return (
    <section className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
      <h2 className="text-lg font-semibold text-[#1f1f1f]">{title}</h2>
      <ul className="mt-4 grid gap-3 text-sm text-[#666]">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="rounded-lg bg-gray-50 px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
      <Link
        className="mt-5 inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1677ff] hover:text-[#1677ff]"
        href={href as Route}
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
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
      <h3 className="text-lg font-semibold text-[#1f1f1f]">{title}</h3>
      <p className="mt-3 text-sm text-[#666]">{body}</p>
      <Link
        className="mt-4 inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#1f1f1f] transition hover:border-[#1677ff] hover:text-[#1677ff]"
        href={actionHref as Route}
      >
        {actionLabel}
      </Link>
    </div>
  );
}

function formatResumeVersionSource(sourceType: ResumeVersion["sourceType"]) {
  if (sourceType === "pdf_export") {
    return "已导出 PDF";
  }

  if (sourceType === "snapshot_generation") {
    return "已生成预览";
  }

  return "已保存";
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
