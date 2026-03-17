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
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-card">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Preview</p>
          <h1 className="mt-4 text-4xl font-semibold">A4 snapshot preview</h1>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            This page is backed by the generated snapshot document and will become the shared source for PDF export.
          </p>
        </header>

        <article className="mx-auto w-full max-w-[794px] rounded-[1.5rem] border border-slate-300 bg-white p-10 shadow-[0_30px_60px_rgba(18,32,47,0.16)]">
          {snapshot ? (
            <div className="grid gap-8">
              <header className="border-b border-line pb-6">
                <h2 className="text-3xl font-semibold">{snapshot.header.name}</h2>
                <p className="mt-3 text-lg text-accent">{snapshot.header.title}</p>
                <p className="mt-3 text-sm text-slate-600">{snapshot.header.meta.join(" · ")}</p>
              </header>

              {snapshot.sections.map((section) => (
                <section key={section.id} className="grid gap-3">
                  <h3 className="text-lg font-semibold uppercase tracking-[0.2em] text-slate-500">{section.title}</h3>
                  <ul className="grid gap-3">
                    {section.items.map((item) => (
                      <li key={item} className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm leading-6 text-slate-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-line bg-paper p-6 text-sm leading-7 text-slate-700">
              No snapshot exists yet for this draft. Return to the analysis workspace and generate one first.
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
