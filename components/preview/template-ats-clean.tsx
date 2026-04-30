import React from "react";
import type { ResumeDocument } from "@/lib/document/resume-document";
import { getContentSections, getHeaderInfo, getRenderableSections } from "@/lib/services/export/preview-renderer";

type TemplateATSCleanProps = {
  document: ResumeDocument;
};

export function TemplateATSClean({ document }: TemplateATSCleanProps) {
  const headerInfo = getHeaderInfo(document);
  const contentSections = getContentSections(getRenderableSections(document.sections));

  return (
    <div className="flex flex-col text-slate-900">
      <header className="resume-header grid grid-cols-[minmax(190px,0.45fr)_minmax(500px,1fr)] gap-6 border-b-2 border-slate-800 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[29px] font-extrabold leading-none tracking-[0.04em]">{document.header.name}</h2>
          {document.header.title ? (
            <div className="mt-4 w-fit border-b border-slate-300 pb-1 pr-16 text-[20px] font-bold leading-tight text-slate-700">
              {document.header.title}
            </div>
          ) : null}
        </div>
        {headerInfo.length > 0 ? (
          <div className="contact-line grid min-w-0 grid-cols-2 content-start justify-items-start gap-x-5 gap-y-1.5 border-l border-slate-300 pl-5 pt-1 text-left text-[10px] leading-snug text-slate-600">
            {headerInfo.map((item) => (
              <span key={item} className="max-w-full whitespace-nowrap">
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div className="flex flex-col mt-3">
        {contentSections.map((section, sectionIndex) => (
          <section
            key={section.id}
            className={`resume-section break-inside-avoid py-1.5 ${sectionIndex === 0 ? "" : "border-t border-slate-200"}`}
          >
            <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-600 mb-1.5">{section.title}</h3>
            <div className="resume-section-items flex flex-col gap-1">
              {section.items.map((item, index) => (
                <div key={`${section.id}-${index}`}>
                  {item.type === "entry" ? (
                    <ResumeEntry item={item} />
                  ) : (
                    <p className="text-item text-[12px] leading-[1.5] text-slate-700 m-0">{item.text}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ResumeEntry({ item }: { item: ResumeDocument["sections"][number]["items"][number] & { type: "entry" } }) {
  const detailItems = [item.summary, ...(item.bullets ?? [])].filter(Boolean);

  return (
    <div className="entry flex flex-col gap-0.5">
      <div className="entry-head flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex items-baseline gap-1.5">
          <span className="entry-title text-[13px] font-bold text-slate-900">{item.heading}</span>
          {item.subheading ? <span className="entry-subtitle text-[11.5px] text-slate-500">｜ {item.subheading}</span> : null}
        </div>
        {item.meta ? <p className="entry-meta shrink-0 text-[11.5px] font-medium text-slate-500 whitespace-nowrap">{item.meta}</p> : null}
      </div>
      {detailItems.length > 0 ? (
        <ul className="entry-bullets mt-0.5 flex list-disc flex-col gap-px pl-3.5 text-[11.5px] leading-[1.42] text-slate-600 marker:text-slate-400">
          {detailItems.map((bullet) => (
            <li key={bullet}>
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
