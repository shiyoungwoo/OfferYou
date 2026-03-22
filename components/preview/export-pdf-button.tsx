"use client";

import React, { useState, useTransition } from "react";
import type { ResumeDocument } from "@/lib/document/resume-document";

type ExportPdfButtonProps = {
  draftId: string;
  document?: ResumeDocument;
};

export function ExportPdfButton({ draftId, document }: ExportPdfButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function handleExport() {
    startTransition(async () => {
      setStatusMessage(null);
      const response = await fetch(`/api/drafts/${draftId}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(document ? { document } : {})
      });

      const payload = (await response.json()) as { storagePath?: string; error?: string; recordPath?: string };

      if (!response.ok) {
        setStatusMessage(payload.error ?? "导出失败");
        return;
      }

      setStatusMessage("已导出");
    });
  }

  return (
    <span className="relative inline-flex items-center gap-2">
      <button
        className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
        disabled={isPending}
        onClick={handleExport}
        type="button"
      >
        {isPending ? "导出中…" : "确认导出"}
      </button>
      {statusMessage ? <span className="text-xs text-slate-600">{statusMessage}</span> : null}
    </span>
  );
}
