import type { MasterFactSummary } from "@/lib/services/master/master-service";

type MasterFactListProps = {
  facts: MasterFactSummary[];
};

export function MasterFactList({ facts }: MasterFactListProps) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Confirmed Facts</p>
          <h2 className="mt-3 text-2xl font-semibold">Fact Master</h2>
        </div>
        <div className="rounded-full border border-line px-4 py-2 text-sm text-slate-600">{facts.length} blocks</div>
      </div>

      <div className="mt-6 space-y-4">
        {facts.map((fact) => (
          <article key={fact.id} className="rounded-[1.4rem] border border-line bg-paper p-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">{fact.title}</h3>
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">{fact.blockType}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{fact.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
