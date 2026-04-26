"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RevisionFeedbackDialog } from "@/components/applications/revision-feedback-dialog";
import { SuggestionActionBar } from "@/components/applications/suggestion-action-bar";
import type { WorkspaceSuggestion } from "@/lib/services/analysis/workspace-data";

type SuggestionListProps = {
  draftId: string;
  suggestions: WorkspaceSuggestion[];
};

type EditableSuggestion = WorkspaceSuggestion & {
  editedAfterText: string;
  editedReasonText: string;
};

export function SuggestionList({ draftId, suggestions }: SuggestionListProps) {
  const router = useRouter();
  const [draftSuggestions, setDraftSuggestions] = useState<EditableSuggestion[]>(() =>
    createEditableSuggestions(suggestions)
  );
  const [expandedId, setExpandedId] = useState<string | null>(suggestions[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openRevisionId, setOpenRevisionId] = useState<string | null>(null);

  useEffect(() => {
    setDraftSuggestions(createEditableSuggestions(suggestions));
    setExpandedId((current) => (current && suggestions.some((item) => item.id === current) ? current : suggestions[0]?.id ?? null));
    setEditingId((current) => (current && suggestions.some((item) => item.id === current) ? current : null));
    setOpenRevisionId((current) => (current && suggestions.some((item) => item.id === current) ? current : null));
  }, [suggestions]);

  function updateSuggestionDraft(id: string, patch: Partial<Pick<EditableSuggestion, "editedAfterText" | "editedReasonText">>) {
    setDraftSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.id === id
          ? {
              ...suggestion,
              ...patch
            }
          : suggestion
      )
    );
  }

  function restoreSuggestionDraft(id: string) {
    const original = suggestions.find((suggestion) => suggestion.id === id);
    if (!original) {
      return;
    }

    setDraftSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.id === id
          ? {
              ...suggestion,
              editedAfterText: original.afterText,
              editedReasonText: original.reasonText
            }
          : suggestion
      )
    );
  }

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
        {draftSuggestions.length > 0 ? (
          draftSuggestions.map((suggestion) => {
            const isExpanded = expandedId === suggestion.id;
            const isEditing = editingId === suggestion.id;
            const { baseReason, qualityNotes } = splitReasonText(suggestion.editedReasonText);

            return (
              <article key={suggestion.id} className="rounded-[1.5rem] border border-line bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-semibold text-accent">
                      {getSuggestionIntentLabel(suggestion)}
                    </span>
                    <span className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-500">
                      {getSuggestionStatusLabel(suggestion.status)}
                    </span>
                    {qualityNotes.length > 0 ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        含质量提示
                      </span>
                    ) : null}
                  </div>

                  <button
                    className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent"
                    onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                    type="button"
                  >
                    {isExpanded ? "收起详情" : "展开详情"}
                  </button>
                </div>

                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-accent">{suggestion.section}</p>
                    <h3 className="mt-2 text-lg font-semibold">{suggestion.title}</h3>
                  </div>
                  <div className="max-w-xs rounded-[1rem] border border-line bg-white px-3 py-2 text-sm leading-5 text-slate-600">
                    {getSuggestionDirectionCopy(suggestion)}
                  </div>
                </div>

                {!isExpanded ? (
                  <div className="mt-4 rounded-[1.25rem] border border-dashed border-line bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                    {clipText(suggestion.editedAfterText, 110)}
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <SuggestionBlock label="原始表达" text={suggestion.beforeText} />
                      <SuggestionBlock label="建议改成" text={suggestion.editedAfterText} accent />
                    </div>

                    <div className="mt-4 rounded-[1.25rem] border border-dashed border-line bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">为什么这么改</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{baseReason}</p>
                      {qualityNotes.length > 0 ? (
                        <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">质量提示</p>
                          <ul className="mt-2 space-y-1">
                            {qualityNotes.map((note) => (
                              <li key={note}>- {note}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="mt-4 rounded-[1.25rem] border border-accent/20 bg-accent/5 p-4">
                        <p className="text-sm font-semibold text-accent">本地精修</p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">这里只会修改当前页面中的建议预览，不会写回服务器。</p>

                        <div className="mt-4 grid gap-4">
                          <label className="grid gap-2 text-sm font-medium text-slate-700">
                            建议改成
                            <textarea
                              className="min-h-28 rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6"
                              onChange={(event) => updateSuggestionDraft(suggestion.id, { editedAfterText: event.target.value })}
                              value={suggestion.editedAfterText}
                            />
                          </label>

                          <label className="grid gap-2 text-sm font-medium text-slate-700">
                            改写理由
                            <textarea
                              className="min-h-28 rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6"
                              onChange={(event) => updateSuggestionDraft(suggestion.id, { editedReasonText: event.target.value })}
                              value={suggestion.editedReasonText}
                            />
                          </label>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                            onClick={() => setEditingId(null)}
                            type="button"
                          >
                            保存本地修改
                          </button>
                          <button
                            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                            onClick={() => {
                              restoreSuggestionDraft(suggestion.id);
                              setEditingId(null);
                            }}
                            type="button"
                          >
                            恢复原稿
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <SuggestionActionBar
                        draftId={draftId}
                        onActionComplete={async () => router.refresh()}
                        onEdit={() => {
                          setExpandedId(suggestion.id);
                          setEditingId(suggestion.id);
                        }}
                        onRevise={() => {
                          setExpandedId(suggestion.id);
                          setEditingId(null);
                          setOpenRevisionId(suggestion.id);
                        }}
                        suggestionId={suggestion.id}
                      />
                    </div>
                  </>
                )}

                <RevisionFeedbackDialog
                  draftId={draftId}
                  onActionComplete={async () => router.refresh()}
                  onClose={() => setOpenRevisionId(null)}
                  open={openRevisionId === suggestion.id}
                  suggestionId={suggestion.id}
                />
              </article>
            );
          })
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-line bg-paper p-5 text-sm leading-6 text-slate-700">
            还没有可用的修改建议。
          </div>
        )}
      </div>
    </section>
  );
}

function createEditableSuggestions(suggestions: WorkspaceSuggestion[]): EditableSuggestion[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    editedAfterText: suggestion.afterText,
    editedReasonText: suggestion.reasonText
  }));
}

function SuggestionBlock({ label, text, accent = false }: { label: string; text: string; accent?: boolean }) {
  return (
    <div className={`rounded-[1.25rem] border p-4 ${accent ? "border-accent/20 bg-accent/5" : "border-line bg-white"}`}>
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function getSuggestionIntentLabel(suggestion: WorkspaceSuggestion) {
  if (isTalentAmplificationSuggestion(suggestion)) {
    return "突出天然优势";
  }

  if (suggestion.sourceKind === "target_role_fit") {
    return "岗位匹配更清楚";
  }

  if (suggestion.sourceKind === "master_fact") {
    return "保留事实，增强说服力";
  }

  if (suggestion.sourceKind === "revision") {
    return "继续微调";
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
    return "已拒绝";
  }

  return "待处理";
}

function isTalentAmplificationSuggestion(suggestion: WorkspaceSuggestion) {
  const reason = suggestion.reasonText.toLowerCase();
  return (
    reason.includes("underlying talent") ||
    suggestion.reasonText.includes("底层的优势") ||
    suggestion.reasonText.includes("自然工作方式")
  );
}

function splitReasonText(reasonText: string) {
  const marker = "；质量提示：";
  const index = reasonText.indexOf(marker);

  if (index === -1) {
    return {
      baseReason: reasonText,
      qualityNotes: [] as string[]
    };
  }

  const baseReason = reasonText.slice(0, index).replace(/[；;]+$/u, "").trim();
  const qualityPart = reasonText.slice(index + marker.length);

  return {
    baseReason,
    qualityNotes: qualityPart
      .split(/[；;]+/u)
      .map((note) => note.trim())
      .filter(Boolean)
  };
}

function clipText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}…`;
}
