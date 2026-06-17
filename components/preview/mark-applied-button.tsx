"use client";

import React, { useState, useTransition } from "react";

type MarkAppliedButtonProps = {
  draftId: string;
  disabled?: boolean;
};

export function MarkAppliedButton({ draftId, disabled = false }: MarkAppliedButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [recordPath, setRecordPath] = useState<string | null>(null);

  function markApplied() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/drafts/${draftId}/application-record`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        recordPath?: string;
      };

      if (!response.ok) {
        setMessage(payload.error ?? "记录投递失败。");
        return;
      }

      setRecordPath(payload.recordPath ?? null);
      setMessage("已记录为投递。");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || isPending}
        onClick={markApplied}
        title={disabled ? "简历优化草稿没有目标公司，不能记录为投递。" : "确认已经实际投递后再记录"}
        type="button"
      >
        {isPending ? "记录中…" : "记录为已投递"}
      </button>
      {recordPath ? (
        <a className="text-xs font-medium text-accent hover:text-accent/80" href={recordPath}>
          查看投递记录
        </a>
      ) : null}
      {message ? <span className="text-xs text-slate-600">{message}</span> : null}
    </div>
  );
}
