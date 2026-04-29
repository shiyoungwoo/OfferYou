import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisSummaryPanel } from "@/components/applications/analysis-summary-panel";

describe("AnalysisSummaryPanel", () => {
  it("renders a fit verdict and confidence line", () => {
    render(
      <AnalysisSummaryPanel
        careerDirectionUsed={{
          id: "nav-1",
          slug: "customer-success",
          label: "Customer success and relationship-led roles",
          rationale: "Rationale",
          watchOut: "Watch-out"
        }}
        masterFactsUsed={[
          {
            id: "fact-1",
            title: "Workflow instrumentation rollout",
            summary: "Led the post-launch instrumentation rollout for workflow analytics.",
            blockType: "project"
          }
        ]}
        summary={{
          fitScore: 82,
          optimizationMode: "talent_amplified",
          strengths: ["工作流梳理能力与岗位要求较为贴合。"],
          gaps: ["还需要更明确的结果指标。"],
          riskNotes: ["所有表达都必须锚定真实事实。", "模型降级原因：未检测到 `GEMINI_API_KEY`，已切换到确定性回退。"]
        }}
        talentProfileUsed={{
          id: "talent-1",
          headline: "建立信任、稳定推进复杂协作",
          confidenceNote: "可信度中等"
        }}
      />
    );

    expect(screen.getAllByText("匹配度").length).toBeGreaterThan(0);
    expect(screen.getAllByText("可竞争").length).toBeGreaterThan(0);
    expect(screen.getByText(/AI 分析已切换到回退方案/i)).toBeTruthy();
    expect(screen.getByText(/本次判断已经纳入已确认的优势档案与职业方向/i)).toBeTruthy();
    expect(screen.getByText(/优势档案：建立信任、稳定推进复杂协作/i)).toBeTruthy();
    expect(screen.getAllByText(/模型降级原因：未检测到 `GEMINI_API_KEY`，已切换到确定性回退。/i).length).toBe(2);
  });
});
