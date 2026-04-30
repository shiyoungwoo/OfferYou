import React from "react";
import type { CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";

type ResumeCalibrationPanelProps = {
  calibratedResume?: CalibratedResumeProfile;
};

export function ResumeCalibrationPanel({ calibratedResume }: ResumeCalibrationPanelProps) {
  if (!calibratedResume) {
    return (
      <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">简历结构校准</p>
        <h2 className="mt-3 text-2xl font-semibold">先把原始简历恢复成稳定结构</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          上传简历后，系统会先恢复姓名、联系方式、工作经历、项目经历和教育背景，再进入岗位定制。这里不替代人工确认，只负责把解析结果整理成可复查的结构。
        </p>
      </section>
    );
  }

  const statusLabel =
    calibratedResume.status === "confirmed" ? "结构已确认" : calibratedResume.status === "needs_review" ? "需要确认" : "待校准";

  return (
    <section className="rounded-[1.75rem] border border-line bg-white/85 p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">简历结构校准</p>
          <h2 className="mt-3 text-2xl font-semibold">先把原始简历恢复成稳定结构</h2>
        </div>
        <span className="rounded-full border border-accent/20 bg-accent/5 px-4 py-2 text-sm font-semibold text-accent">
          {statusLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[1.2rem] border border-line bg-paper px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">个人信息</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            <InfoLine label="姓名" value={calibratedResume.personalInfo.name} />
            <InfoLine label="手机" value={calibratedResume.personalInfo.phone} />
            <InfoLine label="邮箱" value={calibratedResume.personalInfo.email} />
            <InfoLine label="作品集" value={calibratedResume.personalInfo.portfolio} />
            <InfoLine label="GitHub" value={calibratedResume.personalInfo.github} />
            <InfoLine label="学历摘要" value={calibratedResume.personalInfo.educationSummary} />
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-line bg-paper px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">模型说明</p>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            当前结构来自 {getCalibrationSourceLabel(calibratedResume.modelProvider)}。
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-700">{getCalibrationNote(calibratedResume)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="rounded-[1.2rem] border border-line bg-paper px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">模块列表</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {calibratedResume.entries.map((entry) => (
              <div key={entry.id} className="rounded-[1rem] border border-white bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {entry.section}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{entry.title}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  置信度：{entry.confidence}。{entry.issues.length > 0 ? entry.issues.join(" ") : "暂无额外问题。"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {calibratedResume.parseWarnings.length > 0 ? (
          <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-700">解析提示</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
              {calibratedResume.parseWarnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {calibratedResume.unclassifiedText.length > 0 ? (
          <div className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">待归类内容</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {calibratedResume.unclassifiedText.slice(0, 3).join(" · ")}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <p>
      <span className="font-semibold text-slate-900">{label}：</span>
      {value || "未填写"}
    </p>
  );
}

function getCalibrationSourceLabel(provider?: string) {
  if (provider === "gemini") return "Gemini 多模态校准";
  if (provider === "openai_compatible") return "小米 MiMo 文本校准";
  return "OpenDataLoader PDF 解析 + 结构规则校准";
}

function getCalibrationNote(calibratedResume: CalibratedResumeProfile) {
  if (calibratedResume.status === "confirmed") {
    return "姓名、联系方式和主要经历模块已恢复，可继续查看岗位改写建议。";
  }

  if (calibratedResume.modelProvider === "openai_compatible") {
    return calibratedResume.modelNotes.join(" ") || "已完成文本模型校准，请核对低置信字段。";
  }

  return "部分字段仍需人工确认；确认前不会直接进入最终投递稿。";
}
