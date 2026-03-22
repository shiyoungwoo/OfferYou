import React from "react";
import type { ResumeDocument } from "@/lib/document/resume-document";

type TemplateAProps = {
  document: ResumeDocument;
};

export function TemplateA({ document }: TemplateAProps) {
  return (
    <div className="grid gap-5">
      {/* ── Header ── */}
      <header className="border-b border-slate-200 pb-5">
        <div className="grid grid-cols-[1fr_100px] items-start gap-6">
          <div>
            <h2 className="text-[28px] font-bold leading-tight tracking-[0.01em] text-slate-950">{document.header.name}</h2>
            <p className="mt-1.5 text-sm font-medium tracking-[0.06em] uppercase text-slate-600">{document.header.title}</p>
            {document.header.contacts && document.header.contacts.length > 0 ? (
              <p className="mt-2 text-xs leading-5 text-slate-600">{document.header.contacts.join(" · ")}</p>
            ) : null}
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">{document.header.meta.join(" · ")}</p>
          </div>
          <div className="flex h-[108px] w-[100px] items-center justify-center overflow-hidden rounded-sm border border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.2em] text-slate-400">
            {document.header.photo?.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={document.header.photo.label} className="h-full w-full object-cover" src={document.header.photo.src} />
            ) : (
              document.header.photo?.label ?? "照片"
            )}
          </div>
        </div>
      </header>

      {/* ── Sections: 2-column flow ── */}
      <div className="columns-2 gap-5 [column-fill:auto]">
        {document.sections.map((section) => (
          <section
            key={section.id}
            className={`mb-4 break-inside-avoid border p-4 ${
              section.tone === "hero"
                ? "border-slate-300 bg-slate-50"
                : section.tone === "muted"
                  ? "border-dashed border-slate-200 bg-white"
                  : "border-slate-200 bg-white"
            }`}
          >
            <h3 className="border-b border-slate-200 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{section.title}</h3>
            <ul className="mt-2.5 grid gap-2.5 list-none p-0">
              {section.items.map((item, index) => (
                <li key={`${section.id}-${index}`} className="text-[12px] leading-[1.6] text-slate-700">
                  {item.type === "entry" ? <ResumeEntry item={item} /> : <p className="m-0">{item.text}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function ResumeEntry({ item }: { item: ResumeDocument["sections"][number]["items"][number] & { type: "entry" } }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-slate-900">{item.heading}</p>
          {item.subheading ? <p className="text-[11px] text-slate-600">{item.subheading}</p> : null}
        </div>
        {item.meta ? <p className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{item.meta}</p> : null}
      </div>
      {item.summary ? <p className="text-[11px] leading-[1.6] text-slate-600">{item.summary}</p> : null}
      {item.bullets && item.bullets.length > 0 ? (
        <ul className="mt-0.5 grid gap-0.5 pl-3 text-[11px] leading-[1.6] text-slate-600">
          {item.bullets.map((bullet) => (
            <li key={bullet} className="list-disc">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
