import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    vi.unstubAllGlobals();
  });

  it("renders rewrite suggestions with expandable cards and Chinese controls", () => {
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
    expect(screen.getByText("这条建议重点是保留真实经历，同时让证据更有力量。")).toBeTruthy();
    expect(screen.getByText("这条建议会更主动地把你的优势特质写出来。")).toBeTruthy();
    expect(screen.getAllByText("展开详情").length).toBeGreaterThan(0);
    expect(screen.getAllByText("原始表达内容").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "接受" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Master fact: Workflow instrumentation rollout")).toBeNull();
  });

  it("falls back to whole suggestion when revised text has no date anchors", () => {
    render(
      <SuggestionList
        draftId="draft-1"
        suggestions={[
          {
            id: "s1",
            section: "project",
            title: "OfferYou 项目改写",
            beforeText: [
              "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
              "独立完成产品定义与 MVP 范围收敛。",
              "AI 工具自媒体内容运营 2026.03 - 至今",
              "策划并发布 AI 工具类内容。"
            ].join("\n"),
            afterText: "围绕 AI 产品经理岗位，突出产品定义、流程设计和内容验证能力。",
            reasonText: "保留真实事实并聚焦岗位匹配。",
            status: "pending",
            sourceKind: "master_fact",
            sourceLabel: "Master fact",
            revisionRound: 0
          }
        ]}
      />
    );

    expect(screen.getAllByText("OfferYou 项目改写").length).toBeGreaterThan(0);
    expect(screen.getByText(/围绕 AI 产品经理岗位/u)).toBeTruthy();
  });

  it("auto-collapses details after every part in a split suggestion is decided", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "accepted", snapshotSynced: true })
      })
    );

    render(
      <SuggestionList
        draftId="draft-1"
        suggestions={[
          {
            id: "s1",
            section: "project",
            title: "项目经历",
            beforeText: [
              "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
              "独立完成产品定义与 MVP 范围收敛。",
              "AI 工具自媒体内容运营 2026.03 - 至今",
              "策划并发布 AI 工具类内容。"
            ].join("\n"),
            afterText: [
              "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
              "- 独立完成产品定义与 MVP 范围收敛。",
              "AI 工具自媒体内容运营 2026.03 - 至今",
              "- 策划并发布 AI 工具类内容。"
            ].join("\n"),
            reasonText: "按原始时间线分别改写。",
            status: "pending",
            sourceKind: "master_fact",
            sourceLabel: "Master fact",
            revisionRound: 0
          }
        ]}
      />
    );

    expect(screen.getByText("收起详情")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "接受" })[0]);

    expect(screen.getByText("收起详情")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "接受" })[1]);

    await waitFor(() => {
      expect(screen.getByText("展开详情")).toBeTruthy();
    });
  });
});
