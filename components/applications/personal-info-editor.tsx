"use client";

import React from "react";
import type { CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";

type PersonalInfoEditorProps = {
  draftId: string;
  personalInfo?: CalibratedResumeProfile["personalInfo"];
};

const fields: Array<{
  key: keyof NonNullable<PersonalInfoEditorProps["personalInfo"]>;
  label: string;
  placeholder: string;
}> = [
  { key: "name", label: "姓名", placeholder: "未填写" },
  { key: "phone", label: "手机", placeholder: "可补充手机号" },
  { key: "email", label: "邮箱", placeholder: "可补充邮箱" },
  { key: "educationSummary", label: "学历", placeholder: "学校 · 学历" },
  { key: "location", label: "居住地", placeholder: "可选" },
  { key: "github", label: "GitHub", placeholder: "可选" },
  { key: "portfolio", label: "作品集", placeholder: "可选" }
];

export function PersonalInfoEditor({ draftId, personalInfo }: PersonalInfoEditorProps) {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, personalInfo?.[field.key] ?? ""]))
  );
  const [status, setStatus] = React.useState<"idle" | "dirty" | "saving" | "saved" | "failed">("idle");

  React.useEffect(() => {
    setValues(Object.fromEntries(fields.map((field) => [field.key, personalInfo?.[field.key] ?? ""])));
  }, [personalInfo]);

  return (
    <section className="rounded-[1.75rem] border border-line bg-white/90 p-6 shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-accent">已识别信息</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">个人信息</h2>
        </div>
        <p className="text-xs leading-5 text-slate-500">原简历已识别的信息会自动填充，空缺项可手动补充，均不强制。</p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {fields.map((field) => (
          <label key={field.key} className="rounded-2xl border border-line bg-paper px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{field.label}</span>
            <input
              className="mt-2 w-full border-none bg-transparent p-0 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
              onChange={(event) => {
                setValues((current) => ({ ...current, [field.key]: event.target.value }));
                setStatus("dirty");
              }}
              placeholder={field.placeholder}
              value={values[field.key] ?? ""}
            />
          </label>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
        <p className="text-xs text-slate-500">
          {status === "dirty"
            ? "有未保存修改。"
            : status === "saving"
              ? "正在保存..."
              : status === "saved"
                ? "已保存到当前草稿。"
                : status === "failed"
                  ? "保存失败，请稍后重试。"
                  : "修改后保存，后续同步预览会读取最新草稿。"}
        </p>
        <button
          className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-accent hover:text-accent disabled:opacity-50"
          disabled={status === "saving"}
          onClick={async () => {
            setStatus("saving");
            const response = await fetch(`/api/drafts/${draftId}/personal-info`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ personalInfo: values })
            });
            setStatus(response.ok ? "saved" : "failed");
          }}
          type="button"
        >
          保存到草稿
        </button>
      </div>
    </section>
  );
}
