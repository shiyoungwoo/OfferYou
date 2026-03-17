import React from "react";
import { ResumePage } from "@/components/preview/resume-page";
import { TemplateA } from "@/components/preview/template-a";
import type { ResumeDocument } from "@/lib/document/resume-document";
import { paginateDocument } from "@/lib/services/export/preview-renderer";

type ResumePreviewProps = {
  document: ResumeDocument;
};

export function ResumePreview({ document }: ResumePreviewProps) {
  const pages = paginateDocument(document);

  return (
    <div className="grid gap-6">
      {pages.map((pageDocument, index) => (
        <ResumePage key={`${pageDocument.templateKey}-${index + 1}`} pageNumber={index + 1}>
          <TemplateA document={pageDocument} />
        </ResumePage>
      ))}
    </div>
  );
}
