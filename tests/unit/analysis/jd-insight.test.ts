import { beforeEach, describe, expect, it, vi } from "vitest";

const { callModelJSON } = vi.hoisted(() => ({
  callModelJSON: vi.fn()
}));

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON
}));

import {
  buildJDInsight,
  buildJDInsightWithModel,
  buildRewriteStrategy,
  selectJDAbilityLabel
} from "@/lib/services/analysis/jd-insight";

beforeEach(() => {
  callModelJSON.mockReset();
});

describe("jd insight", () => {
  it("extracts concrete JD abilities instead of generic placeholder labels", () => {
    const insight = buildJDInsight({
      company: "图灵文化",
      jobTitle: "AI 应用工程师 / AI 产品经理",
      jdText: [
        "熟悉 AI 工具、Prompt Engineering、LLM 和智能体。",
        "能够完成产品需求拆解、PRD、原型和功能设计。",
        "能够进行数据分析和结果表达。",
        "有内容运营、新媒体账号案例加分。"
      ].join("\n")
    });

    expect(insight.coreAbilities).toEqual(expect.arrayContaining([
      "AI 工具 / Prompt 应用",
      "产品需求拆解",
      "数据分析与结果表达",
      "内容运营与传播"
    ]));
    expect(insight.coreAbilities.join(" ")).not.toContain("目标岗位要求的动作");
  });

  it("builds a rewrite strategy that compresses weak relevance while preserving facts", () => {
    const insight = buildJDInsight({
      jdText: "需要 AI 产品、工作流设计、跨部门协作和作品集案例。"
    });

    const strategy = buildRewriteStrategy(insight);

    expect(strategy.lowRelevancePolicy).toBe("compress_keep_timeline");
    expect(strategy.sectionOrder).toEqual(["summary", "project", "experience", "education"]);
    expect(strategy.distortionGuards.join(" ")).toContain("不改写公司");
  });

  it("selects the closest ability label from rewritten content", () => {
    const insight = buildJDInsight({
      jdText: "需要 Prompt Engineering、产品需求拆解和数据分析。"
    });

    expect(selectJDAbilityLabel({
      text: "通过 Prompt 迭代优化 AI 简历改写链路。",
      jdInsight: insight
    })).toBe("AI 工具 / Prompt 应用");
  });

  it("uses model-first JD insight when the provider returns concrete abilities", async () => {
    callModelJSON.mockResolvedValue({
      provider: "openai_compatible",
      generationMode: "model",
      data: {
        company: "图灵文化",
        jobTitle: "AI 应用工程师 / AI 产品经理",
        hardRequirements: ["熟悉 AI 工具和 Prompt Engineering"],
        coreAbilities: ["AI 翻译工作流优化", "新媒体 AI 化运营", "Prompt Engineering"],
        bonusItems: ["深度用户和早期体验者"],
        avoidItems: ["不要编造技术栈"],
        sourceKeywords: ["AI 翻译工作流优化", "新媒体 AI 化运营", "Prompt Engineering"]
      }
    });

    const result = await buildJDInsightWithModel({
      company: "图灵文化",
      jobTitle: "AI 应用工程师 / AI 产品经理",
      jdText: "AI 翻译工作流优化；新媒体 AI 化运营；熟悉 Prompt Engineering。"
    });

    expect(callModelJSON).toHaveBeenCalledWith(expect.objectContaining({ task: "jd_analysis" }));
    expect(result.insight.generationMode).toBe("model");
    expect(result.insight.coreAbilities).toEqual(expect.arrayContaining(["AI 翻译工作流优化", "Prompt Engineering"]));
    expect(result.insight.coreAbilities.join(" ")).not.toContain("目标岗位要求的动作");
  });

  it("falls back visibly when JD insight model is unavailable", async () => {
    callModelJSON.mockResolvedValue({
      provider: "deterministic_fallback",
      generationMode: "deterministic_fallback",
      fallbackReason: "未检测到小米 MiMo / OpenAI 兼容配置，已切换到确定性回退。",
      data: buildJDInsight({
        jdText: "需要 AI 产品、工作流设计、跨部门协作和作品集案例。"
      })
    });

    const result = await buildJDInsightWithModel({
      jdText: "需要 AI 产品、工作流设计、跨部门协作和作品集案例。"
    });

    expect(result.insight.generationMode).toBe("deterministic_fallback");
    expect(result.riskNotes.join(" ")).toContain("JD 理解模型降级原因");
  });
});
