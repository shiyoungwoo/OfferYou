import { describe, expect, it } from "vitest";
import { generateSeedSuggestions } from "@/lib/services/analysis/suggestion-generator";

describe("generateSeedSuggestions", () => {
  it("ranks strongly related facts ahead of weakly related ones", () => {
    const suggestions = generateSeedSuggestions({
      jdText: "We need an AI product manager focused on Prompt iteration, workflow design, and product delivery.",
      facts: [
        {
          text: "在银行网点负责柜面现金收付与日常业务办理，保证基础服务稳定。",
          section: "experience",
          sourceKind: "master_fact",
          sourceLabel: "简历原文"
        },
        {
          text: "独立主导 OfferYou AI 岗位定制简历助手，从需求拆解、Prompt 设计到快照派生完整落地。",
          section: "project",
          sourceKind: "master_fact",
          sourceLabel: "简历原文"
        },
        {
          text: "协助整理运营数据，支持例行复盘与跨团队沟通。",
          section: "experience",
          sourceKind: "master_fact",
          sourceLabel: "简历原文"
        }
      ]
    });

    expect(suggestions[0]?.beforeText).toContain("OfferYou AI 岗位定制简历助手");
    expect(suggestions[0]?.afterText).toContain("Prompt");
    expect(suggestions.some((item) => item.beforeText.includes("柜面现金收付"))).toBeTruthy();
  });
});
