"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
  X
} from "lucide-react";
import type { ApplicationDraftDefaults } from "@/lib/services/talent/application-draft-defaults";

type NewApplicationFormProps = {
  selectedLane?: string;
  draftDefaults: ApplicationDraftDefaults;
};

type InputMode = "text" | "file";

export function NewApplicationForm({ selectedLane, draftDefaults }: NewApplicationFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [company, setCompany] = useState(draftDefaults.company);
  const [jobTitle, setJobTitle] = useState(draftDefaults.jobTitle);
  const [jdContent, setJdContent] = useState(draftDefaults.jdContent);
  const [resumeAssetRef, setResumeAssetRef] = useState(draftDefaults.resumeAssetRef);
  const [resumeContent, setResumeContent] = useState("");
  const [jdUploadName, setJdUploadName] = useState<string | null>(null);
  const [resumeUploadName, setResumeUploadName] = useState<string | null>(null);
  const [jdUploadState, setJdUploadState] = useState<string | null>(null);
  const [resumeUploadState, setResumeUploadState] = useState<string | null>(null);
  const [resumeMode, setResumeMode] = useState<InputMode>("text");
  const [jdMode, setJdMode] = useState<InputMode>("text");
  const [jdExtracting, setJdExtracting] = useState(false);

  async function extractJobInfoFromText(text: string) {
    if (text.trim().length < 30) return;
    setJdExtracting(true);
    try {
      const resp = await fetch("/api/uploads/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, kind: "jd_source" })
      });
      if (resp.ok) {
        const result = (await resp.json()) as { company?: string; jobTitle?: string };
        if (result.company && (!company || company === "OfferYou 示例岗位")) setCompany(result.company);
        if (result.jobTitle && (!jobTitle || jobTitle === "客户成功经理")) setJobTitle(result.jobTitle);
      }
    } catch { /* ignore */ }
    setJdExtracting(false);
  }

  async function handleJdFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { clearJdUpload(); return; }

    setJdUploadName(file.name);
    setJdUploadState("正在上传...");
    const uploaded = await uploadSourceFile({ file, kind: "jd_source" });
    if (!uploaded) { setJdUploadState("上传失败，请重试。"); return; }

    setJdContent(uploaded.extractedText || `已上传：${file.name}，请手动补充关键要求。`);
    if (uploaded.company && (!company || company === "OfferYou 示例岗位")) setCompany(uploaded.company);
    if (uploaded.jobTitle && (!jobTitle || jobTitle === "客户成功经理")) setJobTitle(uploaded.jobTitle);
    setJdUploadState(uploaded.extractionState === "full_text" ? "已提取完成。" : "已提取部分内容，请核对。");
  }

  async function handleResumeFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { clearResumeUpload(); return; }

    setResumeUploadName(file.name);
    setResumeUploadState("正在上传...");
    const uploaded = await uploadSourceFile({ file, kind: "resume_source" });
    if (!uploaded) { setResumeUploadState("上传失败，请重试。"); return; }

    setResumeAssetRef(uploaded.assetRef);
    if (uploaded.extractedText) setResumeContent(uploaded.extractedText);
    setResumeUploadState(uploaded.extractionState === "full_text" ? "已提取完成。" : "已提取部分内容，请核对。");
  }

  function clearResumeUpload() { setResumeUploadName(null); setResumeUploadState(null); setResumeAssetRef(""); }
  function clearJdUpload() { setJdUploadName(null); setJdUploadState(null); }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      language: "zh" as const,
      masterResumeId: "default-master",
      careerDirectionSlug: selectedLane || undefined,
      jdContent: jdContent.trim(),
      resumeAssetRef: resumeAssetRef.trim() || undefined,
      resumeContent: resumeContent.trim() || undefined
    };

    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { id?: string; error?: unknown };
      if (!response.ok || !result.id) {
        setError("创建失败，请确认岗位信息、JD 与简历都已填写。");
        return;
      }
      router.push(`/applications/${result.id}`);
    });
  }

  const sectionCls = "rounded-xl border border-black/5 bg-white/90 p-5 shadow-sm";

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      {/* 岗位信息 */}
      <div className={sectionCls}>
        <p className="text-sm font-semibold text-[#1f1f1f] mb-3">岗位信息</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            <span>目标岗位</span>
            <input className={fieldClassName} onChange={(e) => setJobTitle(e.target.value)} placeholder="AI 产品经理" value={jobTitle} required minLength={2} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            <span>目标公司</span>
            <input className={fieldClassName} onChange={(e) => setCompany(e.target.value)} placeholder="某某科技" value={company} required minLength={2} />
          </label>
        </div>
      </div>

      {/* 简历来源 */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[#1f1f1f]">简历来源</p>
          <ModeSwitcher activeMode={resumeMode} fileLabel="上传文件" onChange={setResumeMode} textLabel="直接粘贴" />
        </div>
        {resumeMode === "text" ? (
          <textarea
            className={`${fieldClassName} min-h-[180px] resize-y`}
            onChange={(e) => setResumeContent(e.target.value)}
            placeholder="粘贴当前简历正文..."
            value={resumeContent}
          />
        ) : (
          <UploadCard
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.doc,.docx"
            helper="支持 PDF、Word、TXT、图片"
            icon={<FileText className="text-blue-600" size={20} />}
            onChange={handleResumeFileChange}
            title="上传现有简历"
            uploadName={resumeUploadName}
            uploadState={resumeUploadState}
            onClear={clearResumeUpload}
          />
        )}
        {resumeUploadState && resumeMode === "text" && <p className="mt-2 text-xs text-slate-500">{resumeUploadState}</p>}
      </div>

      {/* 岗位 JD */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[#1f1f1f]">岗位 JD</p>
          <ModeSwitcher activeMode={jdMode} fileLabel="上传文件" onChange={setJdMode} textLabel="直接粘贴" />
        </div>
        {jdMode === "text" ? (
          <div className="relative">
            <textarea
              className={`${fieldClassName} min-h-[180px] resize-y`}
              onChange={(e) => setJdContent(e.target.value)}
              onBlur={() => extractJobInfoFromText(jdContent)}
              placeholder="粘贴岗位描述、职责、要求..."
              value={jdContent}
            />
            {jdExtracting && <span className="absolute bottom-2 right-3 text-xs text-slate-400">正在识别岗位信息...</span>}
          </div>
        ) : (
          <UploadCard
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.doc,.docx"
            helper="支持 PDF、图片、Word、TXT"
            icon={<ImageIcon className="text-indigo-600" size={20} />}
            onChange={handleJdFileChange}
            title="上传 JD 文件"
            uploadName={jdUploadName}
            uploadState={jdUploadState}
            onClear={clearJdUpload}
          />
        )}
      </div>

      {/* 提交 */}
      <button
        className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition ${isPending ? "bg-slate-400" : "bg-ink hover:bg-slate-900"}`}
        disabled={isPending}
        type="submit"
      >
        {isPending ? <><Loader2 className="animate-spin" size={18} />正在生成...</> : "开始分析"}
      </button>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    </form>
  );
}

function ModeSwitcher({
  activeMode, onChange, textLabel, fileLabel
}: {
  activeMode: InputMode;
  onChange: (mode: InputMode) => void;
  textLabel: string;
  fileLabel: string;
}) {
  return (
    <div className="inline-flex rounded-full border border-black/5 bg-paper p-0.5">
      <button className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${activeMode === "text" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => onChange("text")} type="button">{textLabel}</button>
      <button className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${activeMode === "file" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`} onClick={() => onChange("file")} type="button">{fileLabel}</button>
    </div>
  );
}

function UploadCard({
  title, helper, icon, uploadName, uploadState, onChange, onClear, accept
}: {
  title: string; helper: string; icon: React.ReactNode; uploadName: string | null;
  uploadState: string | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void; accept: string;
}) {
  return (
    <div className="relative flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-paper px-6 py-6 text-center">
      {uploadName ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">{icon}</div>
          <p className="text-sm font-semibold text-slate-950">{uploadName}</p>
          {uploadState && <p className="text-xs text-slate-500">{uploadState}</p>}
          <button className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-600" onClick={onClear} type="button"><X size={12} />清除</button>
        </div>
      ) : (
        <>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">{icon}</div>
          <p className="mt-3 text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-xs text-slate-600">{helper}</p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900">
            <Upload size={14} />选择文件
            <input accept={accept} className="sr-only" onChange={onChange} type="file" />
          </label>
        </>
      )}
    </div>
  );
}

async function uploadSourceFile({ file, kind }: { file: File; kind: "resume_source" | "jd_source" | "profile_photo" }) {
  const textTypes = ["text/plain", "text/markdown", "application/json"];
  let textFallback = "";
  if (textTypes.includes(file.type) || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    textFallback = await file.text();
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);
  const response = await fetch("/api/uploads/ingest", { method: "POST", body: formData });
  if (!response.ok) return null;
  const result = (await response.json()) as { assetRef: string; extractedText: string; extractionState: "full_text" | "partial_text" | "stored_only"; company?: string; jobTitle?: string };
  return { ...result, extractedText: result.extractedText || textFallback };
}

const fieldClassName = "w-full rounded-xl border border-black/5 bg-paper px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-accent";
