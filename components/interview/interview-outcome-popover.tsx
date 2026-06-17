import React from "react";
import type { ApplicationRecord } from "@/lib/services/applications/application-record-service";

export function InterviewOutcomePopover({
  record,
  saveAction,
  triggerLabel
}: {
  record: ApplicationRecord;
  saveAction: (formData: FormData) => Promise<void>;
  triggerLabel: string;
}) {
  return (
    <details className="group relative">
      <summary className="list-none cursor-pointer text-sm text-[#1677ff] hover:underline">
        {triggerLabel}
      </summary>
      <div className="absolute right-0 z-30 mt-3 w-[min(88vw,520px)] rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#1677ff]">面试进展</p>
            <h3 className="mt-1 text-lg font-semibold text-[#1f1f1f]">记录结果和下一轮安排</h3>
            <p className="mt-2 text-sm leading-6 text-[#666]">
              {record.interviewAt ? `最近一场：${formatInterviewTime(record.interviewAt)}` : "暂无面试时间"}
              {record.interviewRound ? ` · ${record.interviewRound}` : ""}
              {record.interviewNotes ? ` · ${record.interviewNotes}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            跟进
          </span>
        </div>

        <form action={saveAction} className="mt-5 grid gap-4">
          <input type="hidden" name="recordId" value={record.id} />
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#666]" htmlFor={`interview-outcome-${record.id}`}>
              面试结果
            </label>
            <select
              id={`interview-outcome-${record.id}`}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
              name="interviewOutcome"
              defaultValue={record.interviewOutcome ?? "pending"}
            >
              <option value="pending">等待反馈</option>
              <option value="next_round">进入下一轮</option>
              <option value="passed">已通过，待安排</option>
              <option value="rejected">未通过 / 不继续</option>
              <option value="no_feedback">无反馈，先归档</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#666]" htmlFor={`next-interview-at-${record.id}`}>
              下一轮时间
            </label>
            <input
              id={`next-interview-at-${record.id}`}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
              name="nextInterviewAt"
              type="datetime-local"
              defaultValue={formatDateTimeLocal(record.nextInterviewAt)}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#666]" htmlFor={`interview-follow-up-notes-${record.id}`}>
              跟进记录
            </label>
            <textarea
              id={`interview-follow-up-notes-${record.id}`}
              className="min-h-24 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
              name="interviewFollowUpNotes"
              defaultValue={record.interviewFollowUpNotes ?? ""}
              placeholder="记录面试反馈、需要补发的材料、下一轮重点或 HR 沟通信息。"
            />
          </div>
          <button
            className="w-fit rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-900"
            type="submit"
          >
            保存面试进展
          </button>
        </form>
      </div>
    </details>
  );
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

function formatDateTimeLocal(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
