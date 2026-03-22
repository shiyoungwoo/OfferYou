import React from "react";
import type { WorkspaceSnapshotOutline } from "@/lib/services/analysis/workspace-data";

type SnapshotOutlinePanelProps = {
  snapshot: WorkspaceSnapshotOutline;
};

export function SnapshotOutlinePanel({ snapshot }: SnapshotOutlinePanelProps) {
  return (
    <section className="rounded-2xl border border-line bg-white/85 p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">快照大纲</p>
        <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs text-slate-600">
          预估 {snapshot.pageEstimate} 页
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {snapshot.sections.map((section) => (
          <div key={section.title} className="rounded-xl bg-paper px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{section.title}</p>
              <span className="text-xs text-slate-500">{section.itemCount} 项</span>
            </div>
            <ul className="mt-1 space-y-1">
              {section.items.map((item, index) => (
                <li key={`${section.title}-${index}-${item}`} className="text-xs leading-5 text-slate-600">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
