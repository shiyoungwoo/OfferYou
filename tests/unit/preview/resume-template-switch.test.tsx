import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>
}));

describe("resume template switching", () => {
  it("switches template variants without changing resume content", () => {
    const { container } = render(
      <PreviewWorkspace
        draftId="draft-1"
        initialDocument={{
          templateKey: "professional-cn",
          header: {
            name: "王小明",
            title: "产品经理",
            meta: ["OfferYou"]
          },
          sections: [
            {
              id: "projects",
              title: "项目经历",
              tone: "hero",
              items: [
                {
                  type: "entry",
                  heading: "OfferYou",
                  subheading: "Founder",
                  meta: "2024-至今",
                  summary: "搭建了岗位定制工作台。",
                  bullets: ["能切换模板", "内容保持一致"]
                }
              ]
            }
          ]
        }}
      />
    );

    expect(container.querySelector('[data-template-key="professional-cn"]')).toBeTruthy();
    expect(screen.getByText("王小明")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ATS Clean" }));

    expect(container.querySelector('[data-template-key="ats-clean"]')).toBeTruthy();
    expect(screen.getByText("王小明")).toBeTruthy();
    expect(screen.getByText("产品经理")).toBeTruthy();
    expect(screen.getByText("内容保持一致")).toBeTruthy();
  });
});
