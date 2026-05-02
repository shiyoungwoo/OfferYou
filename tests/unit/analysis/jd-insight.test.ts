import { describe, expect, it } from "vitest";
import {
  buildJDInsight,
  buildRewriteStrategy,
  selectJDAbilityLabel
} from "@/lib/services/analysis/jd-insight";

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
});
