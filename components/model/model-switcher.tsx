"use client";

import React from "react";
import { Cpu } from "lucide-react";
import { useModelPreference } from "@/components/model/use-model-preference";

export function ModelSwitcher() {
  const { provider, setProvider, loading, options } = useModelPreference();

  if (loading) {
    return (
      <div className="rounded-[1.2rem] border border-black/5 bg-white/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-slate-400" />
          <span className="text-xs text-slate-400">加载模型...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-[1.2rem] border border-black/5 bg-white/80 px-4 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <Cpu size={14} className="text-accent" />
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">当前模型</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            title={opt.label}
            className={`min-w-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              provider === opt.key
                ? "bg-accent text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => setProvider(opt.key)}
          >
            <span className="block truncate">{opt.shortLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
