import Link from "next/link";
import type React from "react";
import type { Route } from "next";
import { CalendarClock, CheckCircle2, FileText, Mic, Plus, Sparkles } from "lucide-react";
import {
  getApplicationRecordDisplayStatus,
  listApplicationRecords,
  type ApplicationRecord,
  type ApplicationRecordDisplayStatus
} from "@/lib/services/applications/application-record-service";
import { DeleteApplicationRecordButton } from "@/components/applications/delete-application-record-button";

export const dynamic = "force-dynamic";

const statusCopy: Record<ApplicationRecordDisplayStatus, { label: string; tone: string }> = {
  none: { label: "已生成简历", tone: "bg-slate-100 text-slate-700" },
  preparing: { label: "面试准备中", tone: "bg-blue-50 text-blue-700" },
  scheduled: { label: "已有面试安排", tone: "bg-amber-50 text-amber-700" },
  finished: { label: "已结束", tone: "bg-emerald-50 text-emerald-700" },
  awaiting_result: { label: "待记录结果", tone: "bg-orange-50 text-orange-700" },
  waiting_feedback: { label: "等待反馈", tone: "bg-orange-50 text-orange-700" },
  passed_waiting_schedule: { label: "已通过待安排", tone: "bg-emerald-50 text-emerald-700" },
  next_round_pending_schedule: { label: "下一轮待定", tone: "bg-blue-50 text-blue-700" }
};

export default async function OpportunitiesPage() {
  const allRecords = await listApplicationRecords();

  // Deduplicate by company + jobTitle
  const seen = new Set<string>();
  const records = allRecords.filter((r) => {
    const key = `${r.company ?? ""}||${r.jobTitle ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const activeRecords = records.filter((record) => record.interviewStatus !== "finished");
  const finishedRecords = records.filter((record) => record.interviewStatus === "finished");

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-7">
        <header className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-card">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#1f1f1f]">投递管理</h1>
              <p className="mt-2 text-[#666]">管理你的岗位投递记录和面试进度</p>
            </div>
            <Link
              className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              href="/applications/new"
            >
              <Plus size={16} />
              新建岗位定制
            </Link>
          </div>
        </header>

        {activeRecords.length > 0 ? (
            <div className="mt-6 grid gap-4">
              {activeRecords.map((record) => (
                <OpportunityCard key={record.id} record={record} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.35rem] border border-dashed border-line bg-paper p-6">
              <h3 className="text-xl font-semibold text-slate-950">还没有岗位机会</h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                先从一个真实 JD 开始。生成岗位快照后，这里会自动出现对应的 PDF、面试准备和下一步动作。
              </p>
              <Link
                className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                href="/applications/new"
              >
                创建第一个岗位
              </Link>
            </div>
          )}

        {finishedRecords.length > 0 ? (
          <section className="rounded-[1.75rem] border border-line bg-white/80 p-6 shadow-card">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">已结束</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {finishedRecords.slice(0, 4).map((record) => (
                <Link
                  key={record.id}
                  className="rounded-[1.2rem] border border-line bg-paper px-4 py-3 text-sm transition hover:border-accent"
                  href={`/applications/${record.draftId}/record`}
                >
                  <span className="font-semibold text-slate-900">{record.company}</span>
                  <span className="text-slate-500"> · {record.jobTitle}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function OpportunityCard({ record }: { record: ApplicationRecord }) {
  const displayStatus = getApplicationRecordDisplayStatus(record);
  const status = statusCopy[displayStatus];
  const nextAction = getNextAction(record);

  return (
    <article className="rounded-[1.5rem] border border-line bg-paper p-5 transition hover:border-accent/40 hover:bg-white">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.75fr_0.6fr] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
            <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
              {formatDate(record.appliedAt)}
            </span>
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950">{record.company || "未命名公司"}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{record.jobTitle || "未命名岗位"}</p>
        </div>

        <div className="grid gap-2 text-sm text-slate-700">
          <InfoLine icon={<FileText size={15} />} label={`已接受 ${record.acceptedSuggestionCount} 条建议`} />
          <InfoLine icon={<Sparkles size={15} />} label={`复用 ${record.reusedMasterFacts.length} 条事实`} />
          <InfoLine
            icon={<Mic size={15} />}
            label={record.interviewPrepId ? "面试准备已生成" : "面试准备待生成"}
          />
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
            href={nextAction.href}
          >
            {nextAction.icon}
            {nextAction.label}
          </Link>
          <DeleteApplicationRecordButton recordId={record.id} company={record.company} />
        </div>
      </div>
    </article>
  );
}

function InfoLine({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2">
      <span className="text-accent">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function getNextAction(record: ApplicationRecord): { label: string; href: Route; icon: React.ReactNode } {
  if (!record.interviewPrepId) {
    return {
      label: "准备面试",
      href: `/prep?recordId=${record.id}` as Route,
      icon: <Mic size={16} />
    };
  }

  if (record.interviewStatus === "scheduled" || record.source === "manual_interview" || !record.draftId) {
    return {
      label: "查看准备",
      href: `/prep?recordId=${record.id}` as Route,
      icon: <CalendarClock size={16} />
    };
  }

  return {
    label: "继续修改",
    href: `/applications/${record.draftId}` as Route,
    icon: <CheckCircle2 size={16} />
  };
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "未知时间";
  }

  return parsed.toISOString().slice(0, 10);
}
