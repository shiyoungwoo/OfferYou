import React from "react";
import { ResumePage } from "@/components/preview/resume-page";
import { TemplateA } from "@/components/preview/template-a";
import type { ResumeDocument } from "@/lib/document/resume-document";

type ResumePreviewProps = {
  document: ResumeDocument;
};

export function ResumePreview({ document }: ResumePreviewProps) {
  return (
    <ResumePage pageNumber={1}>
      <TemplateA document={document} />
    </ResumePage>
  );
}
