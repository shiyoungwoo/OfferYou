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

type DatedSuggestionEntry = {
  title: string;
  date: string;
  body: string;
};

type PartDecision = "accepted" | "rejected";

export function SuggestionList({ draftId, suggestions }: SuggestionListProps) {
  const router = useRouter();
  const [draftSuggestions, setDraftSuggestions] = useState<EditableSuggestion[]>(() =>
    createEditableSuggestions(suggestions)
  );
  const [expandedId, setExpandedId] = useState<string | null>(suggestions[0]?.id ?? null);
  const [openRevisionId, setOpenRevisionId] = useState<string | null>(null);
  const [decidedParts, setDecidedParts] = useState<Record<string, Record<number, PartDecision>>>({});

  useEffect(() => {
    setDraftSuggestions(createEditableSuggestions(suggestions));
    setExpandedId((current) => {
      if (current && suggestions.some((item) => item.id === current)) return current;
      return current === null ? null : (suggestions[0]?.id ?? null);
    });
    setOpenRevisionId((current) => (current && suggestions.some((item) => item.id === current) ? current : null));
    // Keep decidedParts if IDs still exist
    setDecidedParts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (!suggestions.some(s => s.id === id)) delete next[id];
      });
      return next;
    });
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

      <div className="mt-6 space-y-4 w-full min-w-0">
        {draftSuggestions.length > 0 ? (
          draftSuggestions.map((suggestion) => {
            const isExpanded = expandedId === suggestion.id;
            const { baseReason, gapReminders, qualityNotes } = parseExtendedReasonText(suggestion.editedReasonText);

            return (
              <article key={suggestion.id} className="rounded-[1.5rem] border border-line bg-paper p-5 w-full min-w-0 overflow-hidden shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent shadow-sm">
                      {suggestion.status === "accepted" ? "✓" : suggestion.status === "rejected" ? "×" : "!"}
                    </div>
                    <span className={`text-sm font-bold tracking-tight ${suggestion.status === "pending" ? "text-slate-800" : "text-slate-500"}`}>
                      {suggestion.title}
                    </span>
                    {suggestion.status !== "pending" && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {suggestion.status === "accepted" ? "已处理" : "已跳过"}
                      </span>
                    )}
                  </div>

                  <button
                    className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent"
                    onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                    type="button"
                  >
                    {isExpanded ? "收起详情" : "展开详情"}
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <p className="text-xs font-medium text-slate-500">{getSuggestionDirectionCopy(suggestion)}</p>
                </div>

                {!isExpanded ? (
                  <div className="mt-4 rounded-[1.25rem] border border-dashed border-line bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                    {clipText(suggestion.editedAfterText, 110)}
                  </div>
                ) : (
                  <>
                    <div className="mt-4 flex flex-col space-y-12">
                      {(() => {
                        const text = suggestion.beforeText;
                        const revisedText = suggestion.editedAfterText;
                        const decisions = decidedParts[suggestion.id] || {};
                        
                        const beforeEntries = splitDatedSuggestionEntries(text);
                        const afterEntries = splitDatedSuggestionEntries(revisedText);
                        const canSplitByDate = beforeEntries.length > 1 && afterEntries.length >= beforeEntries.length;

                        if (canSplitByDate) {
                          return (
                            <div className="relative">
                              <div className="absolute -left-3 top-0 bottom-0 w-1 bg-slate-100 rounded-full" title="这些项目属于同一个改写组" />
                              <div className="space-y-12">
                                {beforeEntries.map((entry, idx) => {
                                  // Find the best matching revised entry by title overlap
                                  let revisedEntry = afterEntries[idx];
                                  if (afterEntries.length > 0) {
                                    const bestMatch = findBestRevisedEntry(entry, afterEntries);
                                    if (bestMatch) revisedEntry = bestMatch;
                                  }

                                  if (!revisedEntry) return null;

                                  return (
                                    <TSection 
                                      key={`${suggestion.id}-${idx}`}
                                      draftId={draftId}
                                      suggestionId={suggestion.id}
                                      currentStatus={decisions[idx] ?? "pending"}
                                      isDecided={Boolean(decisions[idx])}
                                      localOnly
                                      actionAfterText={revisedEntry.body || `${revisedEntry.title} ${revisedEntry.date}`.trim()}
                                      actionReasonText={idx === 0 ? suggestion.editedReasonText : ""}
                                      title={`${entry.title} ${entry.date}`.trim()} 
                                      original={entry.body} 
                                      revised={revisedEntry.body || (revisedEntry ? `${revisedEntry.title} ${revisedEntry.date}`.trim() : "")} 
                                      reason={idx === 0 ? suggestion.editedReasonText : ""} 
                                      onActionComplete={async () => {
                                        await router.refresh();
                                      }}
                                      onEdit={() => {}} // Local
                                      onRevise={() => {
                                        setOpenRevisionId(suggestion.id);
                                      }}
                                      onDecision={(decision) => {
                                        setDecidedParts(prev => {
                                          const nextDecisions = {
                                            ...(prev[suggestion.id] || {}),
                                            [idx]: decision
                                          };

                                          if (Object.keys(nextDecisions).length >= beforeEntries.length) {
                                            void syncGroupedSuggestionDecision({
                                              draftId,
                                              suggestionId: suggestion.id,
                                              decisions: nextDecisions,
                                              beforeEntries,
                                              afterEntries,
                                              reasonText: suggestion.editedReasonText,
                                              onSynced: async () => {
                                                setExpandedId(null);
                                                await router.refresh();
                                              }
                                            });
                                          }

                                          return {
                                            ...prev,
                                            [suggestion.id]: nextDecisions
                                          };
                                        });
                                      }}
                                      onUpdateRevised={(newBody) => {
                                        setDraftSuggestions(current => current.map(s => {
                                          if (s.id !== suggestion.id) return s;
                                          const entries = splitDatedSuggestionEntries(s.editedAfterText);
                                          if (entries[idx]) {
                                            entries[idx].body = newBody;
                                            const reconstructed = entries.map(e => `${e.title} ${e.date}\n${e.body}`).join("\n\n");
                                            return { ...s, editedAfterText: reconstructed };
                                          }
                                          return s;
                                        }));
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <TSection 
                            draftId={draftId}
                            suggestionId={suggestion.id}
                            currentStatus={suggestion.status}
                            isDecided={suggestion.status !== "pending"}
                            actionAfterText={suggestion.editedAfterText}
                            actionReasonText={suggestion.editedReasonText}
                            title={suggestion.title} 
                            original={suggestion.beforeText} 
                            revised={suggestion.editedAfterText} 
                            reason={suggestion.editedReasonText} 
                            onActionComplete={async () => {
                              await router.refresh();
                            }}
                            onEdit={() => {}} // Local
                            onRevise={() => {
                              setOpenRevisionId(suggestion.id);
                            }}
                            onDecision={() => {
                              setExpandedId(null);
                            }}
                            onUpdateRevised={(newText) => {
                              updateSuggestionDraft(suggestion.id, { editedAfterText: newText });
                            }}
                          />
                        );
                      })()}
                    </div>
                  </>
                )}

                <RevisionFeedbackDialog
                  draftId={draftId}
                  onActionComplete={async () => {
                    await router.refresh();
                  }}
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

function TSection({ 
  title, 
  original, 
  revised, 
  reason,
  draftId,
  suggestionId,
  currentStatus,
  onActionComplete,
  onEdit,
  onRevise,
  onUpdateRevised,
  onDecision,
  isDecided,
  actionAfterText,
  actionReasonText,
  localOnly = false
}: { 
  title: string; 
  original: string; 
  revised: string; 
  reason: string;
  draftId: string;
  suggestionId: string;
  currentStatus: string;
  onActionComplete: () => Promise<void>;
  onEdit: () => void;
  onRevise: () => void;
  onUpdateRevised?: (text: string) => void;
  onDecision?: (decision: "accepted" | "rejected") => void;
  isDecided?: boolean;
  actionAfterText?: string;
  actionReasonText?: string;
  localOnly?: boolean;
}) {
  const [localIsEditing, setLocalIsEditing] = React.useState(false);
  const [localRevised, setLocalRevised] = React.useState(revised);
  const [localStatus, setLocalStatus] = React.useState<"pending" | "accepted" | "rejected">(
    isDecided ? (currentStatus as any) : "pending"
  );

  React.useEffect(() => {
    setLocalRevised(revised);
  }, [revised]);

  React.useEffect(() => {
    setLocalStatus(isDecided ? (currentStatus as "accepted" | "rejected") : "pending");
  }, [currentStatus, isDecided]);
  const { baseReason, gapReminders, qualityNotes } = parseExtendedReasonText(reason);
  const tags = reason.match(/；标签：([^；\n]+)/)?.[1]?.split("、") || [];
  if (tags.length === 0 && baseReason.includes("「")) {
    const focusMatch = baseReason.match(/「([^」]+)」/);
    if (focusMatch) tags.push(focusMatch[1]);
  }

  return (
    <div className="flex flex-col group w-full max-w-full overflow-hidden">
      {/* T-Shape Header: Project Title + Actions */}
      <div className="mb-2 rounded-t-[1.25rem] border border-line bg-slate-50/80 px-5 py-3 border-b-0 flex flex-nowrap items-center justify-between gap-4 min-w-0 w-full overflow-hidden">
        <h4 className="text-sm md:text-base font-bold text-slate-800 leading-tight truncate min-w-0 flex-1">{title}</h4>
        <div className="shrink-0 flex items-center gap-2">
          {localIsEditing ? (
             <span className="text-[10px] font-bold text-accent uppercase tracking-widest">编辑中...</span>
          ) : (
            <SuggestionActionBar
              draftId={draftId}
              suggestionId={suggestionId}
              currentStatus={localStatus}
              actionPayload={{
                afterText: actionAfterText ?? localRevised,
                reasonText: actionReasonText ?? reason
              }}
              localOnly={localOnly}
              onActionComplete={async () => {
                await onActionComplete();
              }}
              onEdit={() => setLocalIsEditing(true)}
              onRevise={onRevise}
              onAccept={() => {
                setLocalStatus("accepted");
                onDecision?.("accepted");
              }}
              onReject={() => {
                setLocalStatus("rejected");
                onDecision?.("rejected");
              }}
              compact
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 border border-line rounded-b-[1.25rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow min-w-0 w-full">
        {/* Left: Original Content */}
        <div className="bg-white p-5 border-r border-line min-w-0 overflow-hidden w-full">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-3">原始表达内容</p>
          <div className="text-sm leading-7 text-slate-600 whitespace-pre-wrap break-all overflow-wrap-anywhere">
            {original}
          </div>
        </div>
        
        {/* Right: Revised Content + Analysis */}
        <div className={`p-5 flex flex-col min-w-0 overflow-hidden w-full transition-colors ${localStatus === "accepted" ? "bg-emerald-50/30" : localStatus === "rejected" ? "bg-rose-50/30" : "bg-accent/5"}`}>
          <div className="rounded-xl bg-white/90 p-4 border border-accent/10 shadow-sm min-h-[120px] min-w-0 w-full overflow-hidden relative">
            {localIsEditing ? (
              <div className="space-y-3">
                <textarea
                  aria-label="改写后全文"
                  className="w-full min-h-[140px] border-none bg-transparent text-sm font-semibold text-slate-800 leading-relaxed outline-none focus:ring-0 p-0 resize-none"
                  value={localRevised}
                  onChange={(e) => setLocalRevised(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button 
                    onClick={() => {
                      setLocalIsEditing(false);
                      setLocalRevised(revised);
                    }}
                    className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600"
                  >
                    取消
                  </button>
                  <button 
                    onClick={() => {
                      setLocalIsEditing(false);
                      onUpdateRevised?.(localRevised);
                    }}
                    className="px-3 py-1 rounded-lg bg-accent text-white text-[10px] font-bold shadow-sm"
                  >
                    确认修改内容
                  </button>
                </div>
              </div>
            ) : (
              <div className={`text-sm font-semibold leading-relaxed whitespace-pre-wrap break-all overflow-wrap-anywhere ${localStatus === "rejected" ? "text-slate-400 line-through opacity-50" : "text-slate-800"}`}>
                {revised}
              </div>
            )}

            {/* Tags moved below content */}
            {tags.length > 0 && !localIsEditing && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 overflow-hidden">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">核心关键词:</span>
                {tags.map((tag, i) => (
                  <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap border border-blue-100">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Analysis blocks removed as requested */}
          
          {gapReminders.length > 0 && !localIsEditing && (
            <div className="mt-3 rounded-[0.85rem] border border-blue-100 bg-blue-50/40 px-3 py-2 text-[10px] leading-4 text-blue-800 min-w-0 w-full overflow-hidden">
              <div className="flex items-center gap-1 mb-0.5 shrink-0">
                <span className="h-1 w-1 rounded-full bg-blue-400 shrink-0" />
                <p className="font-bold uppercase tracking-[0.05em] text-[8px] shrink-0 text-blue-600">建议补充内容</p>
              </div>
              <p className="text-slate-600 font-medium break-all overflow-wrap-anywhere">
                {gapReminders.join("、")}
              </p>
            </div>
          )}

          {qualityNotes.length > 0 && !localIsEditing && (
            <div className="mt-3 rounded-[0.85rem] border border-amber-100 bg-amber-50/60 px-3 py-2 text-[10px] leading-4 text-amber-900 min-w-0 w-full overflow-hidden">
              <div className="flex items-center gap-1 mb-0.5 shrink-0">
                <span className="h-1 w-1 rounded-full bg-amber-400 shrink-0" />
                <p className="font-bold uppercase tracking-[0.05em] text-[8px] shrink-0 text-amber-700">质量提示</p>
              </div>
              <p className="text-slate-600 font-medium break-all overflow-wrap-anywhere">
                {qualityNotes.join("、")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function createEditableSuggestions(suggestions: WorkspaceSuggestion[]): EditableSuggestion[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    editedAfterText: suggestion.afterText,
    editedReasonText: suggestion.reasonText
  }));
}

function splitDatedSuggestionEntries(text: string): DatedSuggestionEntry[] {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: DatedSuggestionEntry[] = [];
  let current: DatedSuggestionEntry | null = null;

  for (const line of lines) {
    const match = line.match(/(?<date>(?:\d{4}[./]\d{2}|\d{4})\s*-\s*(?:至今|Present|\d{4}[./]\d{2}|\d{4}))/ui);

    if (match?.groups?.date) {
      if (current) {
        entries.push(current);
      }

      const date = match.groups.date;
      const title = line.slice(0, match.index).trim() || "项目/工作内容";
      const rest = line.slice((match.index ?? 0) + date.length).trim();
      current = { title, date, body: rest };
      continue;
    }

    if (current) {
      current.body = [current.body, line].filter(Boolean).join("\n");
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function findBestRevisedEntry(entry: DatedSuggestionEntry, candidates: DatedSuggestionEntry[]) {
  const sourceTokens = tokenizeEntryTitle(entry.title);
  let best: { entry: DatedSuggestionEntry; score: number } | null = null;

  for (const candidate of candidates) {
    const candidateTokens = tokenizeEntryTitle(candidate.title);
    const overlap = candidateTokens.filter((token) => sourceTokens.includes(token)).length;
    const directHit = entry.title.includes(candidate.title) || candidate.title.includes(entry.title);
    const score = overlap + (directHit ? 3 : 0);

    if (score > (best?.score ?? 0)) {
      best = { entry: candidate, score };
    }
  }

  return best && best.score >= 2 ? best.entry : null;
}

function tokenizeEntryTitle(title: string) {
  const commonTokens = new Set(["ai", "项目", "个人", "工作", "内容", "运营"]);
  return title
    .toLowerCase()
    .split(/[\s|｜·（）()_-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !commonTokens.has(token));
}

async function syncGroupedSuggestionDecision({
  draftId,
  suggestionId,
  decisions,
  beforeEntries,
  afterEntries,
  reasonText,
  onSynced
}: {
  draftId: string;
  suggestionId: string;
  decisions: Record<number, PartDecision>;
  beforeEntries: DatedSuggestionEntry[];
  afterEntries: DatedSuggestionEntry[];
  reasonText: string;
  onSynced: () => Promise<void>;
}) {
  const acceptedCount = Object.values(decisions).filter((decision) => decision === "accepted").length;
  const action = acceptedCount > 0 ? "accept" : "reject";
  const afterText = beforeEntries
    .map((entry, index) => {
      const chosen = decisions[index] === "accepted" ? (afterEntries[index] ?? entry) : entry;
      return `${chosen.title} ${chosen.date}\n${chosen.body}`.trim();
    })
    .join("\n\n");

  const response = await fetch(`/api/drafts/${draftId}/suggestions/${suggestionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action,
      afterText,
      reasonText
    })
  });

  if (response.ok) {
    await onSynced();
  }
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

function parseExtendedReasonText(reasonText: string) {
  const qualityMarker = "；质量提示：";
  const gapMarker = "【JD 缺失能力提醒】：";
  
  let baseReason = reasonText;
  let qualityNotes: string[] = [];
  let gapReminders: string[] = [];

  // Extract quality notes
  const qIndex = baseReason.indexOf(qualityMarker);
  if (qIndex !== -1) {
    const qPart = baseReason.slice(qIndex + qualityMarker.length);
    qualityNotes = qPart.split(/[；;]+/u).map(n => n.trim()).filter(Boolean);
    baseReason = baseReason.slice(0, qIndex).trim();
  }

  // Extract gap reminders
  const segments = baseReason.split(gapMarker);
  if (segments.length > 1) {
    baseReason = segments[0].trim();
    gapReminders = segments.slice(1).map(s => {
      const endIdx = s.indexOf("；");
      return endIdx !== -1 ? s.slice(0, endIdx).trim() : s.trim();
    }).filter(Boolean);
  }

  return {
    baseReason: baseReason.replace(/[；;]+$/u, "").trim(),
    gapReminders,
    qualityNotes
  };
}

function clipText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}…`;
}
