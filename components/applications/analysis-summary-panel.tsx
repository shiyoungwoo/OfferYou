import React from "react";
import type { WorkspaceSummary } from "@/lib/services/analysis/workspace-data";

type AnalysisSummaryPanelProps = {
  summary: WorkspaceSummary;
};

export function AnalysisSummaryPanel({ summary }: AnalysisSummaryPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Gap Analysis</p>
          <h2 className="mt-3 text-2xl font-semibold">Fit summary</h2>
        </div>
        <div className="rounded-[1.2rem] border border-accent/20 bg-accent/5 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.24em] text-accent">Match Score</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{summary.fitScore}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5">
        <SummaryList title="Strengths" items={summary.strengths} />
        <SummaryList title="Gaps" items={summary.gaps} />
        <SummaryList title="Risk Notes" items={summary.riskNotes} />
      </div>
    </section>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[1.3rem] border border-line bg-paper p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="rounded-xl bg-white px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
