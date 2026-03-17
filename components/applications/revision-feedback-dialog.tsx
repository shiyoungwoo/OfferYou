"use client";

import React, { useState, useTransition } from "react";

const feedbackOptions = [
  "too_generic",
  "too_aggressive",
  "not_my_style",
  "fact_inaccurate",
  "wrong_focus",
  "adding_new_fact",
  "custom"
] as const;

type RevisionFeedbackDialogProps = {
  draftId: string;
  suggestionId: string;
  open: boolean;
  onClose: () => void;
  onActionComplete: () => Promise<void> | void;
};

export function RevisionFeedbackDialog({
  draftId,
  suggestionId,
  open,
  onClose,
  onActionComplete
}: RevisionFeedbackDialogProps) {
  const [feedbackType, setFeedbackType] = useState<(typeof feedbackOptions)[number]>("too_generic");
  const [feedbackText, setFeedbackText] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return null;
  }

  function submitRevision() {
    startTransition(async () => {
      await fetch(`/api/drafts/${draftId}/suggestions/${suggestionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "revise",
          feedbackType,
          feedbackText
        })
      });

      setFeedbackText("");
      onClose();
      await onActionComplete();
    });
  }

  return (
    <div className="mt-4 rounded-[1.35rem] border border-accent/20 bg-accent/5 p-4">
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Feedback type
          <select
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm"
            onChange={(event) => setFeedbackType(event.target.value as (typeof feedbackOptions)[number])}
            value={feedbackType}
          >
            {feedbackOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Feedback text
          <textarea
            className="min-h-28 rounded-2xl border border-line bg-white px-4 py-3 text-sm"
            onChange={(event) => setFeedbackText(event.target.value)}
            placeholder="Tell OfferYou how this suggestion should change, or add real source material."
            value={feedbackText}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending || !feedbackText.trim()}
            onClick={submitRevision}
            type="button"
          >
            Submit Revision
          </button>
          <button
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
