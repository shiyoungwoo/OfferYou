"use client";

import React from "react";

type TemplateSwitcherProps = {
  currentTemplate: string;
};

const templates = [
  { key: "template_a", label: "经典" },
  { key: "template_b", label: "简约" }
];

export function TemplateSwitcher({ currentTemplate }: TemplateSwitcherProps) {
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
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
