const quickCards = [
  {
    title: "Master Workspace",
    body: "Confirm first-hand facts, review insight candidates, and protect the integrity of the source resume."
  },
  {
    title: "Applications",
    body: "Create new application drafts, review JD fit, and manage snapshot-based tailoring runs."
  },
  {
    title: "A4 Preview",
    body: "Use one shared document renderer for multi-page preview and final PDF export."
  }
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-card backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">OfferYou V2</p>
          <div className="mt-4 grid gap-6 md:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
                Productized MVP dashboard for snapshot-safe resume tailoring.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-700">
                The first runnable release will turn the existing protocol and prompt design into a Web workflow:
                import, analyze, revise, snapshot, preview, export, and record.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-line bg-paper p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Current focus</p>
              <p className="mt-4 text-2xl font-semibold">Foundation Buildout</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                App shell, storage adapter, Prisma schema, and the first route surfaces are being wired now.
              </p>
            </div>
          </div>
        </div>

        <section className="grid gap-5 md:grid-cols-3">
          {quickCards.map((card) => (
            <article key={card.title} className="rounded-[1.5rem] border border-line bg-white/85 p-6 shadow-card">
              <h2 className="text-xl font-semibold">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{card.body}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
