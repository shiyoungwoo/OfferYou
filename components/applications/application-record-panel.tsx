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

      <div className="mt-6 rounded-[1.35rem] border border-line bg-paper p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Master Reuse</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Confirmed facts reused in this application</h2>
          </div>
          <div className="rounded-full border border-line bg-white px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-500">
            {record.reusedMasterFacts.length} facts
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
          <p className="mt-4 text-sm leading-6 text-slate-700">This application did not reuse any confirmed Master facts.</p>
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
