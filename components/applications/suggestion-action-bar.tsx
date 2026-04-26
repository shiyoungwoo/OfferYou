"use client";

import React, { useTransition } from "react";

type SuggestionActionBarProps = {
  draftId: string;
  suggestionId: string;
  onEdit: () => void;
  onRevise: () => void;
  onActionComplete: () => Promise<void> | void;
};

export function SuggestionActionBar({
  draftId,
  suggestionId,
  onEdit,
  onRevise,
  onActionComplete
}: SuggestionActionBarProps) {
  const [isPending, startTransition] = useTransition();

  function runSimpleAction(action: "accept" | "reject") {
    startTransition(async () => {
      await fetch(`/api/drafts/${draftId}/suggestions/${suggestionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      await onActionComplete();
    });
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <button
        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={isPending}
        onClick={() => runSimpleAction("accept")}
        type="button"
      >
        接受
      </button>
      <button
        className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        disabled={isPending}
        onClick={onEdit}
        type="button"
      >
        编辑
      </button>
      <button
        className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        disabled={isPending}
        onClick={() => runSimpleAction("reject")}
        type="button"
      >
        拒绝
      </button>
      <button
        className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        disabled={isPending}
        onClick={onRevise}
        type="button"
      >
        继续微调
      </button>
    </div>
  );
}
