import Link from "next/link";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Mic,
  Bot,
  Star
} from "lucide-react";
import { AddInterviewScheduleForm } from "@/components/interview/add-interview-schedule-form";
import { InterviewAnswerActions } from "@/components/interview/interview-answer-actions";
import { InterviewContextSubmitButton } from "@/components/interview/interview-context-submit-button";
import { InterviewPrepExportCard } from "@/components/interview/interview-prep-export-card";
import { getDefaultUserContext } from "@/lib/default-user";
import {
  buildInterviewPrepExportText,
  buildInterviewPrepReviewChecklist,
  createInterviewPrepFromRecord,
  optimizeInterviewAnswerDraft,
  readInterviewPrep,
  saveInterviewPrep
} from "@/lib/services/interview/interview-prep-service";
import { getInterviewContextSavedMessage } from "@/lib/services/interview/interview-context-feedback";
import {
  getApplicationRecordDisplayStatus,
  isUpcomingInterviewTime,
  listApplicationRecords,
  readApplicationRecord,
  updateApplicationRecordInterviewContext,
} from "@/lib/services/applications/application-record-service";
import {
  createOrUpdateInterviewSchedule,
  listInterviewSchedules
} from "@/lib/services/interview/interview-schedule-service";
import { researchInterviewContext } from "@/lib/services/interview/interview-research-service";

export const dynamic = "force-dynamic";

type InterviewPrepPageProps = {
  searchParams?: Promise<{
    recordId?: string;
    contextSaved?: string;
    contextSavedAt?: string;
  }>;
};

export default async function InterviewPrepPage({ searchParams }: InterviewPrepPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const recordId = resolvedSearchParams?.recordId;
  const { userId } = getDefaultUserContext();

  // If recordId is present, show the existing detailed prep view
  if (recordId) {
    return (
      <PrepDetailView
        contextSaved={resolvedSearchParams?.contextSaved === "1"}
        contextSavedAt={resolvedSearchParams?.contextSavedAt}
        recordId={recordId}
      />
    );
  }

  // Otherwise, show the new landing page
  const records = await listApplicationRecords();
  const now = new Date();
  const upcomingSchedules = (await listInterviewSchedules()).filter((schedule) => (
    schedule.status !== "finished" && isUpcomingInterviewTime(schedule.interviewAt, now)
  ));
  const upcomingRecordIds = new Set(upcomingSchedules.map((schedule) => schedule.applicationRecordId).filter(Boolean));
  const nonUpcomingRecords = records.filter((record) => !upcomingRecordIds.has(record.id));
  const followUpRecords = nonUpcomingRecords.filter((record) => isFollowUpRecord(record, now));
  const prepCandidateRecords = nonUpcomingRecords.filter((record) => !isFollowUpRecord(record, now));
  const schedulableRecords = records.filter((record) => record.interviewStatus !== "finished");

  async function scheduleInterviewAction(formData: FormData) {
    "use server";
    const selectedRecordId = String(formData.get("recordId") ?? "");
    const company = String(formData.get("company") ?? "");
    const jobTitle = String(formData.get("jobTitle") ?? "");
    const interviewAt = String(formData.get("interviewAt") ?? "");
    const interviewRound = String(formData.get("interviewRound") ?? "");
    const interviewNotes = String(formData.get("interviewNotes") ?? "");

    if (!interviewAt || (!selectedRecordId && (!company.trim() || !jobTitle.trim()))) {
      return;
    }

    await createOrUpdateInterviewSchedule({
      userId,
      applicationRecordId: selectedRecordId || undefined,
      company,
      jobTitle,
      interviewAt: new Date(interviewAt).toISOString(),
      interviewRound,
      interviewNotes
    });
    revalidatePath("/prep");
  }

  return (
    <main className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1f1f1f] mb-2">面试工具</h1>
        <p className="text-[#666]">AI 辅助面试准备，提升面试成功率</p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <FeatureCard
          iconBg="bg-blue-50"
          icon={<Calendar className="text-[#1677ff]" size={24} />}
          title="面试日历"
          description="管理面试日程，设置提醒，不错过任何机会"
          tag="即将推出"
          tagBg="bg-slate-100 text-slate-500"
          href="#"
        />
        <FeatureCard
          iconBg="bg-green-50"
          icon={<Mic className="text-green-500" size={24} />}
          title="AI 自我介绍训练"
          description="AI 辅助生成专业自我介绍，并提供优化建议"
          tag="即将推出"
          tagBg="bg-slate-100 text-slate-500"
          href="#"
        />
        <FeatureCard
          iconBg="bg-purple-50"
          icon={<Bot className="text-purple-500" size={24} />}
          title="AI 模拟面试"
          description="根据岗位要求进行 AI 模拟面试，实时反馈优化"
          tag="即将推出"
          tagBg="bg-slate-100 text-slate-500"
          href="#"
        />
      </div>

      {/* Upcoming Interviews */}
      <section className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] mb-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-[#1f1f1f]">即将到来的面试</h2>
          <AddInterviewScheduleForm
            records={schedulableRecords.map((record) => ({
              id: record.id,
              company: record.company,
              jobTitle: record.jobTitle
            }))}
            scheduleAction={scheduleInterviewAction}
          />
        </div>

        {upcomingSchedules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-6 text-[#1f1f1f] font-semibold text-sm">公司名称</th>
                  <th className="text-left py-3 px-6 text-[#1f1f1f] font-semibold text-sm">职位</th>
                  <th className="text-left py-3 px-6 text-[#1f1f1f] font-semibold text-sm">面试时间</th>
                  <th className="text-left py-3 px-6 text-[#1f1f1f] font-semibold text-sm">状态</th>
                  <th className="text-left py-3 px-6 text-[#1f1f1f] font-semibold text-sm">操作</th>
                </tr>
              </thead>
              <tbody>
                {upcomingSchedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
                          <span className="text-[#1677ff] font-bold text-sm">
                            {(schedule.company || "?").charAt(0)}
                          </span>
                        </div>
                        <span className="text-[#1f1f1f] font-medium text-sm">
                          {schedule.company || "未命名公司"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-[#1f1f1f]">
                      <div>{schedule.jobTitle || "未命名岗位"}</div>
                      {schedule.interviewRound && (
                        <div className="mt-1 text-xs text-[#666]">{schedule.interviewRound}</div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-[#666]">
                      {formatInterviewTime(schedule.interviewAt)}
                    </td>
                    <td className="py-4 px-6">
                      <InterviewStatusBadge status={schedule.status} />
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-3">
                        {schedule.applicationRecordId ? (
                          <Link
                            href={`/prep?recordId=${schedule.applicationRecordId}` as Route}
                            className="text-[#1677ff] text-sm hover:underline"
                          >
                            准备面试
                          </Link>
                        ) : (
                          <span className="text-sm text-[#999]">手动记录</span>
                        )}
                        {schedule.draftId && (
                          <Link
                            href={`/applications/${schedule.draftId}/preview` as Route}
                            className="text-[#666] text-sm hover:text-[#1f1f1f]"
                          >
                            查看简历
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-[#666]">暂无即将到来的面试安排</p>
            <p className="text-sm text-[#999] mt-1">收到邀约后，可以直接手动记录公司、岗位和时间。</p>
          </div>
        )}
      </section>

      {followUpRecords.length > 0 && (
        <section className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 mb-8">
          <h2 className="text-xl font-semibold text-[#1f1f1f] mb-6">已面 / 待跟进记录</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {followUpRecords.slice(0, 4).map((record) => (
              <InterviewRecordCard key={record.id} record={record} now={now} />
            ))}
          </div>
        </section>
      )}

      {prepCandidateRecords.length > 0 && (
        <section className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
          <h2 className="text-xl font-semibold text-[#1f1f1f] mb-6">可准备的岗位记录</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prepCandidateRecords.slice(0, 4).map((record) => (
              <InterviewRecordCard key={record.id} record={record} now={now} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// Detailed prep view (kept from original implementation)
async function PrepDetailView({
  contextSaved,
  contextSavedAt,
  recordId
}: {
  contextSaved: boolean;
  contextSavedAt?: string;
  recordId: string;
}) {
  const record = await readApplicationRecord(recordId);

  if (!record) {
    const records = await listApplicationRecords();
    return (
      <main className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
            <p className="text-[#666]">未找到对应的投递记录，请从已有记录重新进入面试准备。</p>
          </div>
          {records.length > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {records.slice(0, 6).map((item) => (
                <Link
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 hover:border-[#1677ff] transition-colors"
                  href={`/prep?recordId=${item.id}`}
                >
                  <p className="text-xs text-[#666]">可用记录</p>
                  <h2 className="mt-2 text-lg font-semibold text-[#1f1f1f]">{item.company}</h2>
                  <p className="mt-1 text-sm text-[#1677ff]">{item.jobTitle}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  const currentRecord = record;
  const prep = await createInterviewPrepFromRecord(currentRecord.id);
  const exportText = buildInterviewPrepExportText(prep);
  const checklistItems = buildInterviewPrepReviewChecklist(prep);
  const favoriteQuestionCount = prep.questions.filter((q) => q.favorite).length;
  const answeredQuestionCount = prep.questions.filter((q) => q.answerDraft.trim().length > 0).length;

  async function saveSelfIntroAction(formData: FormData) {
    "use server";
    const prepId = String(formData.get("prepId") ?? "");
    const recordIdValue = String(formData.get("recordId") ?? "");
    const selfIntroDraft = String(formData.get("selfIntroDraft") ?? "");
    const latestPrep = (await readInterviewPrep(prepId)) ?? (await createInterviewPrepFromRecord(recordIdValue));
    latestPrep.selfIntroDraft = selfIntroDraft.trim();
    latestPrep.updatedAt = new Date().toISOString();
    await saveInterviewPrep(latestPrep);
    revalidatePath("/prep");
  }

  async function saveAnswerAction(formData: FormData) {
    "use server";
    const prepId = String(formData.get("prepId") ?? "");
    const recordIdValue = String(formData.get("recordId") ?? "");
    const questionId = String(formData.get("questionId") ?? "");
    const answerDraft = String(formData.get("answerDraft") ?? "");
    const latestPrep = (await readInterviewPrep(prepId)) ?? (await createInterviewPrepFromRecord(recordIdValue));
    latestPrep.questions = latestPrep.questions.map((q) =>
      q.id === questionId ? { ...q, answerDraft: answerDraft.trim() } : q
    );
    latestPrep.updatedAt = new Date().toISOString();
    await saveInterviewPrep(latestPrep);
    revalidatePath("/prep");
  }

  async function toggleFavoriteAction(formData: FormData) {
    "use server";
    const prepId = String(formData.get("prepId") ?? "");
    const recordIdValue = String(formData.get("recordId") ?? "");
    const questionId = String(formData.get("questionId") ?? "");
    const latestPrep = (await readInterviewPrep(prepId)) ?? (await createInterviewPrepFromRecord(recordIdValue));
    latestPrep.questions = latestPrep.questions.map((q) =>
      q.id === questionId ? { ...q, favorite: !q.favorite } : q
    );
    latestPrep.updatedAt = new Date().toISOString();
    await saveInterviewPrep(latestPrep);
    revalidatePath("/prep");
  }

  async function optimizeAnswerAction(formData: FormData) {
    "use server";
    const prepId = String(formData.get("prepId") ?? "");
    const recordIdValue = String(formData.get("recordId") ?? "");
    const questionId = String(formData.get("questionId") ?? "");
    const answerDraft = String(formData.get("answerDraft") ?? "");
    const latestPrep = (await readInterviewPrep(prepId)) ?? (await createInterviewPrepFromRecord(recordIdValue));
    const question = latestPrep.questions.find((q) => q.id === questionId);

    if (!question) {
      return;
    }

    const optimized = await optimizeInterviewAnswerDraft({
      company: latestPrep.company,
      jobTitle: latestPrep.jobTitle,
      questionText: question.questionText,
      answerDraft,
      sourceType: question.sourceType,
      sourceRef: question.sourceRef
    });
    latestPrep.questions = latestPrep.questions.map((q) =>
      q.id === questionId
        ? {
            ...q,
            answerDraft: optimized.riskNote
              ? [answerDraft.trim(), "", `【${optimized.riskNote}】`].filter(Boolean).join("\n")
              : optimized.answerDraft.trim()
          }
        : q
    );
    latestPrep.updatedAt = new Date().toISOString();
    await saveInterviewPrep(latestPrep);
    revalidatePath("/prep");
  }

  async function saveInterviewContextAction(formData: FormData) {
    "use server";
    const contextText = String(formData.get("interviewContextText") ?? "");
    await updateApplicationRecordInterviewContext({
      recordId: currentRecord.id,
      interviewContextText: contextText
    });
    await createInterviewPrepFromRecord(currentRecord.id, { force: true });
    revalidatePath("/");
    revalidatePath("/prep");
    redirect(`/prep?recordId=${encodeURIComponent(currentRecord.id)}&contextSaved=1&contextSavedAt=${Date.now()}`);
  }

  async function researchInterviewContextAction() {
    "use server";
    const research = await researchInterviewContext({
      company: currentRecord.company,
      jobTitle: currentRecord.jobTitle
    });
    await updateApplicationRecordInterviewContext({
      recordId: currentRecord.id,
      interviewContextText: currentRecord.interviewContextText,
      interviewResearch: research
    });
    if (research.status === "ready") {
      await createInterviewPrepFromRecord(currentRecord.id, { force: true });
    }
    revalidatePath("/prep");
  }

  return (
    <main className="p-8">
      <section className="mx-auto max-w-6xl flex flex-col gap-6">
        <header className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8">
          <Link className="text-sm font-medium text-[#1677ff] hover:underline" href="/">
            返回首页
          </Link>
          <p className="mt-4 text-sm text-[#1677ff] font-medium">面试准备</p>
          <h1 className="mt-3 text-3xl font-bold text-[#1f1f1f]">{currentRecord.company} · {currentRecord.jobTitle}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#666]">
            根据公司、岗位和已保存信息整理自我介绍、面试问题和答案草稿。
          </p>
        </header>

        <InterviewPrepSourceNotice prep={prep} record={currentRecord} />

        <InterviewContextPanel
          contextSaved={contextSaved}
          contextSavedAt={contextSavedAt}
          prep={prep}
          record={currentRecord}
          researchAction={researchInterviewContextAction}
          saveAction={saveInterviewContextAction}
        />

        <InterviewPrepExportCard
          answeredQuestionCount={answeredQuestionCount}
          checklistItems={checklistItems}
          company={prep.company}
          exportText={exportText}
          favoriteQuestionCount={favoriteQuestionCount}
          jobTitle={prep.jobTitle}
          questionCount={prep.questions.length}
        />

        {/* Self Intro */}
        <section className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#666] uppercase tracking-wider">自我介绍草稿</p>
              <h2 className="mt-2 text-xl font-semibold text-[#1f1f1f]">先把开场讲顺</h2>
            </div>
          </div>
          <form action={saveSelfIntroAction} className="mt-5 grid gap-4">
            <input type="hidden" name="prepId" value={prep.id} />
            <input type="hidden" name="recordId" value={currentRecord.id} />
            <textarea
              className="min-h-40 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-7 text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
              name="selfIntroDraft"
              defaultValue={prep.selfIntroDraft}
            />
            <button
              className="inline-flex w-fit rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-900"
              type="submit"
            >
              保存自我介绍
            </button>
          </form>
        </section>

        {/* Questions */}
        <section className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#666] uppercase tracking-wider">问题清单</p>
              <h2 className="mt-2 text-xl font-semibold text-[#1f1f1f]">面试问题</h2>
            </div>
            <div className="rounded-full border border-gray-200 px-3 py-1 text-xs text-[#666]">
              {prep.questions.length} 题
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {prep.questions.map((question, index) => (
              <article key={question.id} className="rounded-xl border border-gray-100 bg-gray-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <p className="text-xs text-[#666] uppercase tracking-wider">问题 {index + 1}</p>
                    <h3 className="mt-2 text-sm font-semibold leading-6 text-[#1f1f1f]">{question.questionText}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-[#666]">
                      {renderSourceLabel(question.sourceType)}
                    </span>
                    <form action={toggleFavoriteAction}>
                      <input type="hidden" name="prepId" value={prep.id} />
                      <input type="hidden" name="recordId" value={currentRecord.id} />
                      <input type="hidden" name="questionId" value={question.id} />
                      <button
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          question.favorite
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-gray-200 bg-white text-[#666] hover:border-[#1677ff] hover:text-[#1677ff]"
                        }`}
                        type="submit"
                      >
                        <Star size={12} fill={question.favorite ? "currentColor" : "none"} />
                        {question.favorite ? "已收藏" : "收藏"}
                      </button>
                    </form>
                  </div>
                </div>

                <form action={saveAnswerAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="prepId" value={prep.id} />
                  <input type="hidden" name="recordId" value={currentRecord.id} />
                  <input type="hidden" name="questionId" value={question.id} />
                  <textarea
                    className="min-h-28 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-7 text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
                    defaultValue={question.answerDraft}
                    name="answerDraft"
                    placeholder="写下答案草稿..."
                  />
                  <InterviewAnswerActions optimizeAction={optimizeAnswerAction} />
                </form>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function InterviewRecordCard({ record, now }: { record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>; now: Date }) {
  const displayStatus = getApplicationRecordDisplayStatus(record, now);

  return (
    <div className="border border-gray-100 rounded-lg p-4 hover:border-[#1677ff]/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="text-[#1f1f1f] font-medium">{record.company}</h4>
          <p className="text-sm text-[#666]">{record.jobTitle}</p>
        </div>
        <span className="px-2 py-1 bg-gray-50 text-[#666] text-xs rounded-full">
          {record.acceptedSuggestionCount} 条建议已接受
        </span>
      </div>
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-[#666]">
          {getRecordProgressText(record, now)}
        </span>
        <Link
          href={`/prep?recordId=${record.id}` as Route}
          className="text-[#1677ff] text-sm hover:underline flex items-center gap-1"
        >
          {getRecordActionLabel(displayStatus)} <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function isFollowUpRecord(record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>, now: Date) {
  const status = getApplicationRecordDisplayStatus(record, now);
  return Boolean(record.interviewAt) && status !== "scheduled";
}

function getRecordProgressText(record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>, now: Date) {
  const status = getApplicationRecordDisplayStatus(record, now);
  const timeText = formatInterviewTime(record.interviewAt);

  switch (status) {
    case "awaiting_result":
      return `面试已过，待记录结果：${timeText}`;
    case "waiting_feedback":
      return `已记录，等待反馈：${timeText}`;
    case "passed_waiting_schedule":
      return `已通过，待安排下一轮：${timeText}`;
    case "next_round_pending_schedule":
      return `进入下一轮，待定时间：${timeText}`;
    case "finished":
      return `已结束：${timeText}`;
    case "scheduled":
      return `面试已安排：${timeText}`;
    default:
      return record.interviewPrepId ? "面试准备已生成" : "尚未准备";
  }
}

function getRecordActionLabel(status: ReturnType<typeof getApplicationRecordDisplayStatus>) {
  if (status === "awaiting_result") {
    return "记录结果";
  }

  if (status === "scheduled" || status === "preparing") {
    return "开始准备";
  }

  return "查看进展";
}

function FeatureCard({
  iconBg,
  icon,
  title,
  description,
  tag,
  tagBg,
  href
}: {
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
  tagBg: string;
  href: string;
}) {
  return (
    <Link
      href={href as Route}
      className="group bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className={`w-14 h-14 ${iconBg} rounded-xl flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-[#1f1f1f] mb-2">{title}</h3>
      <p className="text-sm text-[#666] mb-4 leading-relaxed">{description}</p>
      <div className="flex justify-between items-center">
        <span className={`text-xs px-3 py-1 rounded-full ${tagBg}`}>{tag}</span>
        <ArrowRight className="text-[#1677ff] group-hover:translate-x-1 transition-transform" size={16} />
      </div>
    </Link>
  );
}

function InterviewStatusBadge({ status }: { status?: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    preparing: { bg: "bg-blue-50", text: "text-blue-600", label: "准备中" },
    scheduled: { bg: "bg-green-50", text: "text-green-600", label: "已安排" },
    finished: { bg: "bg-gray-50", text: "text-gray-600", label: "已完成" }
  };
  const s = config[status ?? ""] ?? { bg: "bg-gray-50", text: "text-gray-500", label: "未开始" };
  return (
    <span className={`px-2 py-1 ${s.bg} ${s.text} text-xs rounded-full`}>
      {s.label}
    </span>
  );
}

function InterviewPrepSourceNotice({
  prep,
  record
}: {
  prep: Awaited<ReturnType<typeof createInterviewPrepFromRecord>>;
  record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>;
}) {
  const isModel = prep.generationMode === "model" || prep.generationMode === "model_repaired";
  const hasResearch = record.interviewResearch?.status === "ready";
  const sourceLabel = isModel
    ? `AI 生成${prep.modelProvider ? ` · ${prep.modelProvider}` : ""}${hasResearch ? " · 联网研究" : ""}`
    : "基础准备";

  return (
    <section
      className={`rounded-2xl border px-5 py-4 text-sm leading-6 ${
        isModel
          ? "border-blue-100 bg-blue-50 text-blue-900"
          : "border-amber-100 bg-amber-50 text-amber-900"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">生成依据：{sourceLabel}</p>
          <p className="mt-1">
            {isModel
              ? "已基于当前保存的岗位资料、简历快照或补充信息生成。仍建议核对公司信息和个人经历是否准确。"
              : "当前缺少 JD、公司资料或简历快照，只提供基础面试准备题，不生成岗位深度问题。"}
          </p>
        </div>
      </div>
      {prep.riskNotes?.length ? (
        <ul className="mt-3 grid gap-1">
          {prep.riskNotes.map((note) => (
            <li key={note}>- {note}</li>
          ))}
        </ul>
      ) : null}
      {record.interviewResearch?.status === "failed" ? (
        <p className="mt-3">- 联网研究失败：{record.interviewResearch.errorMessage ?? "未获取到可用结果。"}</p>
      ) : null}
      {record.interviewResearch?.status === "ready" && record.interviewResearch.sources.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {record.interviewResearch.sources.slice(0, 3).map((source) => (
            <a
              key={source.url}
              className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs text-blue-700 hover:underline"
              href={source.url}
              rel="noreferrer"
              target="_blank"
            >
              {source.title || source.url}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function InterviewContextPanel({
  contextSaved,
  contextSavedAt,
  prep,
  record,
  researchAction,
  saveAction
}: {
  contextSaved: boolean;
  contextSavedAt?: string;
  prep: Awaited<ReturnType<typeof createInterviewPrepFromRecord>>;
  record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>;
  researchAction: () => Promise<void>;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const savedMessage = contextSaved ? getInterviewContextSavedMessage(prep.generationMode) : null;
  const savedTime = formatContextSavedAt(contextSavedAt);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#1677ff]">岗位资料</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1f1f1f]">补充 JD / 公司资料</h2>
          <p className="mt-2 text-sm leading-6 text-[#666]">
            粘贴 JD、岗位要求、公司产品信息，或先联网研究公司。资料越具体，准备内容越贴近当前岗位。
          </p>
        </div>
        <form action={researchAction}>
          <button
            className="rounded-full border border-[#1677ff] px-4 py-2 text-sm font-semibold text-[#1677ff] transition hover:bg-blue-50"
            type="submit"
          >
            联网研究公司
          </button>
        </form>
      </div>

      {savedMessage ? (
        <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
          <p>{savedMessage}</p>
          {savedTime ? (
            <p className="mt-1 text-xs text-emerald-700">上次保存：{savedTime}</p>
          ) : null}
        </div>
      ) : null}

      <form action={saveAction} className="mt-5 grid gap-3">
        <textarea
          className="min-h-36 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-7 text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
          defaultValue={record.interviewContextText ?? ""}
          name="interviewContextText"
          placeholder="粘贴 JD、岗位要求、公司产品介绍、招聘页面内容，或记录面试官已透露的信息。"
        />
        <InterviewContextSubmitButton />
      </form>
    </section>
  );
}

function formatContextSavedAt(value?: string) {
  if (!value) {
    return "";
  }

  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function formatInterviewTime(value?: string) {
  if (!value) {
    return "待确认";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "待确认";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function renderSourceLabel(sourceType: string) {
  switch (sourceType) {
    case "jd":
      return "JD";
    case "snapshot":
      return "快照";
    case "master_fact":
      return "事实";
    case "basic":
      return "基础题";
    default:
      return "推断";
  }
}
