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
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">修改建议</p>
          <h2 className="mt-3 text-2xl font-semibold">把真实经历改得更像你，也更贴近岗位</h2>
        </div>
        <div className="rounded-full border border-line px-4 py-2 text-sm text-slate-600">{suggestions.length} 条建议</div>
      </div>

      <div className="mt-6 space-y-4">
        {suggestions.length > 0 ? (
          suggestions.map((suggestion) => (
            <article key={suggestion.id} className="rounded-[1.5rem] border border-line bg-paper p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-semibold text-accent">
                  {getSuggestionIntentLabel(suggestion)}
                </span>
                <span className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-500">
                  {getSuggestionStatusLabel(suggestion.status)}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-accent">{suggestion.section}</p>
                  <h3 className="mt-2 text-lg font-semibold">{suggestion.title}</h3>
                </div>
                <div className="max-w-xs rounded-[1rem] border border-line bg-white px-3 py-2 text-sm leading-5 text-slate-600">
                  {getSuggestionDirectionCopy(suggestion)}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <SuggestionBlock label="原始表达" text={suggestion.beforeText} />
                <SuggestionBlock label="建议改成" text={suggestion.afterText} accent />
              </div>

              <div className="mt-4 rounded-[1.25rem] border border-dashed border-line bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">为什么这么改</p>
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
          ))
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-line bg-paper p-5 text-sm leading-6 text-slate-700">
            还没有可用的修改建议。
          </div>
        )}
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

function getSuggestionIntentLabel(suggestion: WorkspaceSuggestion) {
  if (isTalentAmplificationSuggestion(suggestion)) {
    return "突出你的天然优势";
  }

  if (suggestion.sourceKind === "target_role_fit") {
    return "让岗位匹配更清楚";
  }

  if (suggestion.sourceKind === "master_fact") {
    return "保留事实，增强说服力";
  }

  if (suggestion.sourceKind === "revision") {
    return "继续微调，让它更像你";
  }

  return "把经历讲得更有重点";
}

function getSuggestionDirectionCopy(suggestion: WorkspaceSuggestion) {
  if (isTalentAmplificationSuggestion(suggestion)) {
    return "这条建议会更主动地把你的优势特质写出来。";
  }

  if (suggestion.sourceKind === "target_role_fit") {
    return "这条建议重点是让招聘方更快看懂你为什么适合。";
  }

  if (suggestion.sourceKind === "master_fact") {
    return "这条建议重点是保留真实经历，同时让证据更有力量。";
  }

  if (suggestion.sourceKind === "revision") {
    return "这条建议是根据你的反馈继续调整后的版本。";
  }

  return "这条建议重点是把原始表达变得更清楚、更聚焦。";
}

function getSuggestionStatusLabel(status: WorkspaceSuggestion["status"]) {
  if (status === "accepted") {
    return "已接受";
  }

  if (status === "rejected") {
    return "已跳过";
  }

  return "待确认";
}

function isTalentAmplificationSuggestion(suggestion: WorkspaceSuggestion) {
  const reason = suggestion.reasonText.toLowerCase();
  return (
    reason.includes("underlying talent") ||
    suggestion.reasonText.includes("底层的优势") ||
    suggestion.reasonText.includes("自然工作方式")
  );
}
