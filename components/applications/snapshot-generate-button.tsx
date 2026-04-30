"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";

type SnapshotGenerateButtonProps = {
  draftId: string;
  acceptedSuggestionCount: number;
  totalSuggestionCount: number;
  variant?: "panel" | "inline";
};

export function SnapshotGenerateButton({
  draftId,
  acceptedSuggestionCount,
  totalSuggestionCount,
  variant = "panel"
}: SnapshotGenerateButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function generateSnapshot() {
    startTransition(async () => {
      const response = await fetch(`/api/drafts/${draftId}/snapshot`, {
        method: "POST"
      });

      if (!response.ok) {
        return;
      }

      router.push(`/applications/${draftId}/preview`);
    });
  }

  if (variant === "inline") {
    return (
      <button
        className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50"
        disabled={isPending}
        onClick={generateSnapshot}
        type="button"
      >
        {isPending ? "同步中..." : "同步预览"}
      </button>
    );
  }

  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-6">
      <div className="max-w-xl">
        <p className="text-xs leading-5 text-slate-500">
          已确认 {acceptedSuggestionCount} / {totalSuggestionCount} 条修改建议。同步至预览稿后可进行最终导出确认。
        </p>
      </div>
      <button
        className="rounded-full border border-line bg-white px-5 py-2.5 text-xs font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
        disabled={isPending}
        onClick={generateSnapshot}
        type="button"
      >
        {isPending ? "同步中..." : "同步并预览"}
      </button>
    </div>
  );
}
