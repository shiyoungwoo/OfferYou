import React from "react";

const stages = [
  { key: "intake", label: "输入" },
  { key: "analysis_ready", label: "分析" },
  { key: "revising", label: "修改" },
  { key: "snapshot_ready", label: "快照" },
  { key: "preview_ready", label: "预览" },
  { key: "export_ready", label: "导出" }
] as const;

type ProgressStageBarProps = {
  stage: string;
};

export function ProgressStageBar({ stage }: ProgressStageBarProps) {
  const activeIndex = stages.findIndex((item) => item.key === stage);

  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((item, index) => {
        const isComplete = activeIndex >= 0 && index <= activeIndex;
        return (
          <span
            key={item.key}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              isComplete ? "bg-accent text-white" : "border border-line bg-paper text-slate-500"
            }`}
          >
            {item.label}
          </span>
        );
      })}
    </div>
  );
}
