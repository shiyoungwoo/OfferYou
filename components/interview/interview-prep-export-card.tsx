"use client";

import React, { useState } from "react";
import { CheckCircle2, Copy, ListChecks, Star } from "lucide-react";

type InterviewPrepExportCardProps = {
  company: string;
  jobTitle: string;
  exportText: string;
  checklistItems: string[];
  favoriteQuestionCount: number;
  answeredQuestionCount: number;
  questionCount: number;
};

export function InterviewPrepExportCard({
  company,
  jobTitle,
  exportText,
  checklistItems,
  favoriteQuestionCount,
  answeredQuestionCount,
  questionCount
}: InterviewPrepExportCardProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copyExportText() {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-[#1677ff]">面试准备总览</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1f1f1f]">{company} · {jobTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#666]">
            面试前先把自我介绍、重点问题和答案草稿整理好。需要临时查看时，可以复制一份面试卡片到备忘录。
          </p>
        </div>

        <button
          className="inline-flex items-center gap-2 rounded-full bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-900"
          onClick={copyExportText}
          type="button"
        >
          <Copy size={16} />
          复制面试卡片
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <PrepStat
          icon={<ListChecks size={18} />}
          label="已写答案"
          value={`${answeredQuestionCount} / ${questionCount}`}
        />
        <PrepStat
          icon={<Star size={18} />}
          label="收藏问题"
          value={String(favoriteQuestionCount)}
        />
        <PrepStat
          icon={<CheckCircle2 size={18} />}
          label="当前状态"
          value={answeredQuestionCount > 0 ? "准备中" : "待填写"}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.72fr]">
        <section className="rounded-[1.5rem] border border-gray-100 bg-gray-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1f1f1f]">
            <CheckCircle2 size={16} className="text-accent" />
            面试前复盘清单
          </div>

          <ul className="mt-4 grid gap-3 text-sm leading-6 text-[#4b5563]">
            {checklistItems.map((item) => (
              <li key={item} className="rounded-[1rem] border border-gray-100 bg-white px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[1.5rem] border border-gray-100 bg-white p-5">
          <p className="text-sm font-semibold text-[#1f1f1f]">快速带走</p>
          <p className="mt-2 text-sm leading-6 text-[#666]">
            复制后可粘贴到备忘录、微信文件传输助手或面试前提醒里。
          </p>
          <div className="mt-4 rounded-[1rem] border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[#666]">
            {copyStatus === "copied" ? "已复制，可粘贴到备忘录。" : copyStatus === "error" ? "复制失败，请稍后重试。" : "点击「复制面试卡片」即可。"}
          </div>
        </section>
      </div>
    </section>
  );
}

function PrepStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-gray-100 bg-gray-50 px-4 py-4">
      <div className="flex items-center gap-2 text-[#1677ff]">
        {icon}
        <span className="text-xs font-semibold text-[#666]">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#1f1f1f]">{value}</p>
    </div>
  );
}
