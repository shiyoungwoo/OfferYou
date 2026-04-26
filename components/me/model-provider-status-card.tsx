import React from "react";
import type { ReactNode } from "react";
import type { ModelProviderInfo } from "@/lib/ai/model-provider-config";

type ModelProviderStatusCardProps = {
  providers: ModelProviderInfo[];
};

export function ModelProviderStatusCard({ providers }: ModelProviderStatusCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <p className="text-sm uppercase tracking-[0.24em] text-slate-500">模型状态</p>
      <h2 className="mt-3 text-2xl font-semibold">当前可用的模型供应商</h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        这里显示当前环境能直接使用的模型来源。没有配置时会自动落到确定性回退，不会展示任何密钥原文。
      </p>

      <div className="mt-5 grid gap-3">
        {providers.map((provider) => (
          <div key={provider.key} className="rounded-[1.2rem] border border-line bg-paper px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{provider.label}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{provider.key}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={provider.available ? "success" : "muted"}>
                  {provider.available ? "可用" : "未配置"}
                </StatusPill>
                {provider.default ? <StatusPill tone="accent">默认</StatusPill> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ tone, children }: { tone: "success" | "accent" | "muted"; children: ReactNode }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "accent"
        ? "border-accent/20 bg-accent/5 text-accent"
        : "border-line bg-white text-slate-600";

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}
