"use client";

import React, { useState, useTransition } from "react";

type ExportPdfButtonProps = {
  draftId: string;
};

export function ExportPdfButton({ draftId }: ExportPdfButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function handleExport() {
    startTransition(async () => {
      const response = await fetch(`/api/drafts/${draftId}/export`, {
        method: "POST"
      });

      const payload = (await response.json()) as { storagePath?: string; error?: string };

      if (!response.ok) {
        setStatusMessage(payload.error ?? "PDF export failed.");
        return;
      }

      setStatusMessage(`PDF exported to ${payload.storagePath}`);
    });
  }

  return (
    <div className="rounded-[1.4rem] border border-line bg-white/85 p-4 shadow-card">
      <button
        className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        disabled={isPending}
        onClick={handleExport}
        type="button"
      >
        Export PDF
      </button>
      {statusMessage ? <p className="mt-3 text-sm leading-6 text-slate-700">{statusMessage}</p> : null}
    </div>
  );
}
