"use client";

import React, { useMemo, useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { ExportPdfButton } from "@/components/preview/export-pdf-button";
import { MarkAppliedButton } from "@/components/preview/mark-applied-button";
import { ResumePreview } from "@/components/preview/resume-preview";
import { TemplateSwitcher } from "@/components/preview/template-switcher";
import { normalizeResumeTemplateKey, type ResumeDocument, type ResumeDocumentEntryItem } from "@/lib/document/resume-document";

type PreviewWorkspaceProps = {
  draftId: string;
  initialDocument: ResumeDocument;
  canCreateApplicationRecord?: boolean;
};

export function PreviewWorkspace({ draftId, initialDocument, canCreateApplicationRecord = false }: PreviewWorkspaceProps) {
  const normalizedInitialDocument = useMemo(
    () => ({
      ...initialDocument,
      templateKey: normalizeResumeTemplateKey(initialDocument.templateKey)
    }),
    [initialDocument]
  );
  const [document, setDocument] = useState(normalizedInitialDocument);
  const [savedDocument, setSavedDocument] = useState(normalizedInitialDocument);
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const contentRef = useRef<HTMLDivElement>(null);
  const [realPageCount, setRealPageCount] = useState(1);
  const [squishLevel, setSquishLevel] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (contentRef.current) {
        const height = contentRef.current.scrollHeight;
        const count = Math.max(1, Math.ceil(height / 1123));
        setRealPageCount((current) => (current === count ? current : count));
        setSquishLevel((current) => {
          const next = getStableSquishLevel(height, current);
          return current === next ? current : next;
        });
      }
    };

    if (typeof ResizeObserver === "undefined") {
      measure();
      return;
    }

    const observer = new ResizeObserver(measure);
    if (contentRef.current) observer.observe(contentRef.current);
    measure();
    return () => observer.disconnect();
  }, [document]);

  const dirty = useMemo(() => JSON.stringify(document) !== JSON.stringify(savedDocument), [document, savedDocument]);
  const currentTemplate = normalizeResumeTemplateKey(document.templateKey);
  const personalInfoValue = useMemo(() => getPersonalInfoValue(document), [document]);

  function updateHeader(field: "name" | "title", value: string) {
    setDocument((c) => ({ ...c, header: { ...c.header, [field]: value } }));
  }

  function updateTemplateKey(templateKey: ResumeDocument["templateKey"]) {
    setDocument((c) => ({ ...c, templateKey }));
  }

  function updatePersonalInfo(value: string) {
    const lines = splitLines(value);
    setDocument((c) => {
      const personalInfoSection = {
        id: "personal-info",
        title: "个人信息",
        tone: "hero" as const,
        items: lines.map((text) => ({ type: "text" as const, text }))
      };
      const hasPersonalInfo = c.sections.some((section) => section.id === "personal-info");
      const sections = hasPersonalInfo
        ? c.sections.map((section) => (section.id === "personal-info" ? personalInfoSection : section))
        : [personalInfoSection, ...c.sections];

      return {
        ...c,
        header: { ...c.header, contacts: lines },
        sections
      };
    });
  }

  function updateTextItem(si: number, ii: number, value: string) {
    setDocument((c) => {
      const sections = [...c.sections];
      const section = { ...sections[si] };
      const items = [...section.items];
      if (items[ii]?.type !== "text") return c;
      items[ii] = { ...items[ii], text: value };
      section.items = items;
      sections[si] = section;
      return { ...c, sections };
    });
  }

  function updateEntryItem(si: number, ii: number, field: keyof ResumeDocumentEntryItem, value: string) {
    setDocument((c) => {
      const sections = [...c.sections];
      const section = { ...sections[si] };
      const items = [...section.items];
      const item = items[ii];
      if (item?.type !== "entry") return c;
      items[ii] = {
        ...item,
        [field]: field === "bullets" ? value.split("\n").map((s) => s.trim()).filter(Boolean) : value || undefined
      };
      section.items = items;
      sections[si] = section;
      return { ...c, sections };
    });
  }

  function saveDocument() {
    startTransition(async () => {
      setSaveMessage(null);
      const res = await fetch(`/api/drafts/${draftId}/snapshot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document })
      });
      if (!res.ok) { setSaveMessage("保存失败"); return; }
      setSavedDocument(document);
      setSaveMessage("已保存");
    });
  }

  function addTextItem(si: number) {
    setDocument((c) => {
      const sections = [...c.sections];
      const section = { ...sections[si] };
      section.items = [...section.items, { type: "text" as const, text: "" }];
      sections[si] = section;
      return { ...c, sections };
    });
  }

  function addEntryItem(si: number) {
    setDocument((c) => {
      const sections = [...c.sections];
      const section = { ...sections[si] };
      section.items = [...section.items, { type: "entry" as const, heading: "新条目", subheading: "", meta: "", summary: "", bullets: [] }];
      sections[si] = section;
      return { ...c, sections };
    });
  }

  function removeItem(si: number, ii: number) {
    setDocument((c) => {
      const sections = [...c.sections];
      const section = { ...sections[si] };
      section.items = section.items.filter((_, i) => i !== ii);
      sections[si] = section;
      return { ...c, sections };
    });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* ─── Unified toolbar ─── */}
      <nav className="flex w-full max-w-[794px] items-center gap-px rounded-full border border-line bg-white/90 p-1 shadow-card overflow-x-auto no-scrollbar">
        {/* Left: template + edit */}
        <div className="flex items-center gap-1 pl-2">
          <TemplateSwitcher currentTemplate={currentTemplate} onChange={updateTemplateKey} />
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              isEditing ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            aria-label={isEditing ? "收起预览编辑器" : "编辑当前预览"}
            onClick={() => setIsEditing((v) => !v)}
            type="button"
          >
            {isEditing ? "收起编辑" : "编辑当前预览"}
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: return + export */}
        <div className="flex items-center gap-1 pr-1">
          {realPageCount > 1 && (
            <span className="rounded-full border border-rose-100 bg-rose-50/50 px-3 py-1.5 text-[10px] font-medium tracking-wider text-rose-700 transition">
              超出一页 ({realPageCount} 页)，建议裁剪
            </span>
          )}
          <Link
            className="rounded-full bg-slate-900 px-6 py-2 text-xs font-bold text-white transition hover:bg-slate-800 shadow-md active:scale-95 flex items-center gap-2"
            href={`/applications/${draftId}`}
          >
            <span>←</span>
            返回分析工作台
          </Link>
          <button
            className="rounded-full border border-line bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || !dirty}
            onClick={saveDocument}
            type="button"
          >
            {isPending ? "保存中…" : dirty ? "保存简历" : "已保存"}
          </button>
          <ExportPdfButton document={document} draftId={draftId} />
          <MarkAppliedButton draftId={draftId} disabled={!canCreateApplicationRecord} />
        </div>
      </nav>

      {/* ─── Collapsible edit panel ─── */}
      {isEditing ? (
        <section className="w-full max-w-[794px] rounded-2xl border border-line bg-white/90 p-5 shadow-card">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              姓名
              <input className="rounded-lg border border-line px-3 py-1.5 text-sm" onChange={(e) => updateHeader("name", e.target.value)} value={document.header.name} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              目标岗位
              <input className="rounded-lg border border-line px-3 py-1.5 text-sm" onChange={(e) => updateHeader("title", e.target.value)} value={document.header.title} />
            </label>
          </div>

          <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
            个人信息
            <textarea
              className="min-h-20 rounded-lg border border-line px-3 py-2 text-sm"
              onChange={(e) => updatePersonalInfo(e.target.value)}
              placeholder="手机：138 0000 0000&#10;邮箱：name@example.com&#10;居住地：深圳&#10;GitHub：github.com/example"
              value={personalInfoValue}
            />
          </label>

          {document.sections
            .map((section, si) => ({ section, si }))
            .filter(({ section }) => section.id !== "personal-info")
            .map(({ section, si }) => (
            <div key={section.id} className="mt-3 rounded-xl border border-line bg-paper p-3">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {section.title}
                <div className="flex gap-1">
                  <button
                    aria-label="新增文本"
                    className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] text-slate-600"
                    onClick={() => addTextItem(si)}
                    type="button"
                  >
                    + 文本
                  </button>
                  <button
                    aria-label="新增条目"
                    className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] text-slate-600"
                    onClick={() => addEntryItem(si)}
                    type="button"
                  >
                    + 条目
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {section.items.map((item, ii) =>
                  item.type === "text" ? (
                    <div key={`${section.id}-${ii}`} className="flex gap-1 items-start">
                      <textarea className="min-h-12 flex-1 rounded-lg border border-line px-2 py-1.5 text-sm" onChange={(e) => updateTextItem(si, ii, e.target.value)} value={item.text} />
                      <button
                        aria-label="删除这条"
                        className="rounded-full border border-rose-200 px-1.5 py-0.5 text-xs text-rose-500"
                        onClick={() => removeItem(si, ii)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div key={`${section.id}-${ii}`} className="grid gap-1 rounded-lg border border-line bg-white p-2">
                      <div className="grid gap-1 md:grid-cols-3">
                        <input className="rounded border border-line px-2 py-1 text-sm" onChange={(e) => updateEntryItem(si, ii, "heading", e.target.value)} value={item.heading} />
                        <input className="rounded border border-line px-2 py-1 text-sm" onChange={(e) => updateEntryItem(si, ii, "subheading", e.target.value)} placeholder="职位" value={item.subheading ?? ""} />
                        <input className="rounded border border-line px-2 py-1 text-sm" onChange={(e) => updateEntryItem(si, ii, "meta", e.target.value)} placeholder="时间" value={item.meta ?? ""} />
                      </div>
                      {section.id !== "education" && item.summary && (
                        <textarea 
                          className="min-h-8 rounded border border-line px-2 py-1 text-sm bg-slate-50/30 focus:bg-white transition-colors" 
                          onChange={(e) => updateEntryItem(si, ii, "summary", e.target.value)} 
                          placeholder="摘要 / 项目背景 (可选)" 
                          value={item.summary ?? ""} 
                        />
                      )}
                      <textarea className="min-h-12 rounded border border-line px-2 py-1 text-sm" onChange={(e) => updateEntryItem(si, ii, "bullets", e.target.value)} placeholder="每行一条" value={(item.bullets ?? []).join("\n")} />
                      <button
                        aria-label="删除这条"
                        className="justify-self-end rounded-full border border-rose-200 px-2 py-0.5 text-xs text-rose-500"
                        onClick={() => removeItem(si, ii)}
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}

          <div className="mt-3 flex items-center gap-2">
            <button className="rounded-full bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60" disabled={isPending || !dirty} onClick={saveDocument} type="button">
              {isPending ? "保存中…" : "保存修改"}
            </button>
            {saveMessage ? <span className="text-xs text-slate-600">{saveMessage}</span> : null}
          </div>
        </section>
      ) : null}

      {/* ─── Resume preview (main content, full width) ─── */}
      <div ref={contentRef} className="print:contents">
        <ResumePreview document={document} squishLevel={squishLevel} />
      </div>
    </div>
  );
}

export function getStableSquishLevel(height: number, currentLevel: number) {
  if (currentLevel <= 0) {
    if (height > 1250) return 2;
    if (height > 1123) return 1;
    return 0;
  }

  if (currentLevel === 1) {
    if (height > 1280) return 2;
    return 1;
  }

  return 2;
}

function getPersonalInfoValue(document: ResumeDocument) {
  const personalInfo = document.sections.find((section) => section.id === "personal-info");
  const sectionLines =
    personalInfo?.items
      .map((item) => (item.type === "text" ? item.text : [item.heading, item.subheading].filter(Boolean).join("：")))
      .filter(Boolean) ?? [];

  return (sectionLines.length > 0 ? sectionLines : document.header.contacts ?? []).join("\n");
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
