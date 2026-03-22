import React from "react";
import type { MasterFactSummary } from "@/lib/services/master/master-service";

type MasterFactListProps = {
  facts: Array<
    MasterFactSummary & {
      impactedApplicationCount: number;
      latestUsage: {
        company: string;
        jobTitle: string;
        appliedAt: string;
      } | null;
    }
  >;
};

export function MasterFactList({ facts }: MasterFactListProps) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">已确认资料</p>
          <h2 className="mt-3 text-2xl font-semibold">我的经历资料</h2>
        </div>
        <div className="rounded-full border border-line px-4 py-2 text-sm text-slate-600">{facts.length} 条资料</div>
      </div>

      <div className="mt-6 space-y-4">
        {facts.length > 0 ? (
          facts.map((fact) => (
            <article key={fact.id} className="rounded-[1.4rem] border border-line bg-paper p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{fact.title}</h3>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    已用于 {fact.impactedApplicationCount} 次申请
                  </p>
                  {fact.latestUsage ? (
                    <p className="mt-2 text-sm text-slate-600">
                      最近一次用于 {fact.latestUsage.company} · {fact.latestUsage.jobTitle}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{fact.blockType}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{fact.summary}</p>
            </article>
          ))
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-line bg-paper p-5 text-sm leading-6 text-slate-700">
            还没有确认过的经历资料。你可以先去确认待审核的事实，或者从真实经历中继续补充。
          </div>
        )}
      </div>
    </section>
  );
}
