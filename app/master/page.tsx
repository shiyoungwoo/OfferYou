import { FactSubmissionReviewCard } from "@/components/master/fact-submission-review-card";
import { MasterFactList } from "@/components/master/master-fact-list";
import { MasterInsightList } from "@/components/master/master-insight-list";
import { MasterIntegrityNotice } from "@/components/master/master-integrity-notice";
import { getDefaultUserContext } from "@/lib/default-user";
import { listPendingFactSubmissions } from "@/lib/services/master/fact-submission-service";
import { listMasterFacts, listMasterInsights } from "@/lib/services/master/master-service";

export default async function MasterPage() {
  const { userId } = getDefaultUserContext();
  const facts = listMasterFacts(userId);
  const insights = listMasterInsights(userId);
  const pendingSubmissions = await listPendingFactSubmissions();

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

        <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Fact Review Queue</p>
              <h2 className="mt-3 text-2xl font-semibold">Pending fact submissions</h2>
            </div>
            <div className="rounded-full border border-line px-4 py-2 text-sm text-slate-600">
              {pendingSubmissions.length} pending
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {pendingSubmissions.length > 0 ? (
              pendingSubmissions.map((submission) => (
                <FactSubmissionReviewCard key={submission.id} submission={submission} />
              ))
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-line bg-paper p-5 text-sm leading-6 text-slate-700">
                No pending fact submissions yet.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
