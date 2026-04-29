import React from "react";
type SelfUseReadinessCardProps = {
  applicationRecordCount: number;
  interviewPrepCount: number;
  hasFixtureReport: boolean;
  fixturePdfCount: number;
};

export function SelfUseReadinessCard({
  applicationRecordCount,
  interviewPrepCount,
  hasFixtureReport,
  fixturePdfCount
}: SelfUseReadinessCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <p className="text-sm uppercase tracking-[0.24em] text-slate-500">自用试跑状态</p>
      <h2 className="mt-3 text-2xl font-semibold">当前更接近哪种可用状态</h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        这块只看真实能拿来用的材料，不看概念口号。目标是让下一次改简历、准备面试时能直接回到可复查的上下文。
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Metric label="最近简历记录数" value={String(applicationRecordCount)} />
        <Metric label="面试准备记录数" value={String(interviewPrepCount)} />
        <Metric label="样本导出报告" value={hasFixtureReport ? "已生成" : "未生成"} />
        <Metric label="可复查 PDF 数量" value={String(fixturePdfCount)} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-line bg-paper px-4 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
