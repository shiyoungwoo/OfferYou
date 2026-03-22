import { AnalysisSummaryPanel } from "@/components/applications/analysis-summary-panel";
import { ProgressStageBar } from "@/components/applications/progress-stage-bar";
import { SnapshotGenerateButton } from "@/components/applications/snapshot-generate-button";
import { SnapshotOutlinePanel } from "@/components/applications/snapshot-outline-panel";
import { SuggestionList } from "@/components/applications/suggestion-list";
import { getAnalysisWorkspaceData } from "@/lib/services/analysis/workspace-data";

type ApplicationWorkspacePageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

export default async function ApplicationWorkspacePage({ params }: ApplicationWorkspacePageProps) {
  const { draftId } = await params;
  const workspace = await getAnalysisWorkspaceData(draftId);

  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-2xl border border-white/70 bg-white/85 px-6 py-5 shadow-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-accent">分析工作台</p>
              <h1 className="mt-2 text-2xl font-semibold">{workspace.company} · {workspace.jobTitle}</h1>
            </div>
            <ProgressStageBar stage={workspace.stage} />
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[3fr_1fr]">
          <SuggestionList draftId={draftId} suggestions={workspace.suggestions} />

          <aside className="flex flex-col gap-5">
            <AnalysisSummaryPanel
              careerDirectionUsed={workspace.careerDirectionUsed}
              masterFactsUsed={workspace.masterFactsUsed}
              summary={workspace.summary}
              talentProfileUsed={workspace.talentProfileUsed}
            />
            <SnapshotGenerateButton
              acceptedSuggestionCount={workspace.suggestions.filter((s) => s.status === "accepted").length}
              draftId={draftId}
              totalSuggestionCount={workspace.suggestions.length}
            />
            <SnapshotOutlinePanel snapshot={workspace.snapshot} />
          </aside>
        </section>
      </section>
    </main>
  );
}
