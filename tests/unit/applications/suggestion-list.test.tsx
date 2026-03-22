import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuggestionList } from "@/components/applications/suggestion-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn()
  })
}));

describe("SuggestionList", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders rewrite suggestions without source-management controls", () => {
    render(
      <SuggestionList
        draftId="draft-1"
        suggestions={[
          {
            id: "s1",
            section: "project",
            title: "Master-derived rewrite",
            beforeText: "Built workflow systems.",
            afterText: "Built AI workflow systems.",
            reasonText: "这版改写会保留已经确认过的真实事实，同时让这段经历和目标岗位的关系更清楚。",
            status: "pending",
            sourceKind: "master_fact",
            sourceLabel: "Master fact: Workflow instrumentation rollout",
            revisionRound: 0
          },
          {
            id: "s2",
            section: "summary",
            title: "Resume baseline rewrite",
            beforeText: "Resume baseline.",
            afterText: "Resume baseline reframed.",
            reasonText: "这版改写不会改变事实本身，但会更主动地把你底层的优势和自然工作方式写出来。",
            status: "pending",
            sourceKind: "resume_baseline",
            sourceLabel: "Resume baseline",
            revisionRound: 0
          }
        ]}
      />
    );

    expect(screen.getAllByText(/Master-derived rewrite|Resume baseline rewrite/).length).toBeGreaterThan(0);
    expect(screen.getByText("突出你的天然优势")).toBeTruthy();
    expect(screen.getByText("保留事实，增强说服力")).toBeTruthy();
    expect(screen.getAllByText("建议改成").length).toBeGreaterThan(0);
    expect(screen.queryByText("Master fact: Workflow instrumentation rollout")).toBeNull();
    expect(screen.queryByRole("button", { name: "Master Facts" })).toBeNull();
  });
});
