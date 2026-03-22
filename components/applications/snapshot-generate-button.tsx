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
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-line bg-paper px-5 py-4">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-slate-900">客户确认建议后，就可以生成优化简历初版。</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          当前已确认 {acceptedSuggestionCount} / {totalSuggestionCount} 条修改建议。生成后会直接进入预览页，确认无误再导出 PDF。
        </p>
      </div>
      <button
        className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        disabled={isPending}
        onClick={generateSnapshot}
        type="button"
      >
        {isPending ? "生成中..." : "确认并生成简历初版"}
      </button>
    </div>
  );
}
