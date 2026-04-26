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
          templateKey: "professional-cn",
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

    expect(screen.getAllByText("一页版，适合投递").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "编辑当前预览" }));
    fireEvent.click(screen.getByRole("button", { name: "新增条目" }));

    expect(screen.getByDisplayValue("新条目")).toBeTruthy();

    const deleteButtons = screen.getAllByRole("button", { name: "删除这条" });
    fireEvent.click(deleteButtons[1]);

    expect(screen.queryByDisplayValue("新条目")).toBeNull();
  });

  it("edits personal info through the preview editor and renders it in the resume header", () => {
    render(
      <PreviewWorkspace
        draftId="draft-2"
        initialDocument={{
          templateKey: "professional-cn",
          header: {
            name: "王小明",
            title: "产品经理",
            meta: []
          },
          sections: [
            {
              id: "personal-info",
              title: "个人信息",
              tone: "hero",
              items: [{ type: "text", text: "手机：138 0000 0000" }]
            },
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
    fireEvent.change(screen.getByLabelText("个人信息"), {
      target: { value: "手机：139 0000 0000\n邮箱：pm@example.com" }
    });

    expect(screen.getByText("手机：139 0000 0000")).toBeTruthy();
    expect(screen.getByText("邮箱：pm@example.com")).toBeTruthy();
  });
});
