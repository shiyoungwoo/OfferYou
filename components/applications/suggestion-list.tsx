"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RevisionFeedbackDialog } from "@/components/applications/revision-feedback-dialog";
import { SuggestionActionBar } from "@/components/applications/suggestion-action-bar";
import type { WorkspaceSuggestion } from "@/lib/services/analysis/workspace-data";

type SuggestionListProps = {
  draftId: string;
  suggestions: WorkspaceSuggestion[];
};

export function SuggestionList({ draftId, suggestions }: SuggestionListProps) {
  const router = useRouter();
  const [openRevisionId, setOpenRevisionId] = useState<string | null>(null);

  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Mentor Mode</p>
          <h2 className="mt-3 text-2xl font-semibold">Rewrite suggestions</h2>
        </div>
        <div className="rounded-full border border-line px-4 py-2 text-sm text-slate-600">{suggestions.length} items</div>
      </div>

      <div className="mt-6 space-y-4">
        {suggestions.map((suggestion) => (
          <article key={suggestion.id} className="rounded-[1.5rem] border border-line bg-paper p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-accent">{suggestion.section}</p>
                <h3 className="mt-2 text-lg font-semibold">{suggestion.title}</h3>
              </div>
              <div className="rounded-full border border-line bg-white px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                {suggestion.status}
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <SuggestionBlock label="Before" text={suggestion.beforeText} />
              <SuggestionBlock label="After" text={suggestion.afterText} accent />
            </div>

            <div className="mt-4 rounded-[1.25rem] border border-dashed border-line bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Reason</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{suggestion.reasonText}</p>
            </div>

            <SuggestionActionBar
              draftId={draftId}
              onActionComplete={async () => router.refresh()}
              onRevise={() => setOpenRevisionId(suggestion.id)}
              suggestionId={suggestion.id}
            />
            <RevisionFeedbackDialog
              draftId={draftId}
              onActionComplete={async () => router.refresh()}
              onClose={() => setOpenRevisionId(null)}
              open={openRevisionId === suggestion.id}
              suggestionId={suggestion.id}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function SuggestionBlock({ label, text, accent = false }: { label: string; text: string; accent?: boolean }) {
  return (
    <div className={`rounded-[1.25rem] border p-4 ${accent ? "border-accent/20 bg-accent/5" : "border-line bg-white"}`}>
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}
