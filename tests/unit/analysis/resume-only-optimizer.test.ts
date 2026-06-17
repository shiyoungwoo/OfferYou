import { beforeEach, describe, expect, it, vi } from "vitest";

const { callModelJSON } = vi.hoisted(() => ({
  callModelJSON: vi.fn()
}));

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON
}));

vi.mock("@/lib/ai/model-provider-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/model-provider-config")>();
  return {
    ...actual,
    getDefaultModelProvider: vi.fn(() => "openai_compatible")
  };
});

import { generateResumeOnlyOptimizationSuggestions } from "@/lib/services/analysis/resume-only-optimizer";
import type { CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";

beforeEach(() => {
  callModelJSON.mockReset();
});

describe("generateResumeOnlyOptimizationSuggestions", () => {
  it("uses model output to create resume-only optimization suggestions without changing section labels", async () => {
    callModelJSON.mockResolvedValue({
      provider: "openai_compatible",
      generationMode: "model",
      data: {
        suggestions: [
          {
            candidateId: "work-1",
            title: "银行工作经历表达优化",
            after: "广发银行北京分行｜综合柜员岗｜2022.08 - 2025.08\n- 协助网点负责人整理运营数据，识别业务量波动并支持排班与窗口调整。",
            reason: "保留原工作事实，强化数据整理和流程支持动作。",
            factAnchors: ["协助网点负责人整理运营数据"]
          }
        ]
      }
    });

    const result = await generateResumeOnlyOptimizationSuggestions({
      profile: createProfile(),
      targetTitle: "AI 产品经理"
    });

    expect(callModelJSON).toHaveBeenCalledOnce();
    expect(result.generationMode).toBe("model");
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      candidateId: "work-1",
      section: "experience",
      generationMode: "model",
      modelProvider: "openai_compatible",
      sourceKind: "resume_baseline"
    });
    expect(result.suggestions[0]?.afterText).toContain("广发银行北京分行");
  });

  it("does not fabricate optimization suggestions when the model is unavailable", async () => {
    const result = await generateResumeOnlyOptimizationSuggestions({
      profile: createProfile(),
      modelProvider: "deterministic_fallback"
    });

    expect(callModelJSON).not.toHaveBeenCalled();
    expect(result.suggestions).toEqual([]);
    expect(result.fallbackReason).toContain("基础编辑模式");
  });
});

function createProfile(): CalibratedResumeProfile {
  return {
    status: "confirmed",
    personalInfo: {
      name: "示例候选人",
      phone: "13800000000",
      email: "pm@example.com"
    },
    entries: [
      {
        id: "summary-1",
        section: "summary",
        title: "个人优势",
        bullets: ["具备 AI 产品实践和银行业务理解。"],
        sourceText: "具备 AI 产品实践和银行业务理解。",
        confidence: "high",
        issues: []
      },
      {
        id: "work-1",
        section: "work",
        title: "广发银行北京分行",
        role: "综合柜员岗",
        dateRange: "2022.08 - 2025.08",
        bullets: ["协助网点负责人整理运营数据。"],
        sourceText: "广发银行北京分行｜综合柜员岗｜2022.08 - 2025.08",
        confidence: "high",
        issues: []
      },
      {
        id: "edu-1",
        section: "education",
        title: "湖南工业大学",
        role: "本科",
        organization: "数学与应用数学",
        dateRange: "2020.09 - 2022.06",
        bullets: [],
        sourceText: "湖南工业大学｜本科｜数学与应用数学",
        confidence: "high",
        issues: []
      }
    ],
    unclassifiedText: [],
    parseWarnings: [],
    modelNotes: []
  };
}
