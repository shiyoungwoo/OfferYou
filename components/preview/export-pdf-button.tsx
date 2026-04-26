"use client";

import React, { useState, useTransition } from "react";
import { estimateResumePageCount, getResumePageWaterLabel } from "@/lib/services/export/preview-renderer";
import type { ResumeDocument } from "@/lib/document/resume-document";

type ExportPdfButtonProps = {
  draftId: string;
  document?: ResumeDocument;
};

export function ExportPdfButton({ draftId, document }: ExportPdfButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [recordPath, setRecordPath] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const pageLabel = document ? getResumePageWaterLabel(estimateResumePageCount(document)) : null;


  function handleExport() {
    if (!confirmed) {
      setStatusMessage("请先确认当前简历内容无误");
      return;
    }

    startTransition(async () => {
      setStatusMessage(null);
      setRecordPath(null);

      const response = await fetch(`/api/drafts/${draftId}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(document ? { document } : {})
      });

      const payload = (await response.json()) as {
        storagePath?: string;
        error?: string;
        recordPath?: string;
        recordId?: string;
      };

      if (!response.ok) {
        setStatusMessage(payload.error ?? "导出失败");
        return;
      }

      setStatusMessage("PDF 已生成，开始下载...");
      setRecordPath(payload.recordPath ?? null);

      if (payload.recordId) {
        // Trigger browser download by navigating to the download endpoint
        window.location.href = `/api/records/${payload.recordId}/download`;
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {pageLabel ? <span className="text-xs font-medium text-slate-500">{pageLabel}</span> : null}
      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
        <input
          checked={confirmed}
          className="size-3.5 rounded border-line"
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        我已经确认当前简历内容无误
      </label>
      <button
        aria-label="确认无误后导出 PDF"
        className="rounded-full bg-accent px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || !confirmed}
        onClick={handleExport}
        type="button"
      >
        {isPending ? "导出中…" : "确认无误后导出 PDF"}
      </button>

      {recordPath ? (
        <a
          className="text-xs font-medium text-accent transition hover:text-accent/80"
          href={recordPath}
        >
          查看这次简历记录
        </a>
      ) : null}

      {statusMessage ? <span className="text-xs text-slate-600">{statusMessage}</span> : null}
    </div>
  );
}
