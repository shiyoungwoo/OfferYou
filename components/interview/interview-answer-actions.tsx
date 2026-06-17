"use client";

import React from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Sparkles } from "lucide-react";

type InterviewAnswerActionsProps = {
  optimizeAction: (formData: FormData) => Promise<void>;
};

export function InterviewAnswerActions({ optimizeAction }: InterviewAnswerActionsProps) {
  const { pending, action } = useFormStatus();
  const isOptimizing = pending && action === optimizeAction;
  const isSaving = pending && !isOptimizing;

  return (
    <div className="flex flex-wrap gap-3">
      <button
        aria-busy={isSaving}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
        disabled={pending}
        type="submit"
      >
        <CheckCircle2 size={16} />
        {isSaving ? "正在保存..." : "保存答案草稿"}
      </button>
      <button
        aria-busy={isOptimizing}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#1677ff] bg-white px-4 py-2 text-sm font-semibold text-[#1677ff] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
        disabled={pending}
        formAction={optimizeAction}
        type="submit"
      >
        <Sparkles size={16} />
        {isOptimizing ? "正在优化..." : "AI 优化答案"}
      </button>
    </div>
  );
}
