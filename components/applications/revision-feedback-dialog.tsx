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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  function submitRevision() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/drafts/${draftId}/suggestions/${suggestionId}`, {
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

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setErrorMsg(body?.error ?? "提交失败，请稍后重试。");
          return;
        }

        setFeedbackText("");
        onClose();
        await onActionComplete();
      } catch {
        setErrorMsg("网络请求失败，请检查网络后重试。");
      }
    });
  }

  return (
    <div className="mt-4 rounded-[1.35rem] border border-accent/20 bg-accent/5 p-4">
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          反馈类型
          <select
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm"
            onChange={(event) => setFeedbackType(event.target.value as (typeof feedbackOptions)[number])}
            value={feedbackType}
          >
            {feedbackOptions.map((option) => (
              <option key={option} value={option}>
                {getFeedbackLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          反馈内容
          <textarea
            className="min-h-28 rounded-2xl border border-line bg-white px-4 py-3 text-sm"
            onChange={(event) => setFeedbackText(event.target.value)}
            placeholder="说明这条建议要怎么改，或者补充真实来源材料。"
            value={feedbackText}
          />
        </label>

        {errorMsg && <p className="text-xs text-rose-500">{errorMsg}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isPending || !feedbackText.trim()}
            onClick={submitRevision}
            type="button"
          >
            {isPending ? "提交中…" : "提交反馈"}
          </button>
          <button
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function getFeedbackLabel(option: (typeof feedbackOptions)[number]) {
  switch (option) {
    case "too_generic":
      return "太泛";
    case "too_aggressive":
      return "太激进";
    case "not_my_style":
      return "不像我的风格";
    case "fact_inaccurate":
      return "事实不准";
    case "wrong_focus":
      return "重点不对";
    case "adding_new_fact":
      return "新增了事实";
    case "custom":
      return "自定义";
  }
}
