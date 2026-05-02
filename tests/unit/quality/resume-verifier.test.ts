import { describe, expect, it } from "vitest";
import { buildJDInsight } from "@/lib/services/analysis/jd-insight";
import { verifyRewriteSuggestion } from "@/lib/services/quality/resume-verifier";

describe("resume verifier", () => {
  it("passes a grounded JD-oriented rewrite", () => {
    const jdInsight = buildJDInsight({
      company: "图灵文化",
      jobTitle: "AI 产品经理",
      jdText: "需要 AI 工具 / Prompt 应用、产品需求拆解和数据分析能力。"
    });
    const beforeText = "独立设计 OfferYou AI 简历助手，完成 JD 分析和导出链路。";

    const result = verifyRewriteSuggestion({
      beforeText,
      afterText: "AI 工具 / Prompt 应用：独立设计 OfferYou AI 简历助手，完成 JD 分析和导出链路，支撑岗位定制简历生成。",
      reasonText: "保留 OfferYou 项目事实，并对应岗位里的 AI 工具 / Prompt 应用要求。",
      jdText: "需要 AI 工具 / Prompt 应用、产品需求拆解和数据分析能力。",
      jdInsight,
      company: "图灵文化",
      jobTitle: "AI 产品经理",
      masterFacts: [{ title: "OfferYou", text: beforeText }],
      resumeText: beforeText
    });

    expect(result.status).toBe("pass");
    expect(result.issues).toEqual([]);
  });

  it("fails when the rewrite is effectively unchanged", () => {
    const beforeText = "独立设计 OfferYou AI 简历助手，完成 JD 分析和导出链路。";

    const result = verifyRewriteSuggestion({
      beforeText,
      afterText: beforeText,
      reasonText: "对应岗位。",
      jdText: "需要 AI 工具和产品设计能力。",
      jdInsight: buildJDInsight({ jdText: "需要 AI 工具和产品设计能力。" }),
      masterFacts: [],
      resumeText: beforeText
    });

    expect(result.status).toBe("fail");
    expect(result.issues.join(" ")).toMatch(/过于接近|几乎相同/u);
  });

  it("fails placeholder or ellipsis content before it reaches the preview", () => {
    const result = verifyRewriteSuggestion({
      beforeText: "负责内容运营。",
      afterText: "建议补充更多岗位相关成果...",
      reasonText: "建议优化。",
      jdText: "需要内容运营和传播能力。",
      jdInsight: buildJDInsight({ jdText: "需要内容运营和传播能力。" }),
      masterFacts: [],
      resumeText: "负责内容运营。"
    });

    expect(result.status).toBe("fail");
    expect(result.issues.join(" ")).toContain("占位");
  });
});
