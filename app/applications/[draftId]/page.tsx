import { AnalysisSummaryPanel } from "@/components/applications/analysis-summary-panel";
import { ProgressStageBar } from "@/components/applications/progress-stage-bar";
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
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Analysis Workspace</p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold">{workspace.company}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {workspace.jobTitle} · draft {draftId}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-line bg-paper px-5 py-4 text-sm leading-6 text-slate-700">
              JD flow focus: keep the user in control, isolate accepted changes, and prepare a clean snapshot for
              preview.
            </div>
          </div>
        </header>

        <ProgressStageBar stage={workspace.stage} />

        <section className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr_1fr]">
          <AnalysisSummaryPanel summary={workspace.summary} />
          <SuggestionList suggestions={workspace.suggestions} />
          <SnapshotOutlinePanel snapshot={workspace.snapshot} />
        </section>
      </section>
    </main>
  );
}
