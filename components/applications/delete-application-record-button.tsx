"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

type DeleteApplicationRecordButtonProps = {
  recordId: string;
  company?: string;
  compact?: boolean;
};

export function DeleteApplicationRecordButton({
  recordId,
  company,
  compact = false
}: DeleteApplicationRecordButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function handleDelete() {
    const label = company ? `「${company}」` : "这条投递记录";
    const confirmed = window.confirm(`确定删除${label}吗？删除后首页和投递管理中将不再显示这条记录。`);
    if (!confirmed) return;

    setError("");

    try {
      const response = await fetch(`/api/records/${encodeURIComponent(recordId)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("删除失败，请稍后再试。");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败，请稍后再试。");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleDelete}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
            : "inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
        }
      >
        <Trash2 size={compact ? 13 : 15} />
        {isPending ? "删除中" : "删除"}
      </button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
