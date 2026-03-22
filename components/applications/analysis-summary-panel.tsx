import React from "react";
import type { WorkspaceMasterFactReference, WorkspaceSummary } from "@/lib/services/analysis/workspace-data";

type AnalysisSummaryPanelProps = {
  summary: WorkspaceSummary;
  masterFactsUsed: WorkspaceMasterFactReference[];
  talentProfileUsed?: {
    id: string;
    headline: string;
    confidenceNote: string;
  };
  careerDirectionUsed?: {
    id: string;
    slug: string;
    label: string;
    rationale: string;
    watchOut: string;
  };
};

export function AnalysisSummaryPanel({
  summary,
  masterFactsUsed,
  talentProfileUsed,
  careerDirectionUsed
}: AnalysisSummaryPanelProps) {
  const verdict = getVerdict(summary.fitScore);

  return (
    <section className="rounded-2xl border border-line bg-white/85 p-5 shadow-card">
      <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-accent">匹配度</p>
        <p className="mt-1 text-3xl font-bold text-ink">{summary.fitScore}</p>
        <p className="mt-1 text-xs text-slate-500">{verdict.label}</p>
      </div>

      <p className="mt-4 rounded-xl bg-paper px-3 py-2 text-sm leading-6 text-slate-700">{verdict.message}</p>

      <div className="mt-4 space-y-3">
        <CompactList title="优势" items={summary.strengths} />
        <CompactList title="待加强" items={summary.gaps} />
        <CompactList title="风险提示" items={summary.riskNotes} />
      </div>
    </section>
  );
}

function CompactList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item}`} className="rounded-lg bg-paper px-3 py-1.5 text-xs leading-5 text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function getVerdict(fitScore: number) {
  if (fitScore >= 85) {
    return {
      label: "高匹配",
      message: "你和这个岗位的核心要求高度吻合，有足够的证据支撑竞争力。"
    };
  }

  if (fitScore >= 72) {
    return {
      label: "可竞争",
      message: "你具备胜任这个岗位的能力，关键在于如何更清晰地表达你的优势。"
    };
  }

  if (fitScore >= 60) {
    return {
      label: "需加强",
      message: "存在一定重合，但还需要更强有力的证据来证明你已经准备好了。"
    };
  }

  return {
    label: "待补充",
    message: "当前材料还不足以让这个岗位的招聘方确信你是合适的候选人。"
  };
}
