"use client";

import React, { useTransition } from "react";

type SuggestionActionBarProps = {
  draftId: string;
  suggestionId: string;
  currentStatus?: string;
  verificationStatus?: "pass" | "warn" | "fail";
  onEdit: () => void;
  onRevise: () => void;
  onActionComplete: () => Promise<void> | void;
  onAccept?: () => void;
  onReject?: () => void;
  actionPayload?: {
    afterText?: string;
    reasonText?: string;
  };
  localOnly?: boolean;
  compact?: boolean;
  confirmOnly?: boolean;
};

export function SuggestionActionBar({
  draftId,
  suggestionId,
  currentStatus = "pending",
  verificationStatus,
  onEdit,
  onRevise,
  onActionComplete,
  onAccept,
  onReject,
  actionPayload,
  localOnly = false,
  compact = false,
  confirmOnly = false
}: SuggestionActionBarProps) {
  const isFailedVerification = verificationStatus === "fail";
  const [isPending, startTransition] = useTransition();

  function runSimpleAction(action: "accept" | "reject", e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      if (localOnly) {
        if (action === "accept") {
          onAccept?.();
        } else {
          onReject?.();
        }
        await onActionComplete();
        return;
      }

      const response = await fetch(`/api/drafts/${draftId}/suggestions/${suggestionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, ...actionPayload })
      });

      if (!response.ok) {
        return;
      }

      if (action === "accept") {
        onAccept?.();
      } else {
        onReject?.();
      }

      await onActionComplete();
    });
  }

  if (compact) {
    return (
      <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
        {isFailedVerification && currentStatus === "pending" && (
          <span className="text-[10px] text-rose-500 font-medium">未通过事实校验，需编辑或 AI 微调。</span>
        )}
        <button
          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
            currentStatus === "accepted"
              ? "bg-emerald-600 text-white"
              : isFailedVerification
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-ink text-white hover:bg-slate-800"
          }`}
          disabled={isPending || (isFailedVerification && currentStatus === "pending")}
          onClick={(e) => runSimpleAction("accept", e)}
        >
          {currentStatus === "accepted" ? "已接受" : isFailedVerification ? "需编辑后确认" : "接受"}
        </button>
        <button
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
          disabled={isPending}
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          编辑
        </button>
        {!confirmOnly && (
          <>
            <button
              className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
                currentStatus === "rejected"
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              disabled={isPending}
              onClick={(e) => runSimpleAction("reject", e)}
            >
              {currentStatus === "rejected" ? "已拒绝" : "拒绝"}
            </button>
            <button
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
              disabled={isPending}
              onClick={(e) => { e.stopPropagation(); onRevise(); }}
            >
              微调
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {isFailedVerification && currentStatus === "pending" && (
        <p className="w-full text-xs text-rose-500 font-medium">未通过事实校验，需编辑或 AI 微调后再确认。</p>
      )}
      <button
        className={`rounded-full px-4 py-2 text-sm font-semibold transition shadow-sm ${
          currentStatus === "accepted"
            ? "bg-emerald-600 text-white"
            : isFailedVerification
              ? "bg-slate-300 text-slate-500 cursor-not-allowed"
              : "bg-ink text-white disabled:opacity-60"
        }`}
        disabled={isPending || (isFailedVerification && currentStatus === "pending")}
        onClick={(e) => runSimpleAction("accept", e)}
        type="button"
      >
        {currentStatus === "accepted" ? "已接受该建议" : isFailedVerification ? "需编辑后确认" : "接受建议"}
      </button>
      <button
        className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        disabled={isPending}
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        type="button"
      >
        编辑
      </button>
      {!confirmOnly && (
        <>
          <button
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              currentStatus === "rejected"
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-line bg-white text-slate-700 disabled:opacity-60"
            }`}
            disabled={isPending}
            onClick={(e) => runSimpleAction("reject", e)}
            type="button"
          >
            {currentStatus === "rejected" ? "已拒绝建议" : "拒绝"}
          </button>
          <button
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            disabled={isPending}
            onClick={(e) => { e.stopPropagation(); onRevise(); }}
            type="button"
          >
            继续微调
          </button>
        </>
      )}
    </div>
  );
}
