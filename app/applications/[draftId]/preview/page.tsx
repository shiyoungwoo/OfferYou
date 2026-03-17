import { ExportPdfButton } from "@/components/preview/export-pdf-button";
import { ResumePreview } from "@/components/preview/resume-preview";
import { TemplateSwitcher } from "@/components/preview/template-switcher";
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
    <main className="min-h-screen bg-[#ebe5d8] px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-card">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Preview</p>
          <h1 className="mt-4 text-4xl font-semibold">A4 snapshot preview</h1>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            This page is backed by the generated snapshot document and will become the shared source for PDF export.
          </p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <aside className="grid content-start gap-4">
            <TemplateSwitcher currentTemplate={snapshot?.templateKey ?? "template_a"} />
            <ExportPdfButton draftId={draftId} />
          </aside>

          {snapshot ? (
            <ResumePreview document={snapshot} />
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-line bg-paper p-6 text-sm leading-7 text-slate-700">
              No snapshot exists yet for this draft. Return to the analysis workspace and generate one first.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
