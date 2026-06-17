import React from "react";
import { Plus } from "lucide-react";

type SchedulableRecord = {
  id: string;
  company: string;
  jobTitle: string;
};

type AddInterviewScheduleFormProps = {
  records: SchedulableRecord[];
  scheduleAction: (formData: FormData) => void | Promise<void>;
};

export function AddInterviewScheduleForm({ records, scheduleAction }: AddInterviewScheduleFormProps) {
  return (
    <div className="relative">
      <input className="peer sr-only" id="add-interview-schedule" type="checkbox" />
      <label
        className="flex cursor-pointer items-center rounded-lg bg-[#1677ff] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1677ff]/90"
        htmlFor="add-interview-schedule"
        role="button"
        tabIndex={0}
      >
        <Plus size={14} className="mr-1" />
        添加面试
      </label>

      <div className="absolute right-0 z-20 mt-3 hidden w-[min(24rem,calc(100vw-3rem))] rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.16)] peer-checked:block">
        <form action={scheduleAction} className="grid gap-4">
          {records.length > 0 && (
            <div>
              <label
                className="mb-2 block text-xs font-semibold text-[#666]"
                htmlFor="interview-record-id"
              >
                关联岗位记录（可选）
              </label>
              <select
                id="interview-record-id"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
                name="recordId"
              >
                <option value="">不关联，手动记录面试</option>
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.company || "未命名公司"} · {record.jobTitle || "未命名岗位"}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold text-[#666]" htmlFor="interview-company">
                公司名称
              </label>
              <input
                id="interview-company"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
                name="company"
                placeholder="如：月之暗面"
                required={records.length === 0}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold text-[#666]" htmlFor="interview-job-title">
                岗位名称
              </label>
              <input
                id="interview-job-title"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
                name="jobTitle"
                placeholder="如：AI 产品经理"
                required={records.length === 0}
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#666]" htmlFor="interview-at">
              面试时间
            </label>
            <input
              id="interview-at"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
              name="interviewAt"
              type="datetime-local"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#666]" htmlFor="interview-round">
              面试轮次
            </label>
            <input
              id="interview-round"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
              name="interviewRound"
              placeholder="如：一面 / 二面 / HR 面"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#666]" htmlFor="interview-notes">
              备注
            </label>
            <textarea
              id="interview-notes"
              className="min-h-20 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-[#1f1f1f] outline-none transition focus:border-[#1677ff]"
              name="interviewNotes"
              placeholder="可补充 JD、公司信息、会议形式、需要准备的作品集或重点问题"
            />
          </div>
          <button
            className="rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-900"
            type="submit"
          >
            保存面试安排
          </button>
        </form>
      </div>
    </div>
  );
}
