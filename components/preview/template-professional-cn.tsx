import React from "react";
import type { ResumeDocument } from "@/lib/document/resume-document";
import { getContentSections, getHeaderInfo, getRenderableSections } from "@/lib/services/export/preview-renderer";

interface TemplateProfessionalCNProps {
  document: ResumeDocument;
}

export function TemplateProfessionalCN({ document }: TemplateProfessionalCNProps) {
  const renderableSections = getContentSections(getRenderableSections(document.sections));
  const headerInfo = getHeaderInfo(document);

  return (
    <div className="w-full text-[#1F2430] antialiased" style={{ fontFamily: '"Source Han Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif' }}>
      <header className="resume-header border-b-2 border-[#1F2430] pb-2 text-center">
        <h2 className="text-[24pt] font-extrabold leading-none tracking-[0.08em] text-[#1F2430]">
          {document.header.name}
        </h2>

        {headerInfo.length > 0 && (
          <div className="contact-line mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 text-[9pt] font-medium text-[#5B6472]">
            {headerInfo.map((item, i) => (
              <span key={i} className="inline-flex items-center whitespace-nowrap">
                {item}
                {i < headerInfo.length - 1 && (
                  <span className="mx-2 font-light text-[#CCC]">|</span>
                )}
              </span>
            ))}
          </div>
        )}

        {document.header.title && (
          <div className="mx-auto mt-2 w-fit border-b-2 border-[#1E3A70] px-8 pb-1 text-[13pt] font-bold text-[#1E3A70]">
            求职意向：{document.header.title}
          </div>
        )}
      </header>

      <div className="mt-3.5 flex flex-col gap-0">
        {renderableSections.map((section, idx) => (
          <section key={idx} className="resume-section break-inside-avoid pb-2.5">
            <h3 className="mb-1.5 flex items-center border-b border-[#D9E2F2] pb-1 text-[12.5pt] font-bold text-[#1E3A70]">
              <span className="mr-1.5 inline-block h-[13px] w-[4px] rounded-[2px] bg-[#1E3A70]" />
              {section.title}
            </h3>

            <ul className="resume-section-items flex flex-col gap-1.5 list-none">
              {section.items.map((item, itemIdx) => {
                if (item.type === "text") {
                  return (
                    <li key={itemIdx} className="text-item relative pl-4 text-[10pt] leading-[1.6] text-[#1F2430] before:absolute before:left-0 before:top-[0.68em] before:h-[4px] before:w-[4px] before:rounded-full before:bg-[#5B6472]">
                      {(() => {
                        // Labels can contain spaces, English words, slash, arrows, and parentheses.
                        const colonMatch = item.text.match(
                          /^\s*([\u4e00-\u9fa5A-Za-z0-9＋+&/（）()·\s→>\-]{2,24})\s*[:：]\s*(.+)$/su
                        );
                        if (colonMatch) {
                          const label = colonMatch[1].trim();
                          const content = colonMatch[2].trim();
                          return (
                            <>
                              <strong className="text-[#1E3A70] font-bold">{label}：</strong>
                              {content}
                            </>
                          );
                        }
                        return item.text;
                      })()}
                    </li>
                  );
                }

                if (item.type === "entry") {
                  return (
                    <li key={itemIdx} className="entry flex flex-col gap-0.5">
                      <div className="entry-head flex items-baseline justify-between gap-3">
                        <div className="min-w-0 flex items-baseline">
                          <span className="entry-title text-[10.5pt] font-bold text-[#1F2430]">
                            {item.heading}
                          </span>
                          {item.subheading && (
                            <span className="entry-subtitle text-[9.8pt] text-[#5B6472]">
                              <span className="mx-1 font-light text-[#CCC]">|</span>
                              {item.subheading}
                            </span>
                          )}
                        </div>
                        {item.meta && (
                          <span className="entry-meta shrink-0 whitespace-nowrap text-[9.5pt] font-normal text-[#5B6472]">
                            {item.meta}
                          </span>
                        )}
                      </div>

                      {item.summary && (
                        <ul className="entry-bullets m-0 flex list-disc flex-col gap-px pl-4">
                          <li className="text-[9.8pt] leading-[1.42] text-[#1F2430]">{item.summary}</li>
                        </ul>
                      )}

                      {item.bullets && item.bullets.length > 0 && (
                        <ul className="entry-bullets m-0 flex list-disc flex-col gap-px pl-4">
                          {item.bullets.map((bullet, bIdx) => (
                            <li key={bIdx} className="text-[9.8pt] leading-[1.42] text-[#1F2430]">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                }
                return null;
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
