"use client";

import React from "react";

type TemplateSwitcherProps = {
  currentTemplate: string;
};

export function TemplateSwitcher({ currentTemplate }: TemplateSwitcherProps) {
  return (
    <div className="rounded-[1.4rem] border border-line bg-white/85 p-4 shadow-card">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Template</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white" type="button">
          {currentTemplate}
        </button>
        <button className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold text-slate-600" type="button">
          template_b
        </button>
      </div>
    </div>
  );
}
