import { describe, expect, it } from "vitest";
import { scoreSuggestionQuality } from "@/lib/services/quality/suggestion-quality";

describe("scoreSuggestionQuality", () => {
  it("gives a passing score when the rewrite is specific and grounded", () => {
    const result = scoreSuggestionQuality({
      beforeText: "负责客户沟通",
      afterText: "负责客户沟通与流程梳理，推动跨团队协作并提升交付效率。",
      reasonText: "这版改写会更贴近岗位里的协作与流程要求。",
      keywords: ["流程", "协作", "交付"]
    });

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.passed).toBe(true);
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it("penalizes empty reasons, missing keywords, and identical rewrites", () => {
    const result = scoreSuggestionQuality({
      beforeText: "负责客户沟通",
      afterText: "负责客户沟通",
      reasonText: "",
      keywords: ["流程", "协作"]
    });

    expect(result.score).toBeLessThan(60);
    expect(result.passed).toBe(false);
    expect(result.notes).toContain("改写前后几乎相同。");
    expect(result.notes).toContain("缺少改写理由。");
    expect(result.notes).toContain("没有覆盖岗位关键词。");
  });

  it("flags generic rewrites and obvious fabricated claims", () => {
    const genericResult = scoreSuggestionQuality({
      beforeText: "负责客户沟通",
      afterText: "重新构筑这段描述，更贴近岗位要求。",
      reasonText: "补强结果表达。",
      keywords: ["流程", "协作"]
    });

    const fabricatedResult = scoreSuggestionQuality({
      beforeText: "负责客户沟通",
      afterText: "独立管理数十人团队并创造千万级收入。",
      reasonText: "补强结果表达。",
      keywords: ["团队", "结果"]
    });

    expect(genericResult.passed).toBe(false);
    expect(genericResult.notes).toContain("改写仍然偏泛，缺少可落地的岗位映射。");
    expect(fabricatedResult.passed).toBe(false);
    expect(fabricatedResult.notes).toContain("存在明显虚构表达。");
  });
});
