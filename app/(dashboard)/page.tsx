import Link from "next/link";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Brain,
  Calendar,
  FileText,
  Plus
} from "lucide-react";
import { getDefaultUserContext } from "@/lib/default-user";
import {
  getApplicationRecordDisplayStatus,
  isUpcomingInterviewTime,
  listApplicationRecords,
  updateApplicationRecordInterviewOutcome,
  type ApplicationRecord
} from "@/lib/services/applications/application-record-service";
import { listInterviewSchedules } from "@/lib/services/interview/interview-schedule-service";
import { DeleteApplicationRecordButton } from "@/components/applications/delete-application-record-button";
import { InterviewOutcomePopover } from "@/components/interview/interview-outcome-popover";
import {
  getLatestConfirmedCareerNavigation,
  getLatestConfirmedTalentProfile
} from "@/lib/services/talent/talent-profile-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = getDefaultUserContext();
  const [records, interviewSchedules, talentProfile, careerNavigation] = await Promise.all([
    listApplicationRecords(),
    listInterviewSchedules(),
    getLatestConfirmedTalentProfile(userId),
    getLatestConfirmedCareerNavigation(userId)
  ]);
  const dashboardRecords = selectDashboardRecords(records);
  const now = new Date();

  async function saveInterviewOutcomeAction(formData: FormData) {
    "use server";
    const recordId = String(formData.get("recordId") ?? "");
    const interviewOutcome = String(formData.get("interviewOutcome") ?? "") as ApplicationRecord["interviewOutcome"];
    const nextInterviewAt = String(formData.get("nextInterviewAt") ?? "");
    const interviewFollowUpNotes = String(formData.get("interviewFollowUpNotes") ?? "");

    await updateApplicationRecordInterviewOutcome({
      recordId,
      interviewOutcome: interviewOutcome || "pending",
      nextInterviewAt: nextInterviewAt ? new Date(nextInterviewAt).toISOString() : undefined,
      interviewFollowUpNotes
    });
    revalidatePath("/");
    revalidatePath("/prep");
    redirect("/");
  }

  return (
    <main className="p-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1f1f1f] mb-2">
          欢迎使用 OfferYou 👋
        </h1>
        <p className="text-[#666] text-lg">
          AI 智能求职助手，助力更高效地准备简历、面试与职业规划
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <OverviewCard
          title="简历管理"
          count={(() => {
            const seen = new Set<string>();
            return dashboardRecords.filter((r) => {
              const key = `${r.company ?? ""}||${r.jobTitle ?? ""}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }).length;
          })()}
          label="份投递记录"
          href="/opportunities"
          iconBg="bg-blue-50"
          icon={<FileText className="text-[#1677ff]" size={28} />}
          actionText="查看全部"
        />
        <OverviewCard
          title="即将到来的面试"
          count={
            interviewSchedules.filter((schedule) => (
              schedule.status !== "finished" && isUpcomingInterviewTime(schedule.interviewAt, now)
            )).length
          }
          label="已安排面试"
          href="/prep"
          iconBg="bg-orange-50"
          icon={<Calendar className="text-orange-600" size={28} />}
          actionText="查看日历"
        />
        <OverviewCard
          title="天赋挖掘"
          status={talentProfile ? "已完成" : "未完成"}
          statusLabel={talentProfile ? "点击查看详情" : "点击开始探索"}
          href="/talent"
          iconBg="bg-green-50"
          icon={<Brain className="text-green-600" size={28} />}
          actionText="开始探索"
        />
      </div>

      {/* Job Progress Table */}
      <section className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] mb-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-[#1f1f1f]">求职进度</h2>
          <Link
            href="/opportunities"
            className="text-sm text-[#1677ff] hover:underline flex items-center gap-1"
          >
            查看全部 <ArrowRight size={14} />
          </Link>
        </div>

        {records.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {dashboardRecords.slice(0, 5).map((record) => (
              <div key={record.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <span className="text-[#1677ff] font-bold text-lg">
                        {(record.company || "?").charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1f1f1f]">{record.company || "未命名公司"}</h3>
                      <p className="text-sm text-[#666]">{record.jobTitle || "未命名岗位"}</p>
                    </div>
                  </div>
                  <StatusBadge status={getApplicationRecordDisplayStatus(record, now)} />
                </div>
                <div className="flex items-center justify-between text-sm text-[#666]">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {record.appliedAt ? new Date(record.appliedAt).toISOString().slice(0, 10) : "—"}
                    </span>
                    <span>已接受 {record.acceptedSuggestionCount} 条建议</span>
                    <InterviewScheduleSummary record={record} />
                  </div>
                  <div className="flex items-center gap-3">
                    <InterviewOutcomePopover
                      record={record}
                      saveAction={saveInterviewOutcomeAction}
                      triggerLabel={getRecordProgressActionLabel(record, now)}
                    />
                    <Link
                      href={`/prep?recordId=${record.id}` as Route}
                      className="text-[#1677ff] hover:underline"
                    >
                      面试准备
                    </Link>
                    <DeleteApplicationRecordButton recordId={record.id} company={record.company} compact />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-[#666] mb-4">还没有投递记录。从创建简历或上传 JD 开始。</p>
            <Link
              href="/applications/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1677ff] text-white rounded-lg hover:bg-[#1677ff]/90 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              添加记录
            </Link>
          </div>
        )}
      </section>

    </main>
  );
}

function selectDashboardRecords(records: ApplicationRecord[]) {
  const selected = new Map<string, ApplicationRecord>();

  for (const record of records) {
    const key = `${record.company ?? ""}||${record.jobTitle ?? ""}`;
    const existing = selected.get(key);

    if (!existing || getInterviewInfoScore(record) > getInterviewInfoScore(existing)) {
      selected.set(key, record);
    }
  }

  return Array.from(selected.values());
}

function getInterviewInfoScore(record: ApplicationRecord) {
  return [
    record.interviewAt,
    record.interviewRound,
    record.interviewNotes,
    record.interviewStatus === "scheduled" || record.interviewStatus === "preparing" ? "has-status" : ""
  ].filter(Boolean).length;
}

function InterviewScheduleSummary({ record }: { record: ApplicationRecord }) {
  const displayStatus = getApplicationRecordDisplayStatus(record);
  const interviewTime = formatInterviewTime(record.interviewAt);
  const outcomeLabel = getOutcomeSummaryLabel(record);
  const interviewLabel = record.nextInterviewAt && displayStatus !== "awaiting_result"
    ? "下一轮"
    : displayStatus === "awaiting_result"
      ? "已过面试"
      : "面试";
  const summaryItems = [
    outcomeLabel,
    interviewTime ? `${interviewLabel} ${interviewTime}` : "",
    record.interviewRound,
    record.interviewNotes
  ].filter(Boolean);

  if (summaryItems.length === 0) {
    return null;
  }

  return (
    <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">
      {summaryItems.join(" · ")}
    </span>
  );
}

function getOutcomeSummaryLabel(record: ApplicationRecord) {
  switch (record.interviewOutcome) {
    case "pending":
      return "等待反馈";
    case "passed":
      return "已通过，待安排";
    case "next_round":
      return record.nextInterviewAt ? "" : "进入下一轮，待定时间";
    case "rejected":
      return "未通过 / 不继续";
    case "no_feedback":
      return "无反馈，已归档";
    default:
      return "";
  }
}

function getRecordProgressActionLabel(record: ApplicationRecord, now: Date) {
  const status = getApplicationRecordDisplayStatus(record, now);

  if (status === "awaiting_result") {
    return "记录结果";
  }

  return "更新进展";
}

function formatInterviewTime(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function OverviewCard({
  title,
  count,
  label,
  status,
  statusLabel,
  href,
  iconBg,
  icon,
  actionText
}: {
  title: string;
  count?: number;
  label?: string;
  status?: string;
  statusLabel?: string;
  href: string;
  iconBg: string;
  icon: React.ReactNode;
  actionText: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#1f1f1f]">{title}</h3>
        <Link href={href as Route} className="text-[#1677ff] text-sm hover:underline">
          {actionText}
        </Link>
      </div>
      <div className="flex items-center">
        <div className={`w-16 h-16 ${iconBg} rounded-xl flex items-center justify-center mr-4`}>
          {icon}
        </div>
        <div>
          {count !== undefined ? (
            <>
              <div className="text-3xl font-bold text-[#1f1f1f]">{count}</div>
              <div className="text-sm text-[#666]">{label}</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-[#1f1f1f]">{status}</div>
              <div className="text-sm text-[#666]">{statusLabel}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    preparing: { bg: "bg-blue-50", text: "text-blue-600", label: "准备中" },
    scheduled: { bg: "bg-green-50", text: "text-green-600", label: "已安排" },
    finished: { bg: "bg-gray-50", text: "text-gray-600", label: "已完成" },
    awaiting_result: { bg: "bg-amber-50", text: "text-amber-700", label: "待记录结果" },
    waiting_feedback: { bg: "bg-orange-50", text: "text-orange-700", label: "等待反馈" },
    passed_waiting_schedule: { bg: "bg-emerald-50", text: "text-emerald-700", label: "已通过待安排" },
    next_round_pending_schedule: { bg: "bg-blue-50", text: "text-blue-700", label: "下一轮待定" }
  };
  const s = config[status ?? ""] ?? { bg: "bg-gray-50", text: "text-gray-500", label: "未开始" };
  return (
    <span className={`px-3 py-1 ${s.bg} ${s.text} rounded-full text-sm font-medium`}>
      {s.label}
    </span>
  );
}
