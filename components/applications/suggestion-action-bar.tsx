"use client";

import React, { useTransition } from "react";

type SuggestionActionBarProps = {
  draftId: string;
  suggestionId: string;
  onRevise: () => void;
  onActionComplete: () => Promise<void> | void;
};

export function SuggestionActionBar({
  draftId,
  suggestionId,
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
        Accept
      </button>
      <button
        className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        disabled={isPending}
        onClick={onRevise}
        type="button"
      >
        Revise
      </button>
      <button
        className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        disabled={isPending}
        onClick={() => runSimpleAction("reject")}
        type="button"
      >
        Reject
      </button>
    </div>
  );
}
