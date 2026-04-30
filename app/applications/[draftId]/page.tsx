import { PersonalInfoEditor } from "@/components/applications/personal-info-editor";
import { SnapshotGenerateButton } from "@/components/applications/snapshot-generate-button";
import { SuggestionList } from "@/components/applications/suggestion-list";
import { getAnalysisWorkspaceData } from "@/lib/services/analysis/workspace-data";

export const dynamic = "force-dynamic";

type ApplicationWorkspacePageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

export default async function ApplicationWorkspacePage({ params }: ApplicationWorkspacePageProps) {
  const { draftId } = await params;
  const workspace = await getAnalysisWorkspaceData(draftId);

  return (
    <main className="min-h-screen px-6 py-8 md:px-10 overflow-x-hidden">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-[1.75rem] border border-white/70 bg-white/90 px-6 py-5 shadow-card">
          <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.85fr)_auto_minmax(360px,1.3fr)_auto] xl:items-center">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-accent">分析工作台</p>
              <h1 className="mt-2 truncate text-2xl font-semibold text-ink">
                {workspace.company} · {workspace.jobTitle}
              </h1>
            </div>

            <div className="rounded-2xl border border-accent/20 bg-accent/5 px-5 py-3 text-center">
              <p className="text-xs font-semibold tracking-[0.2em] text-accent">匹配度</p>
              <p className="mt-1 text-3xl font-bold text-ink">{workspace.summary.fitScore}</p>
            </div>

            <div className="min-w-0 rounded-2xl border border-line bg-paper px-5 py-3">
              <p className="text-xs font-semibold tracking-[0.2em] text-slate-500">岗位匹配优势</p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">
                {buildStrengthSummary(workspace.summary.strengths, workspace.summary.gaps)}
              </p>
            </div>

            <div className="flex justify-start xl:justify-end">
              <SnapshotGenerateButton
                acceptedSuggestionCount={workspace.suggestions.filter((s) => s.status === "accepted").length}
                draftId={draftId}
                totalSuggestionCount={workspace.suggestions.length}
                variant="inline"
              />
            </div>
          </div>
        </header>

        <section className="flex min-w-0 flex-col gap-5">
          <PersonalInfoEditor draftId={draftId} personalInfo={workspace.calibratedResume?.personalInfo} />
          <SuggestionList draftId={draftId} suggestions={workspace.suggestions} />
        </section>
      </section>
    </main>
  );
}

function buildStrengthSummary(strengths: string[], gaps: string[]) {
  const source = [...strengths, ...gaps].join(" ");
  const capabilities = [
    source.match(/Prompt|提示词|LLM|大模型|AI 工具|AI工具/u) ? "AI 工具与 Prompt 应用" : "",
    source.match(/产品|需求|MVP|流程|工作流|迭代/u) ? "产品流程与需求拆解" : "",
    source.match(/数据|Excel|Tableau|分析|指标/u) ? "数据分析与结果表达" : "",
    source.match(/运营|内容|小红书|公众号|传播/u) ? "内容运营与用户沟通" : "",
    source.match(/客户|B 端|协作|方案|交付/u) ? "B 端沟通与方案推进" : ""
  ].filter(Boolean);

  if (capabilities.length > 0) {
    return `${capabilities.slice(0, 3).join("、")}，这些能力与当前岗位要求有直接交集。`;
  }

  return "当前材料已有可迁移经历，但仍需要围绕 JD 的关键动作、结果和协作方式继续压实证据。";
}
