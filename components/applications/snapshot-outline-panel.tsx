import React from "react";
import type { WorkspaceSnapshotOutline } from "@/lib/services/analysis/workspace-data";

type SnapshotOutlinePanelProps = {
  snapshot: WorkspaceSnapshotOutline;
};

export function SnapshotOutlinePanel({ snapshot }: SnapshotOutlinePanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Snapshot Outline</p>
          <h2 className="mt-3 text-2xl font-semibold">Current derived structure</h2>
        </div>
        <div className="rounded-[1.2rem] border border-line bg-paper px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Page Estimate</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{snapshot.pageEstimate}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {snapshot.sections.map((section) => (
          <article key={section.title} className="rounded-[1.35rem] border border-line bg-paper p-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold">{section.title}</h3>
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{section.itemCount} items</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {section.items.map((item) => (
                <li key={item} className="rounded-xl bg-white px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
