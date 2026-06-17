import Link from "next/link";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";
import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { readSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { draftId } = await params;
  const [snapshot, draft] = await Promise.all([
    readSnapshotForDraft(draftId),
    readWorkspaceDraft(draftId)
  ]);

  return (
    <main className="min-h-screen bg-[#e8e2d6] px-4 py-6">
      <section className="mx-auto flex max-w-[960px] flex-col gap-4">
        {snapshot ? (
          <PreviewWorkspace
            canCreateApplicationRecord={Boolean(draft?.company.trim())}
            draftId={draftId}
            initialDocument={snapshot}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-paper p-6 text-sm leading-7 text-slate-700">
            <p>还没有生成简历初版。先回到分析工作台确认修改建议，再回来预览和导出。</p>
            <Link
              className="mt-4 inline-flex rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent"
              href={`/applications/${draftId}`}
            >
              返回分析工作台
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
