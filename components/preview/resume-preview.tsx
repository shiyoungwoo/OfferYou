import React from "react";
import { ResumePage } from "@/components/preview/resume-page";
import { TemplateATSClean } from "@/components/preview/template-ats-clean";
import { TemplateProfessionalCN } from "@/components/preview/template-professional-cn";
import { normalizeResumeTemplateKey, type ResumeDocument } from "@/lib/document/resume-document";

type ResumePreviewProps = {
  document: ResumeDocument;
  squishLevel?: number;
};

export function ResumePreview({ document, squishLevel = 0 }: ResumePreviewProps) {
  const templateKey = normalizeResumeTemplateKey(document.templateKey);

  return (
    <ResumePage pageNumber={1} templateKey={templateKey} squishLevel={squishLevel}>
      {templateKey === "ats-clean" ? <TemplateATSClean document={document} /> : <TemplateProfessionalCN document={document} />}
    </ResumePage>
  );
}
