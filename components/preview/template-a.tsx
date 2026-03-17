import React from "react";
import type { ResumeDocument } from "@/lib/document/resume-document";

type TemplateAProps = {
  document: ResumeDocument;
};

export function TemplateA({ document }: TemplateAProps) {
  return (
    <div className="grid gap-8">
      <header className="border-b border-line pb-6">
        <h2 className="text-3xl font-semibold">{document.header.name}</h2>
        <p className="mt-3 text-lg text-accent">{document.header.title}</p>
        <p className="mt-3 text-sm text-slate-600">{document.header.meta.join(" · ")}</p>
      </header>

      {document.sections.map((section) => (
        <section key={section.id} className="grid gap-3 break-inside-avoid">
          <h3 className="text-lg font-semibold uppercase tracking-[0.2em] text-slate-500">{section.title}</h3>
          <ul className="grid gap-3">
            {section.items.map((item) => (
              <li key={item} className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm leading-6 text-slate-700">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
