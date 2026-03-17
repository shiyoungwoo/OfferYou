import React from "react";

const stages = ["intake", "analysis_ready", "revising", "snapshot_ready", "preview_ready", "export_ready"] as const;

type ProgressStageBarProps = {
  stage: (typeof stages)[number] | string;
};

export function ProgressStageBar({ stage }: ProgressStageBarProps) {
  const activeIndex = stages.findIndex((item) => item === stage);

  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-5 shadow-card">
      <div className="flex flex-wrap gap-3">
        {stages.map((item, index) => {
          const isComplete = activeIndex >= 0 && index <= activeIndex;
          return (
            <div
              key={item}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                isComplete ? "border-accent bg-accent text-white" : "border-line bg-paper text-slate-600"
              }`}
            >
              {item}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        Current stage: <span className="font-semibold text-ink">{stage}</span>
      </p>
    </section>
  );
}
