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
type SuggestionGroup = {
  key: string;
  title: string;
  suggestions: EditableSuggestion[];
};

export function SuggestionList({ draftId, suggestions }: SuggestionListProps) {
  const router = useRouter();
  const [draftSuggestions, setDraftSuggestions] = useState<EditableSuggestion[]>(() =>
    createEditableSuggestions(suggestions)
  );
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(
    () => groupSuggestions(createEditableSuggestions(suggestions))[0]?.key ?? null
  );
  const [openRevisionId, setOpenRevisionId] = useState<string | null>(null);
  const [decidedParts, setDecidedParts] = useState<Record<string, Record<number, PartDecision>>>({});
  const groups = React.useMemo(() => groupSuggestions(draftSuggestions), [draftSuggestions]);

  useEffect(() => {
    setDraftSuggestions(createEditableSuggestions(suggestions));
    setExpandedGroupKey((current) => {
      const nextGroups = groupSuggestions(createEditableSuggestions(suggestions));
      if (current && nextGroups.some((group) => group.key === current)) return current;
      return current;
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

  function markSuggestionDecision(id: string, decision: PartDecision, groupKey: string) {
    setDraftSuggestions((current) => {
      const nextStatus: WorkspaceSuggestion["status"] = decision === "accepted" ? "accepted" : "rejected";
      const next = current.map((suggestion) =>
        suggestion.id === id ? { ...suggestion, status: nextStatus } : suggestion
      );
      const nextGroups = groupSuggestions(next);
      const currentGroupIndex = nextGroups.findIndex((group) => group.key === groupKey);
      const currentGroup = nextGroups[currentGroupIndex];

      if (currentGroup && currentGroup.suggestions.every((suggestion) => suggestion.status !== "pending")) {
        setExpandedGroupKey(findNextPendingGroupKey(nextGroups, currentGroupIndex));
      }

      return next;
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">简历优化改写</p>
          <h2 className="mt-3 text-2xl font-semibold">逐条确认优化内容</h2>
        </div>
        <div className="rounded-full border border-line px-4 py-2 text-sm text-slate-600">{suggestions.length} 条建议</div>
      </div>

      <div className="mt-6 space-y-5 w-full min-w-0">
        {groups.length > 0 ? (
          groups.map((group) => {
            const isExpanded = expandedGroupKey === group.key;
            const confirmedCount = group.suggestions.filter((suggestion) => suggestion.status !== "pending").length;

            return (
              <article key={group.key} className="rounded-[1.75rem] border border-line bg-paper p-5 shadow-sm">
                <button
                  className="flex w-full flex-wrap items-center justify-between gap-4 text-left"
                  onClick={() => setExpandedGroupKey(isExpanded ? null : group.key)}
                  type="button"
                >
                  <span className="text-2xl font-semibold text-ink">{group.title}</span>
                  <span className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-600">
                    {confirmedCount} / {group.suggestions.length} 已确认
                  </span>
                  <span className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    {isExpanded ? "收起详情" : "展开详情"}
                  </span>
                </button>

                {!isExpanded ? (
                  <div className="mt-4 rounded-[1.25rem] border border-dashed border-line bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                    {group.suggestions.map((suggestion) => firstUsefulLine(suggestion.editedAfterText)).join(" / ")}
                  </div>
                ) : (
                  <div className="mt-5 space-y-8">
                    {group.suggestions.map((suggestion) => (
                      <SuggestionTBlocks
                        key={suggestion.id}
                        draftId={draftId}
                        groupKey={group.key}
                        decidedParts={decidedParts}
                        markSuggestionDecision={markSuggestionDecision}
                        openRevision={() => setOpenRevisionId(suggestion.id)}
                        routerRefresh={async () => {
                          await router.refresh();
                        }}
                        setDecidedParts={setDecidedParts}
                        setDraftSuggestions={setDraftSuggestions}
                        suggestion={suggestion}
                        updateSuggestionDraft={updateSuggestionDraft}
                      />
                    ))}
                  </div>
                )}

                {group.suggestions.map((suggestion) => (
                  <RevisionFeedbackDialog
                    key={`${suggestion.id}-dialog`}
                    draftId={draftId}
                    onActionComplete={async () => {
                      await router.refresh();
                    }}
                    onClose={() => setOpenRevisionId(null)}
                    open={openRevisionId === suggestion.id}
                    suggestionId={suggestion.id}
                  />
                ))}
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

function SuggestionTBlocks({
  draftId,
  groupKey,
  decidedParts,
  suggestion,
  markSuggestionDecision,
  openRevision,
  routerRefresh,
  setDecidedParts,
  setDraftSuggestions,
  updateSuggestionDraft
}: {
  draftId: string;
  groupKey: string;
  decidedParts: Record<string, Record<number, PartDecision>>;
  suggestion: EditableSuggestion;
  markSuggestionDecision: (id: string, decision: PartDecision, groupKey: string) => void;
  openRevision: () => void;
  routerRefresh: () => Promise<void>;
  setDecidedParts: React.Dispatch<React.SetStateAction<Record<string, Record<number, PartDecision>>>>;
  setDraftSuggestions: React.Dispatch<React.SetStateAction<EditableSuggestion[]>>;
  updateSuggestionDraft: (id: string, patch: Partial<Pick<EditableSuggestion, "editedAfterText" | "editedReasonText">>) => void;
}) {
  const beforeEntries = splitDatedSuggestionEntries(suggestion.beforeText);
  const afterEntries = splitDatedSuggestionEntries(suggestion.editedAfterText);
  const decisions = decidedParts[suggestion.id] || {};
  const canSplitByDate = beforeEntries.length > 1 && afterEntries.length >= beforeEntries.length;
  const isEducation = normalizeSectionKey(suggestion.section) === "education";

  if (!canSplitByDate) {
    return (
      <TSection
        actionAfterText={suggestion.editedAfterText}
        actionReasonText={suggestion.editedReasonText}
        confirmOnly={isEducation}
        currentStatus={suggestion.status}
        verificationStatus={suggestion.verification?.status}
        draftId={draftId}
        isDecided={suggestion.status !== "pending"}
        jdCapability={getJdCapabilityLabel(suggestion)}
        onActionComplete={routerRefresh}
        onDecision={(decision) => markSuggestionDecision(suggestion.id, decision, groupKey)}
        onEdit={() => {}}
        onRevise={openRevision}
        onUpdateRevised={(newText) => updateSuggestionDraft(suggestion.id, { editedAfterText: newText })}
        original={suggestion.beforeText}
        originalLabel={normalizeSectionKey(suggestion.section) === "summary" ? "原简历个人优势" : "原始简历内容"}
        reason={suggestion.editedReasonText}
        revised={suggestion.editedAfterText}
        suggestionId={suggestion.id}
        title={suggestion.title}
      />
    );
  }

  return (
    <div className="space-y-8">
      {beforeEntries.map((entry, index) => {
        let revisedEntry = afterEntries[index];
        const bestMatch = findBestRevisedEntry(entry, afterEntries);
        if (bestMatch) revisedEntry = bestMatch;
        if (!revisedEntry) return null;

        return (
          <TSection
            key={`${suggestion.id}-${index}`}
            actionAfterText={revisedEntry.body || `${revisedEntry.title} ${revisedEntry.date}`.trim()}
            actionReasonText={index === 0 ? suggestion.editedReasonText : ""}
            currentStatus={decisions[index] ?? "pending"}
            verificationStatus={suggestion.verification?.status}
            draftId={draftId}
            isDecided={Boolean(decisions[index])}
            jdCapability={getJdCapabilityLabel(suggestion)}
            localOnly
            onActionComplete={routerRefresh}
            onDecision={(decision) => {
              setDecidedParts((previous) => {
                const nextDecisions = {
                  ...(previous[suggestion.id] || {}),
                  [index]: decision
                };

                if (Object.keys(nextDecisions).length >= beforeEntries.length) {
                  void syncGroupedSuggestionDecision({
                    afterEntries,
                    beforeEntries,
                    decisions: nextDecisions,
                    draftId,
                    onSynced: async () => {
                      markSuggestionDecision(suggestion.id, decision, groupKey);
                      await routerRefresh();
                    },
                    reasonText: suggestion.editedReasonText,
                    suggestionId: suggestion.id
                  });
                }

                return {
                  ...previous,
                  [suggestion.id]: nextDecisions
                };
              });
            }}
            onEdit={() => {}}
            onRevise={openRevision}
            onUpdateRevised={(newBody) => {
              setDraftSuggestions((current) =>
                current.map((item) => {
                  if (item.id !== suggestion.id) return item;
                  const entries = splitDatedSuggestionEntries(item.editedAfterText);
                  if (!entries[index]) return item;
                  entries[index].body = newBody;
                  return {
                    ...item,
                    editedAfterText: entries.map((nextEntry) => `${nextEntry.title} ${nextEntry.date}\n${nextEntry.body}`).join("\n\n")
                  };
                })
              );
            }}
            original={entry.body}
            originalLabel="原始简历内容"
            reason={index === 0 ? suggestion.editedReasonText : ""}
            revised={revisedEntry.body || `${revisedEntry.title} ${revisedEntry.date}`.trim()}
            suggestionId={suggestion.id}
            title={`${entry.title} ${entry.date}`.trim()}
          />
        );
      })}
    </div>
  );
}

function TSection({
  title,
  original,
  revised,
  reason,
  originalLabel = "原始简历内容",
  originalHelper,
  draftId,
  suggestionId,
  currentStatus,
  verificationStatus,
  onActionComplete,
  onEdit,
  onRevise,
  onUpdateRevised,
  onDecision,
  isDecided,
  actionAfterText,
  actionReasonText,
  jdCapability,
  localOnly = false,
  confirmOnly = false
}: {
  title: string;
  original: string;
  revised: string;
  reason: string;
  originalLabel?: string;
  originalHelper?: string;
  draftId: string;
  suggestionId: string;
  currentStatus: string;
  verificationStatus?: "pass" | "warn" | "fail";
  onActionComplete: () => Promise<void>;
  onEdit: () => void;
  onRevise: () => void;
  onUpdateRevised?: (text: string) => void;
  onDecision?: (decision: "accepted" | "rejected") => void;
  isDecided?: boolean;
  actionAfterText?: string;
  actionReasonText?: string;
  jdCapability: string;
  localOnly?: boolean;
  confirmOnly?: boolean;
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

  return (
    <div className="flex flex-col group w-full max-w-full overflow-hidden">
      <div className="mb-2 rounded-t-[1.25rem] border border-line bg-slate-50/80 px-5 py-3 border-b-0 flex flex-wrap items-center justify-between gap-4 min-w-0 w-full overflow-hidden">
        <h4 className="text-sm md:text-base font-bold text-slate-800 leading-tight min-w-0 flex-1">{title}</h4>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${localStatus === "accepted" ? "bg-emerald-50 text-emerald-700" : localStatus === "rejected" ? "bg-rose-50 text-rose-600" : "bg-white text-slate-500"}`}>
          {getSuggestionStatusLabel(localStatus)}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] border border-line rounded-b-[1.25rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow min-w-0 w-full">
        {/* Left: Original Content */}
        <div className="bg-white p-5 border-r border-line min-w-0 overflow-hidden w-full">
          <p className="text-[10px] tracking-[0.2em] font-bold text-slate-400 mb-3">{originalLabel}</p>
          <div className="text-sm leading-7 text-slate-600 whitespace-pre-wrap break-all overflow-wrap-anywhere">
            {original}
          </div>
          {originalHelper ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">{originalHelper}</p>
          ) : null}
        </div>
        
        {/* Right: Revised Content + Analysis */}
        <div className={`p-5 flex flex-col min-w-0 overflow-hidden w-full transition-colors ${localStatus === "accepted" ? "bg-emerald-50/30" : localStatus === "rejected" ? "bg-rose-50/30" : "bg-accent/5"}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] tracking-[0.2em] font-bold text-slate-400">AI 优化改写</p>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{jdCapability}</span>
          </div>
          <div className="rounded-xl bg-white/95 p-5 border border-accent/10 shadow-sm min-w-0 w-full overflow-hidden relative">
            {localIsEditing ? (
              <div className="space-y-3">
                <textarea
                  aria-label="改写后全文"
                  className="w-full min-h-[260px] border-none bg-transparent text-sm font-semibold text-slate-800 leading-relaxed outline-none focus:ring-0 p-0 resize-y"
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
              <>
                <div className={`text-sm font-semibold leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere ${localStatus === "rejected" ? "text-slate-400 line-through opacity-50" : "text-slate-800"}`}>
                  {localRevised}
                </div>
                <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                  <SuggestionActionBar
                    actionPayload={{
                      afterText: actionAfterText ?? localRevised,
                      reasonText: actionReasonText ?? reason
                    }}
                    compact
                    confirmOnly={confirmOnly}
                    currentStatus={localStatus}
                    verificationStatus={verificationStatus}
                    draftId={draftId}
                    localOnly={localOnly}
                    onAccept={() => {
                      setLocalStatus("accepted");
                      onDecision?.("accepted");
                    }}
                    onActionComplete={async () => {
                      await onActionComplete();
                    }}
                    onEdit={() => setLocalIsEditing(true)}
                    onReject={() => {
                      setLocalStatus("rejected");
                      onDecision?.("rejected");
                    }}
                    onRevise={onRevise}
                    suggestionId={suggestionId}
                  />
                </div>
              </>
            )}
          </div>
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

function findNextPendingGroupKey(groups: SuggestionGroup[], currentGroupIndex: number) {
  const nextPendingGroup = groups
    .slice(currentGroupIndex + 1)
    .find((group) => group.suggestions.some((suggestion) => suggestion.status === "pending"));

  return nextPendingGroup?.key ?? null;
}

function groupSuggestions(suggestions: EditableSuggestion[]): SuggestionGroup[] {
  const order = ["summary", "work", "project", "education", "credential", "other"];
  const labels: Record<string, { title: string }> = {
    summary: { title: "个人优势" },
    work: { title: "工作经历" },
    project: { title: "项目经历" },
    education: { title: "教育背景" },
    credential: { title: "证书与技能（不进入简历独立模块）" },
    other: { title: "其他经历" }
  };
  const buckets = new Map<string, EditableSuggestion[]>();

  for (const suggestion of suggestions) {
    const key = normalizeSectionKey(suggestion.section);
    buckets.set(key, [...(buckets.get(key) ?? []), suggestion]);
  }

  return order
    .filter((key) => buckets.has(key))
    .map((key) => ({
      key,
      title: labels[key].title,
      suggestions: buckets.get(key) ?? []
    }));
}

function normalizeSectionKey(section: string) {
  const normalized = section.toLowerCase();
  if (["summary", "advantage", "profile"].includes(normalized)) return "summary";
  if (["experience", "work"].includes(normalized)) return "work";
  if (normalized.includes("project")) return "project";
  if (normalized.includes("education")) return "education";
  if (["skill", "certificate", "supplement", "credential"].includes(normalized)) return "credential";
  return "other";
}

function getJdCapabilityLabel(suggestion: WorkspaceSuggestion) {
  if (suggestion.jdAbility?.trim()) {
    return `对应：${suggestion.jdAbility.trim()}`;
  }

  const text = `${suggestion.title} ${suggestion.beforeText} ${suggestion.afterText} ${suggestion.reasonText}`.toLowerCase();

  if (/prompt|提示词|llm|大模型|ai 工具|ai工具|agent/u.test(text)) return "对应：AI 工具 / Prompt 应用";
  if (/产品|需求|mvp|流程|工作流|迭代|原型/u.test(text)) return "对应：产品流程与需求拆解";
  if (/数据|excel|tableau|分析|指标|统计/u.test(text)) return "对应：数据分析与结果表达";
  if (/运营|内容|小红书|公众号|传播|账号/u.test(text)) return "对应：内容运营与用户沟通";
  if (/客户|b 端|协作|方案|交付|培训/u.test(text)) return "对应：B 端沟通与方案推进";
  return "对应：岗位相关经历表达";
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

function firstUsefulLine(text: string) {
  return (
    text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean) ?? text.trim()
  );
}
