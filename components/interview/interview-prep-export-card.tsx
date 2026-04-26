"use client";

import React, { useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";

type InterviewPrepExportCardProps = {
  company: string;
  jobTitle: string;
  exportText: string;
  checklistItems: string[];
  favoriteQuestionCount: number;
  answeredQuestionCount: number;
};

export function InterviewPrepExportCard({
  company,
  jobTitle,
  exportText,
  checklistItems,
  favoriteQuestionCount,
  answeredQuestionCount
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
    <section className="rounded-[1.75rem] border border-line bg-white/90 p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">面试准备导出</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">一段可复制的复盘文本</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-700">
            这里把公司、岗位、自我介绍、收藏问题和已填写答案整理成一段 Markdown 文本，方便面试前快速回看。
          </p>
        </div>

        <button
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
          onClick={copyExportText}
          type="button"
        >
          <Copy size={16} />
          复制复盘文本
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full border border-line bg-paper px-3 py-1">公司：{company}</span>
        <span className="rounded-full border border-line bg-paper px-3 py-1">岗位：{jobTitle}</span>
        <span className="rounded-full border border-line bg-paper px-3 py-1">收藏问题：{favoriteQuestionCount}</span>
        <span className="rounded-full border border-line bg-paper px-3 py-1">答案草稿：{answeredQuestionCount}</span>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_0.82fr]">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          导出文本
          <textarea
            aria-label="面试准备导出文本"
            className="min-h-72 rounded-[1.25rem] border border-line bg-paper px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-accent"
            readOnly
            value={exportText}
          />
        </label>

        <section className="rounded-[1.5rem] border border-line bg-paper p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CheckCircle2 size={16} className="text-accent" />
            面试前复盘清单
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            导出前先按这几项确认一遍，能减少临场遗漏。
          </p>

          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            {checklistItems.map((item) => (
              <li key={item} className="rounded-[1rem] border border-line bg-white px-4 py-3">
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-[1rem] border border-dashed border-line bg-white px-4 py-3 text-sm text-slate-600">
            {copyStatus === "copied" ? "已复制到剪贴板。" : copyStatus === "error" ? "复制失败，请手动选择文本。" : "点击上方按钮即可复制。"}
          </div>
        </section>
      </div>
    </section>
  );
}
