import Link from "next/link";
import { FactSubmissionReviewCard } from "@/components/master/fact-submission-review-card";
import { MasterFactList } from "@/components/master/master-fact-list";
import { MasterInsightList } from "@/components/master/master-insight-list";
import { MasterIntegrityNotice } from "@/components/master/master-integrity-notice";
import { getDefaultUserContext } from "@/lib/default-user";
import { listApplicationRecords } from "@/lib/services/applications/application-record-service";
import { listPendingFactSubmissions } from "@/lib/services/master/fact-submission-service";
import { listMasterFacts, listMasterInsights } from "@/lib/services/master/master-service";

export default async function MasterPage() {
  const { userId } = getDefaultUserContext();
  const facts = await listMasterFacts(userId);
  const records = await listApplicationRecords();
  const insights = listMasterInsights(userId);
  const pendingSubmissions = await listPendingFactSubmissions();
  const factUsageCount = new Map<string, number>();
  const latestFactUsage = new Map<
    string,
    {
      company: string;
      jobTitle: string;
      appliedAt: string;
    }
  >();

  for (const record of records) {
    for (const fact of record.reusedMasterFacts) {
      factUsageCount.set(fact.id, (factUsageCount.get(fact.id) ?? 0) + 1);

      const existingLatest = latestFactUsage.get(fact.id);
      if (!existingLatest || new Date(record.appliedAt).getTime() > new Date(existingLatest.appliedAt).getTime()) {
        latestFactUsage.set(fact.id, {
          company: record.company,
          jobTitle: record.jobTitle,
          appliedAt: record.appliedAt
        });
      }
    }
  }

  const factsWithUsage = facts.map((fact) => ({
    ...fact,
    impactedApplicationCount: factUsageCount.get(fact.id) ?? 0,
    latestUsage: latestFactUsage.get(fact.id) ?? null
  }));

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accent">我的 / 资料库详情</p>
              <h1 className="mt-4 text-4xl font-semibold">把真实经历、洞察和可复用资料沉淀在这里。</h1>
            </div>
            <Link
              className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
              href="/me"
            >
              返回我的
            </Link>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
            这是你的资料库详情页。这里沉淀的是你真正确认过的经历事实，以及从这些事实里抽出来的洞察候选。资料越干净，后面的简历、匹配和职业方向就越可靠。
          </p>
        </header>

        <MasterIntegrityNotice />

        <div className="grid gap-6 lg:grid-cols-2">
          <MasterFactList facts={factsWithUsage} />
          <MasterInsightList insights={insights} />
        </div>

        <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">待确认资料</p>
              <h2 className="mt-3 text-2xl font-semibold">等待确认的经历事实</h2>
            </div>
            <div className="rounded-full border border-line px-4 py-2 text-sm text-slate-600">
              {pendingSubmissions.length} 条待确认
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {pendingSubmissions.length > 0 ? (
              pendingSubmissions.map((submission) => (
                <FactSubmissionReviewCard key={submission.id} submission={submission} />
              ))
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-line bg-paper p-5 text-sm leading-6 text-slate-700">
                目前还没有待确认的资料。
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
