import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SuggestionList } from "@/components/applications/suggestion-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn()
  })
}));

describe("SuggestionList editor", () => {
  it("expands a suggestion and allows local edits", () => {
    render(
      <SuggestionList
        draftId="draft-1"
        suggestions={[
          {
            id: "s1",
            section: "project",
            title: "Draft rewrite",
            beforeText: "Built workflow systems.",
            afterText: "Built AI workflow systems.",
            reasonText: "这版改写会保留已经确认过的真实事实，同时让这段经历和目标岗位的关系更清楚。；质量提示：改写内容偏短。",
            status: "pending",
            sourceKind: "resume_baseline",
            sourceLabel: "Resume baseline",
            revisionRound: 0
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    fireEvent.change(screen.getByLabelText("改写后全文"), {
      target: {
        value: "Built AI workflow systems with stronger product framing."
      }
    });

    expect(screen.getByDisplayValue("Built AI workflow systems with stronger product framing.")).toBeTruthy();
  });
});
