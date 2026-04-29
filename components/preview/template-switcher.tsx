"use client";

import React from "react";
import type { ResumeTemplateKey } from "@/lib/document/resume-document";

type TemplateSwitcherProps = {
  currentTemplate: ResumeTemplateKey;
  onChange: (templateKey: ResumeTemplateKey) => void;
};

const templates = [
  { key: "professional-cn", label: "Professional CN" },
  { key: "ats-clean", label: "ATS Clean" }
] as const satisfies Array<{ key: ResumeTemplateKey; label: string }>;

export function TemplateSwitcher({ currentTemplate, onChange }: TemplateSwitcherProps) {
  return (
    <div className="flex gap-1">
      {templates.map((t) => (
        <button
          key={t.key}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            currentTemplate === t.key
              ? "bg-accent text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          type="button"
          aria-pressed={currentTemplate === t.key}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
