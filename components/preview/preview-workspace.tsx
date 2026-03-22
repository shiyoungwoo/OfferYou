"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ExportPdfButton } from "@/components/preview/export-pdf-button";
import { ResumePreview } from "@/components/preview/resume-preview";
import { TemplateSwitcher } from "@/components/preview/template-switcher";
import type { ResumeDocument, ResumeDocumentEntryItem } from "@/lib/document/resume-document";

type PreviewWorkspaceProps = {
  draftId: string;
  initialDocument: ResumeDocument;
};

export function PreviewWorkspace({ draftId, initialDocument }: PreviewWorkspaceProps) {
  const [document, setDocument] = useState(initialDocument);
  const [savedDocument, setSavedDocument] = useState(initialDocument);
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(document) !== JSON.stringify(savedDocument), [document, savedDocument]);

  function updateHeader(field: "name" | "title", value: string) {
    setDocument((c) => ({ ...c, header: { ...c.header, [field]: value } }));
  }

  function updateContacts(value: string) {
    setDocument((c) => ({
      ...c,
      header: { ...c.header, contacts: value.split("\n").map((s) => s.trim()).filter(Boolean) }
    }));
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
      <nav className="flex w-[794px] items-center gap-px rounded-full border border-line bg-white/90 p-1 shadow-card">
        {/* Left: template + edit */}
        <div className="flex items-center gap-1 pl-2">
          <TemplateSwitcher currentTemplate={document.templateKey ?? "template_a"} />
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              isEditing ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => setIsEditing((v) => !v)}
            type="button"
          >
            {isEditing ? "收起编辑" : "编辑"}
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: return + export */}
        <div className="flex items-center gap-1 pr-1">
          <Link
            className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            href={`/applications/${draftId}`}
          >
            返回工作台
          </Link>
          <ExportPdfButton document={document} draftId={draftId} />
        </div>
      </nav>

      {/* ─── Collapsible edit panel ─── */}
      {isEditing ? (
        <section className="w-[794px] rounded-2xl border border-line bg-white/90 p-5 shadow-card">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              姓名
              <input className="rounded-lg border border-line px-3 py-1.5 text-sm" onChange={(e) => updateHeader("name", e.target.value)} value={document.header.name} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              目标岗位
              <input className="rounded-lg border border-line px-3 py-1.5 text-sm" onChange={(e) => updateHeader("title", e.target.value)} value={document.header.title} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              联系方式
              <textarea className="min-h-12 rounded-lg border border-line px-3 py-1.5 text-sm" onChange={(e) => updateContacts(e.target.value)} value={(document.header.contacts ?? []).join("\n")} />
            </label>
          </div>

          {document.sections.map((section, si) => (
            <div key={section.id} className="mt-3 rounded-xl border border-line bg-paper p-3">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {section.title}
                <div className="flex gap-1">
                  <button className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] text-slate-600" onClick={() => addTextItem(si)} type="button">+ 文本</button>
                  <button className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] text-slate-600" onClick={() => addEntryItem(si)} type="button">+ 条目</button>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {section.items.map((item, ii) =>
                  item.type === "text" ? (
                    <div key={`${section.id}-${ii}`} className="flex gap-1 items-start">
                      <textarea className="min-h-12 flex-1 rounded-lg border border-line px-2 py-1.5 text-sm" onChange={(e) => updateTextItem(si, ii, e.target.value)} value={item.text} />
                      <button className="rounded-full border border-rose-200 px-1.5 py-0.5 text-xs text-rose-500" onClick={() => removeItem(si, ii)} type="button">×</button>
                    </div>
                  ) : (
                    <div key={`${section.id}-${ii}`} className="grid gap-1 rounded-lg border border-line bg-white p-2">
                      <div className="grid gap-1 md:grid-cols-3">
                        <input className="rounded border border-line px-2 py-1 text-sm" onChange={(e) => updateEntryItem(si, ii, "heading", e.target.value)} value={item.heading} />
                        <input className="rounded border border-line px-2 py-1 text-sm" onChange={(e) => updateEntryItem(si, ii, "subheading", e.target.value)} placeholder="职位" value={item.subheading ?? ""} />
                        <input className="rounded border border-line px-2 py-1 text-sm" onChange={(e) => updateEntryItem(si, ii, "meta", e.target.value)} placeholder="时间" value={item.meta ?? ""} />
                      </div>
                      <textarea className="min-h-10 rounded border border-line px-2 py-1 text-sm" onChange={(e) => updateEntryItem(si, ii, "summary", e.target.value)} placeholder="摘要" value={item.summary ?? ""} />
                      <textarea className="min-h-12 rounded border border-line px-2 py-1 text-sm" onChange={(e) => updateEntryItem(si, ii, "bullets", e.target.value)} placeholder="每行一条" value={(item.bullets ?? []).join("\n")} />
                      <button className="justify-self-end rounded-full border border-rose-200 px-2 py-0.5 text-xs text-rose-500" onClick={() => removeItem(si, ii)} type="button">删除</button>
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
      <ResumePreview document={document} />
    </div>
  );
}
