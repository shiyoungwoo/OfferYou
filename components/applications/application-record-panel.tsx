import type { ApplicationRecord } from "@/lib/services/applications/application-record-service";

type ApplicationRecordPanelProps = {
  record: ApplicationRecord;
};

export function ApplicationRecordPanel({ record }: ApplicationRecordPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Application Record</p>
      <h1 className="mt-4 text-4xl font-semibold">{record.company}</h1>
      <p className="mt-3 text-lg text-accent">{record.jobTitle}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <RecordCard label="Applied At" value={record.appliedAt} />
        <RecordCard label="Accepted Suggestions" value={String(record.acceptedSuggestionCount)} />
        <RecordCard label="Draft" value={record.draftId} />
        <RecordCard label="Snapshot" value={record.snapshotId} />
      </div>

      <div className="mt-6 rounded-[1.35rem] border border-line bg-paper p-5 text-sm leading-6 text-slate-700">
        Export artifact: {record.exportStoragePath ?? "No PDF export path recorded."}
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
