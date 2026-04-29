import React from "react";
import type { ResumeDocument } from "@/lib/document/resume-document";

type TemplateATSCleanProps = {
  document: ResumeDocument;
};

export function TemplateATSClean({ document }: TemplateATSCleanProps) {
  const headerInfo = getHeaderInfo(document);
  const contentSections = document.sections.filter((section) => section.id !== "personal-info");

  return (
    <div className="flex flex-col text-slate-900">
      <header className="resume-header flex items-start gap-5 border-b-2 border-slate-800 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[26px] font-extrabold leading-none tracking-[0.04em]">{document.header.name}</h2>
            <span className="text-[14px] font-semibold text-slate-600 whitespace-nowrap">
              {document.header.title}
            </span>
          </div>
          {headerInfo.length > 0 ? (
            <div className="contact-line mt-2 flex flex-wrap items-center gap-x-3 text-[10.5px] leading-snug text-slate-500">
              {headerInfo.map((item) => (
                <span key={item} className="after:ml-3 after:text-slate-300 after:font-light after:content-['|'] last:after:content-none whitespace-nowrap">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col mt-3">
        {contentSections.map((section, sectionIndex) => (
          <section
            key={section.id}
            className={`resume-section break-inside-avoid py-1.5 ${sectionIndex === 0 ? "" : "border-t border-slate-200"}`}
          >
            <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-600 mb-1.5">{section.title}</h3>
            <div className="resume-section-items flex flex-col gap-1.5">
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
  return (
    <div className="entry flex flex-col gap-0.5">
      <div className="entry-head flex items-baseline justify-between gap-3">
        <div>
          <p className="entry-title text-[13px] font-bold text-slate-900">{item.heading}</p>
          {item.subheading ? <p className="entry-subtitle text-[11.5px] text-slate-500 mt-0.5">{item.subheading}</p> : null}
        </div>
        {item.meta ? <p className="entry-meta shrink-0 text-[11.5px] font-medium text-slate-500 whitespace-nowrap">{item.meta}</p> : null}
      </div>
      {item.summary ? <p className="entry-summary text-[12px] leading-[1.5] text-slate-600 mt-0.5">{item.summary}</p> : null}
      {item.bullets && item.bullets.length > 0 ? (
        <ul className="entry-bullets mt-0.5 flex flex-col gap-px pl-4 text-[11.5px] leading-[1.45] text-slate-600">
          {item.bullets.map((bullet) => (
            <li key={bullet} className="list-disc marker:text-slate-400">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function getHeaderInfo(document: ResumeDocument) {
  const personalInfo = document.sections.find((section) => section.id === "personal-info");
  const lines =
    personalInfo?.items.flatMap((item) =>
      item.type === "text" ? splitPersonalInfoLine(item.text) : [joinHeaderEntry(item.heading, item.subheading)]
    ) ?? document.header.contacts ?? [];

  return Array.from(
    new Set(
      lines
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !/^姓名[：:]/u.test(line))
        .filter((line) => !/^求职意向[：:]/u.test(line))
    )
  ).slice(0, 7);
}

function splitPersonalInfoLine(text: string) {
  return text
    .split(/[｜|]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinHeaderEntry(heading: string, subheading?: string) {
  return [heading, subheading].filter(Boolean).join("：");
}
