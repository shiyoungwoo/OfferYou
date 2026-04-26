import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TemplateProfessionalCN } from "@/components/preview/template-professional-cn";
import { buildResumePdfFilename, estimateResumePageCount, getResumePageWaterLabel } from "@/lib/services/export/preview-renderer";

describe("TemplateProfessionalCN", () => {
  it("renders section headings from ResumeDocument", () => {
    render(
      <TemplateProfessionalCN
        document={{
          templateKey: "professional-cn",
          header: {
            name: "User",
            title: "AI Product Manager",
            meta: [],
            contacts: ["user@example.com", "GitHub：github.com/example"]
          },
          sections: [
            {
              id: "projects",
              title: "Projects",
              items: [
                {
                  type: "entry",
                  heading: "OfferYou",
                  subheading: "Founder",
                  meta: "2024-至今",
                  summary: "Built the resume tailoring workflow.",
                  bullets: ["Shipped analysis and preview flow."]
                }
              ],
              tone: "standard"
            }
          ]
        }}
      />
    );

    expect(screen.getByText("Projects")).toBeTruthy();
    expect(screen.getByText("OfferYou")).toBeTruthy();
  });

  it("builds the expected filename and page label", () => {
    const document = {
      templateKey: "professional-cn" as const,
      header: {
        name: "王小明",
        title: "AI 产品经理",
        meta: []
      },
      sections: Array.from({ length: 9 }, (_, index) => ({
        id: `s${index + 1}`,
        title: `第 ${index + 1} 段`,
        items: [{ type: "text" as const, text: String(index + 1) }]
      }))
    };

    expect(buildResumePdfFilename(document)).toMatch(/^王小明-AI 产品经理-可投递版-\d{8}\.pdf$/u);
    expect(estimateResumePageCount(document)).toBe(1);
    expect(getResumePageWaterLabel(3)).toBe("建议删减后再导出");
  });
});
