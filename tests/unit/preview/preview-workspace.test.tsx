import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>
}));

describe("PreviewWorkspace", () => {
  it("lets the user add and remove items in preview edit mode", async () => {
    render(
      <PreviewWorkspace
        draftId="draft-1"
        initialDocument={{
          templateKey: "template_a",
          header: {
            name: "王小明",
            title: "产品经理",
            meta: ["OfferYou"]
          },
          sections: [
            {
              id: "personal-strengths",
              title: "个人优势",
              tone: "hero",
              items: [{ type: "text", text: "擅长复杂信息整理" }]
            }
          ]
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑当前预览" }));
    fireEvent.click(screen.getByRole("button", { name: "新增条目" }));

    expect(screen.getByDisplayValue("新条目")).toBeTruthy();

    const deleteButtons = screen.getAllByRole("button", { name: "删除这条" });
    fireEvent.click(deleteButtons[1]);

    expect(screen.queryByDisplayValue("新条目")).toBeNull();
  });
});
