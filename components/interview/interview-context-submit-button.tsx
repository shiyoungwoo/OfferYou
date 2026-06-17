"use client";

import React from "react";
import { useFormStatus } from "react-dom";

export function InterviewContextSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className="w-fit rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
      disabled={pending}
      type="submit"
    >
      {pending ? "正在保存并重新生成..." : "保存资料并重新生成"}
    </button>
  );
}
