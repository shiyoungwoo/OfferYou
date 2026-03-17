"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";

export type FactSubmissionCardData = {
  id: string;
  submissionText: string;
  sourceType: string;
  relatedSuggestionId?: string;
  status: "pending_confirmation" | "confirmed" | "rejected";
};

type FactSubmissionReviewCardProps = {
  submission: FactSubmissionCardData;
};

export function FactSubmissionReviewCard({ submission }: FactSubmissionReviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function submitAction(action: "confirm" | "reject") {
    startTransition(async () => {
      await fetch(`/api/master/fact-submissions/${submission.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      router.refresh();
    });
  }

  return (
    <article className="rounded-[1.35rem] border border-line bg-paper p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-accent">Pending Fact Submission</p>
          <h3 className="mt-2 text-lg font-semibold">{submission.id}</h3>
        </div>
        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-500">
          {submission.status}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-700">{submission.submissionText}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">
        Source: {submission.sourceType}
        {submission.relatedSuggestionId ? ` · Suggestion: ${submission.relatedSuggestionId}` : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isPending}
          onClick={() => submitAction("confirm")}
          type="button"
        >
          Confirm Into Master
        </button>
        <button
          className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          disabled={isPending}
          onClick={() => submitAction("reject")}
          type="button"
        >
          Reject
        </button>
      </div>
    </article>
  );
}
