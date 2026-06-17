"use client";

import React from "react";
import { Upload, X, FileText } from "lucide-react";

type InputMode = "text" | "file";

export function ModeSwitcher({
  activeMode,
  onChange,
  textLabel,
  fileLabel
}: {
  activeMode: InputMode;
  onChange: (mode: InputMode) => void;
  textLabel: string;
  fileLabel: string;
}) {
  return (
    <div className="inline-flex rounded-full border border-black/5 bg-paper p-1">
      <button
        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
          activeMode === "text" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
        }`}
        onClick={() => onChange("text")}
        type="button"
      >
        {textLabel}
      </button>
      <button
        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
          activeMode === "file" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"
        }`}
        onClick={() => onChange("file")}
        type="button"
      >
        {fileLabel}
      </button>
    </div>
  );
}

export function UploadCard({
  title,
  helper,
  icon,
  uploadName,
  uploadState,
  onChange,
  onClear,
  accept
}: {
  title: string;
  helper: string;
  icon: React.ReactNode;
  uploadName: string | null;
  uploadState: string | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  accept: string;
}) {
  return (
    <div className="relative flex min-h-[220px] flex-col items-center justify-center rounded-[1.4rem] border-2 border-dashed border-slate-200 bg-paper px-6 py-8 text-center">
      {uploadName ? (
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">{title}</p>
            <p className="mt-2 max-w-[280px] break-all text-sm text-slate-700">{uploadName}</p>
            {uploadState ? <p className="mt-2 text-xs leading-5 text-slate-500">{uploadState}</p> : null}
          </div>
          <button
            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600"
            onClick={onClear}
            type="button"
          >
            <X size={14} />
            清除
          </button>
        </div>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            {icon}
          </div>
          <p className="mt-4 text-base font-semibold text-slate-950">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900">
            <Upload size={16} />
            选择文件
            <input accept={accept} className="sr-only" onChange={onChange} type="file" aria-label={`上传${title}`} />
          </label>
        </>
      )}
    </div>
  );
}

export async function uploadSourceFile({
  file,
  kind
}: {
  file: File;
  kind: "resume_source" | "jd_source" | "profile_photo";
}) {
  const textTypes = ["text/plain", "text/markdown", "application/json"];
  let textFallback = "";
  if (textTypes.includes(file.type) || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    textFallback = await file.text();
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);

  const response = await fetch("/api/uploads/ingest", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as {
    assetRef: string;
    extractedText: string;
    extractionState: "full_text" | "partial_text" | "stored_only";
    company?: string;
    jobTitle?: string;
  };

  return {
    ...result,
    extractedText: result.extractedText || textFallback
  };
}
