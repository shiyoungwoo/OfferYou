import { PreviewWorkspace } from "@/components/preview/preview-workspace";
import { readSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";

type PreviewPageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { draftId } = await params;
  const snapshot = await readSnapshotForDraft(draftId);

  return (
    <main className="min-h-screen bg-[#e8e2d6] px-4 py-6">
      <section className="mx-auto flex max-w-[960px] flex-col gap-4">
        {snapshot ? (
          <PreviewWorkspace draftId={draftId} initialDocument={snapshot} />
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-paper p-6 text-sm leading-7 text-slate-700">
            还没有生成简历初版。先回到分析工作台确认修改建议，再回来预览和导出。
          </div>
        )}
      </section>
    </main>
  );
}
