import { describe, expect, it } from "vitest";
import fixture from "../../fixtures/rewrite-quality/ai-pm-self-use.json";
import { evaluateRewriteQuality } from "@/lib/services/quality/rewrite-quality-gate";

describe("evaluateRewriteQuality", () => {
  it("passes when the rewrite is concrete, JD-aligned, and fact-safe", () => {
    const result = evaluateRewriteQuality({
      beforeText: fixture.sourceBlocks[0].text,
      afterText: "AI 产品实践者：正在独立设计 AI 求职辅助产品 OfferYou，完成 MVP 产品协议设计、AI 工作流、AI 简历解析、JD 智能对齐分析和智能导出链路。",
      jdKeywords: fixture.jdKeywords,
      mustPreserveFacts: fixture.mustPreserveFacts,
      mustAvoidPhrases: fixture.mustAvoidPhrases
    });

    expect(result.passed).toBe(true);
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
    expect(result.preservedFacts).toContain("OfferYou");
  });

  it("fails when the rewrite simply copies the original text", () => {
    const result = evaluateRewriteQuality({
      beforeText: fixture.sourceBlocks[1].text,
      afterText: fixture.sourceBlocks[1].text,
      jdKeywords: fixture.jdKeywords,
      mustPreserveFacts: fixture.mustPreserveFacts,
      mustAvoidPhrases: fixture.mustAvoidPhrases
    });

    expect(result.passed).toBe(false);
    expect(result.issues.join(" ")).toContain("改写前后完全一致");
  });

  it("fails when a preserved company name is changed", () => {
    const result = evaluateRewriteQuality({
      beforeText: `${fixture.sourceBlocks[3].title}：${fixture.sourceBlocks[3].text}`,
      afterText: "陕西正大医疗科技有限公司：基于需求分析设计多变量控制实验方案，运用数据统计方法对核心性能指标进行数据采集、清洗与验证。",
      jdKeywords: fixture.jdKeywords,
      mustPreserveFacts: fixture.mustPreserveFacts,
      mustAvoidPhrases: fixture.mustAvoidPhrases
    });

    expect(result.passed).toBe(false);
    expect(result.issues.join(" ")).toContain("陕西怡阳医疗科技有限公司");
  });

  it("fails when forbidden phrases or ellipsis appear", () => {
    const result = evaluateRewriteQuality({
      beforeText: fixture.sourceBlocks[2].text,
      afterText: "建议保留这段经历相关性较弱的部分...",
      jdKeywords: fixture.jdKeywords,
      mustPreserveFacts: fixture.mustPreserveFacts,
      mustAvoidPhrases: fixture.mustAvoidPhrases
    });

    expect(result.passed).toBe(false);
    expect(result.blockedPhrases).toEqual(expect.arrayContaining(["建议", "相关性较弱", "..."]));
  });
});
