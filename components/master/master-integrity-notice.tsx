const rules = [
  "只确认你能在面试里讲清楚、讲真实的第一手经历。",
  "不要把 AI 润色后的话，直接当成原始资料放进资料库。",
  "后面的简历、岗位匹配和职业方向，都依赖这一层资料是否干净。"
];

export function MasterIntegrityNotice() {
  return (
    <section className="rounded-[1.75rem] border border-accent/20 bg-accent/5 p-6 shadow-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">资料原则</p>
          <h2 className="mt-3 text-2xl font-semibold">资料库里的内容，必须真实、第一手、可复用。</h2>
        </div>
        <div className="rounded-full border border-accent/30 bg-white px-4 py-2 text-sm font-medium text-accent">
          需要确认
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
