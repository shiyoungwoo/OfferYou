import { describe, expect, it } from "vitest";
import { generateSeedSuggestions, rewriteFactForJd } from "@/lib/services/analysis/suggestion-generator";

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

  it("keeps dated project rewrites separated instead of mixing adjacent projects", () => {
    const result = rewriteFactForJd(
      [
        "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
        "独立完成产品定义与 MVP 范围收敛，设计输入即解析、导师式优化、快照派生三阶段核心流程。",
        "输出完整的产品输入输出协议文档、OpenAPI 3.1 接口草案、前端四页面状态机设计。",
        "AI 工具自媒体内容运营 2026.03 - 至今",
        "策划并发布 AI 工具类深度图文系列，覆盖小红书、微信公众号、微博三平台。"
      ].join("\n"),
      "招聘 AI 产品经理，要求 AI 产品设计、Prompt 迭代、工作流设计和数据分析。"
    );

    const firstProject = result.after.split("AI 工具自媒体内容运营")[0] ?? "";
    const secondProject = result.after.split("AI 工具自媒体内容运营")[1] ?? "";

    expect(result.after).toContain("OfferYou AI 岗位定制简历助手 2026.03 - 至今");
    expect(result.after).toContain("AI 工具自媒体内容运营 2026.03 - 至今");
    expect(firstProject).toContain("产品定义与 MVP 范围收敛");
    expect(firstProject).not.toContain("小红书");
    expect(secondProject).toContain("小红书");
  });

  it("prefers calibrated resume entries over raw mixed facts when available", () => {
    const suggestions = generateSeedSuggestions({
      jdText: "Need an AI product manager focused on Prompt iteration, workflow design, and product delivery.",
      calibratedResume: {
        status: "confirmed",
        personalInfo: {
          name: "吴世阳"
        },
        entries: [
          {
            id: "cal-1",
            section: "project",
            title: "OfferYou AI 岗位定制简历助手",
            dateRange: "2026.03 - 至今",
            bullets: ["独立完成产品定义与 MVP 范围收敛，设计三阶段核心流程。"],
            sourceText: "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
            confidence: "high",
            issues: []
          },
          {
            id: "cal-2",
            section: "work",
            title: "某银行柜面服务",
            dateRange: "2021.01 - 2023.01",
            bullets: ["保证基础服务稳定。"],
            sourceText: "某银行柜面服务 2021.01 - 2023.01",
            confidence: "high",
            issues: []
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "deterministic_fallback",
        updatedAt: "2026-04-28T00:00:00.000Z"
      },
      facts: [
        {
          text: "在银行网点负责柜面现金收付与日常业务办理，保证基础服务稳定。",
          section: "experience",
          sourceKind: "master_fact",
          sourceLabel: "简历原文"
        }
      ]
    });

    expect(suggestions[0]?.beforeText).toContain("OfferYou AI 岗位定制简历助手");
    expect(suggestions[0]?.candidateId).toBe("cal-1");
    expect(suggestions.some((item) => item.beforeText.includes("银行网点"))).toBe(false);
  });
});
