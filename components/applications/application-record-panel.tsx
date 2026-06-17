import Link from "next/link";
import type { ApplicationRecord } from "@/lib/services/applications/application-record-service";

type ApplicationRecordPanelProps = {
  record: ApplicationRecord;
};

export function ApplicationRecordPanel({ record }: ApplicationRecordPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <p className="text-sm uppercase tracking-[0.24em] text-slate-500">投递记录</p>
      <h1 className="mt-4 text-4xl font-semibold">{record.company}</h1>
      <p className="mt-3 text-lg text-accent">{record.jobTitle}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <RecordCard label="投递时间" value={record.appliedAt} />
        <RecordCard label="已接受建议" value={String(record.acceptedSuggestionCount)} />
        <RecordCard label="草稿 ID" value={record.draftId} />
        <RecordCard label="快照 ID" value={record.snapshotId} />
        <RecordCard label="面试状态" value={renderInterviewStatus(record.interviewStatus)} />
      </div>

      <div className="mt-6 rounded-[1.35rem] border border-line bg-paper p-5 text-sm leading-6 text-slate-700">
        导出文件：{record.exportStoragePath ?? "尚未导出 PDF。"}
      </div>

      <div className="mt-6 rounded-[1.35rem] border border-line bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">面试准备</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">从这条投递记录进入面试准备</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              系统会自动带入公司、岗位、快照和已确认事实，避免重复输入。
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
            href={`/prep?recordId=${encodeURIComponent(record.id)}`}
          >
            准备面试
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-[1.35rem] border border-line bg-paper p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">事实复用</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">本次投递复用的已确认事实</h2>
          </div>
          <div className="rounded-full border border-line bg-white px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-500">
            {record.reusedMasterFacts.length} 条
          </div>
        </div>

        {record.reusedMasterFacts.length > 0 ? (
          <div className="mt-4 space-y-3">
            {record.reusedMasterFacts.map((fact) => (
              <article key={fact.id} className="rounded-[1.1rem] border border-line bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-slate-900">{fact.title}</p>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{fact.blockType}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{fact.summary}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-slate-700">本次投递未复用已确认的事实。</p>
        )}
      </div>
    </section>
  );
}

function RecordCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[1.35rem] border border-line bg-paper p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">{value}</p>
    </article>
  );
}

function renderInterviewStatus(status?: ApplicationRecord["interviewStatus"]) {
  switch (status) {
    case "preparing":
      return "准备中";
    case "scheduled":
      return "已安排";
    case "finished":
      return "已完成";
    default:
      return "未开始";
  }
}
