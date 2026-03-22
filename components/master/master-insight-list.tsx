import type { MasterInsightSummary } from "@/lib/services/master/master-service";

type MasterInsightListProps = {
  insights: MasterInsightSummary[];
};

export function MasterInsightList({ insights }: MasterInsightListProps) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">洞察候选</p>
          <h2 className="mt-3 text-2xl font-semibold">从资料里长出来的可能优势</h2>
        </div>
        <div className="rounded-full border border-line px-4 py-2 text-sm text-slate-600">{insights.length} 条候选</div>
      </div>

      <div className="mt-6 space-y-4">
        {insights.length > 0 ? (
          insights.map((insight) => (
            <article key={insight.id} className="rounded-[1.4rem] border border-line bg-paper p-5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold">{insight.title}</h3>
                <span className="text-xs uppercase tracking-[0.24em] text-accent">{insight.status}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{insight.insightText}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">
                证据来源: {insight.evidenceLabels.join(" / ")}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-line bg-paper p-5 text-sm leading-6 text-slate-700">
            还没有新的洞察候选。随着资料库变完整，这里会逐步长出更值得你关注的优势线索。
          </div>
        )}
      </div>
    </section>
  );
}
