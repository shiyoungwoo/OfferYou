import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TemplateA } from "@/components/preview/template-a";

describe("TemplateA", () => {
  it("renders section headings from ResumeDocument", () => {
    render(
      <TemplateA
        document={{
          templateKey: "template_a",
          header: {
            name: "User",
            title: "AI Product Manager",
            meta: [],
            contacts: ["user@example.com"],
            photo: { mode: "placeholder", label: "照片" }
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
    expect(screen.getByText("照片")).toBeTruthy();
    expect(screen.getByText("OfferYou")).toBeTruthy();
  });
});
