const rules = [
  "Only confirm first-hand facts you can defend in an interview.",
  "Do not let AI-generated language enter the Master as if it were source material.",
  "Every later snapshot depends on the cleanliness of this layer."
];

export function MasterIntegrityNotice() {
  return (
    <section className="rounded-[1.75rem] border border-accent/20 bg-accent/5 p-6 shadow-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Integrity Notice</p>
          <h2 className="mt-3 text-2xl font-semibold">Master facts must stay first-hand, real, and reusable.</h2>
        </div>
        <div className="rounded-full border border-accent/30 bg-white px-4 py-2 text-sm font-medium text-accent">
          Confirmation Required
        </div>
      </div>

      <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
        {rules.map((rule) => (
          <li key={rule} className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
            {rule}
          </li>
        ))}
      </ul>
    </section>
  );
}
