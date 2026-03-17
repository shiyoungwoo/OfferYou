import { ApplicationRecordPanel } from "@/components/applications/application-record-panel";
import { listApplicationRecords } from "@/lib/services/applications/application-record-service";

type RecordPageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

export default async function RecordPage({ params }: RecordPageProps) {
  const { draftId } = await params;
  const records = await listApplicationRecords();
  const record = records.find((item) => item.draftId === draftId);

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        {record ? (
          <ApplicationRecordPanel record={record} />
        ) : (
          <section className="rounded-[1.75rem] border border-dashed border-line bg-white/85 p-6 shadow-card">
            <p className="text-sm leading-7 text-slate-700">
              No application record exists for this draft yet. Export the PDF first to finalize the record.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
