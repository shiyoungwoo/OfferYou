"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";

type SnapshotGenerateButtonProps = {
  draftId: string;
  acceptedSuggestionCount: number;
  totalSuggestionCount: number;
};

export function SnapshotGenerateButton({
  draftId,
  acceptedSuggestionCount,
  totalSuggestionCount
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
