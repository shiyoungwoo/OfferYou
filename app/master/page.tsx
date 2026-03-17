import { MasterFactList } from "@/components/master/master-fact-list";
import { MasterInsightList } from "@/components/master/master-insight-list";
import { MasterIntegrityNotice } from "@/components/master/master-integrity-notice";
import { getDefaultUserContext } from "@/lib/default-user";
import { listMasterFacts, listMasterInsights } from "@/lib/services/master/master-service";

export default function MasterPage() {
  const { userId } = getDefaultUserContext();
  const facts = listMasterFacts(userId);
  const insights = listMasterInsights(userId);

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Master Workspace</p>
          <h1 className="mt-4 text-4xl font-semibold">Keep the fact base clean before any snapshot is derived.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
            This page is the long-term source-of-truth surface for OfferYou. Facts require explicit confirmation.
            Insights stay separate from facts and can be reused only after user confirmation.
          </p>
        </header>

        <MasterIntegrityNotice />

        <div className="grid gap-6 lg:grid-cols-2">
          <MasterFactList facts={facts} />
          <MasterInsightList insights={insights} />
        </div>
      </section>
    </main>
  );
}
