import React from "react";

type ResumePageProps = {
  pageNumber: number;
  templateKey?: string;
  squishLevel?: number;
  children: React.ReactNode;
};

export function ResumePage({ pageNumber, templateKey, squishLevel = 0, children }: ResumePageProps) {
  return (
    <article
      className="mx-auto min-h-[1123px] w-[794px] rounded-md bg-white px-[34px] py-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] print:w-auto print:min-h-0 print:rounded-none print:px-0 print:py-0 print:shadow-none"
      data-template-key={templateKey}
      data-squish-level={squishLevel}
    >
      <style>{`
        /* --- Squish Mode: Adaptive Typography (scoped to resume article) --- */
        article[data-squish-level="1"] .resume-header { padding-bottom: 6px !important; }
        article[data-squish-level="1"] .resume-section { padding-top: 0 !important; padding-bottom: 7px !important; }
        article[data-squish-level="1"] .resume-section-items { gap: 4px !important; }
        article[data-squish-level="1"] h2 { font-size: 29px !important; }
        article[data-squish-level="1"] h3 { margin-bottom: 4px !important; padding-bottom: 3px !important; font-size: 15px !important; }
        article[data-squish-level="1"] .contact-line,
        article[data-squish-level="1"] .text-item,
        article[data-squish-level="1"] .entry-summary { line-height: 1.4 !important; font-size: 12px !important; }
        article[data-squish-level="1"] .entry-title { font-size: 12.5px !important; }
        article[data-squish-level="1"] .entry-subtitle,
        article[data-squish-level="1"] .entry-meta,
        article[data-squish-level="1"] .entry-bullets li { line-height: 1.35 !important; font-size: 11.5px !important; }
        article[data-squish-level="1"] .entry { gap: 1px !important; }

        article[data-squish-level="2"] { padding-top: 22px !important; padding-bottom: 22px !important; }
        article[data-squish-level="2"] .resume-header { padding-bottom: 5px !important; }
        article[data-squish-level="2"] .resume-section { padding-top: 0 !important; padding-bottom: 5px !important; }
        article[data-squish-level="2"] .resume-section-items { gap: 3px !important; }
        article[data-squish-level="2"] h2 { font-size: 27px !important; }
        article[data-squish-level="2"] h3 { margin-bottom: 3px !important; padding-bottom: 2px !important; font-size: 14px !important; }
        article[data-squish-level="2"] .contact-line,
        article[data-squish-level="2"] .text-item,
        article[data-squish-level="2"] .entry-summary { line-height: 1.32 !important; font-size: 11.5px !important; }
        article[data-squish-level="2"] .entry-title { font-size: 12px !important; }
        article[data-squish-level="2"] .entry-subtitle,
        article[data-squish-level="2"] .entry-meta,
        article[data-squish-level="2"] .entry-bullets li { line-height: 1.28 !important; font-size: 11px !important; }
        article[data-squish-level="2"] .entry { gap: 0px !important; }

        /* --- High-Fidelity Print Optimization (scoped) --- */
        @media print {
          article[data-template-key] {
            color: #111 !important;
            background: white !important;
          }
          article[data-template-key] h2 { color: #111 !important; }
          article[data-template-key] .contact-line span,
          article[data-template-key] .entry-subtitle,
          article[data-template-key] .entry-summary { color: #444 !important; }
          article[data-template-key] .entry-bullets li { color: #444 !important; }

          /* Hide interactive elements if any remain */
          article[data-template-key] button,
          article[data-template-key] .no-print { display: none !important; }
        }
      `}</style>
      {children}
    </article>
  );
}
