import { beforeEach, describe, expect, it, vi } from "vitest";

const { callModelJSON } = vi.hoisted(() => ({
  callModelJSON: vi.fn()
}));

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON
}));

import {
  generateAISuggestions,
  generateSeedSuggestions,
  rewriteFactForJd
} from "@/lib/services/analysis/suggestion-generator";

beforeEach(() => {
  callModelJSON.mockReset();
});

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

  it("does not emit ellipsis in fallback rewrite suggestions", () => {
    const result = rewriteFactForJd(
      [
        "个人优势",
        "AI 产品实践者：正在独立设计 AI 求职辅助产品 OfferYou，已完成 MVP 产品协议设计，核心模块包括 AI 简历解析、JD 智能对齐分析、匹配度评分与智能导出。",
        "跨角色统筹：3 年银行一线经验中积累了跨部门资源协调、流程标准化制定、新员工培训体系搭建等产品经理核心软技能。"
      ].join("\n"),
      "AI 应用工程师 / AI 产品经理，要求 AI 翻译工作流优化、新媒体 AI 化运营、Prompt Engineering、学习落地能力。"
    );

    expect(result.after).not.toMatch(/…|\.{3}/u);
    expect(result.after).toContain("AI");
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

  it("does not create rewrite suggestions for education or supplement blocks", () => {
    const suggestions = generateSeedSuggestions({
      jdText: "招聘 AI 产品经理，要求 AI 产品设计、Prompt 迭代和数据分析。",
      calibratedResume: {
        status: "confirmed",
        personalInfo: {
          name: "吴世阳"
        },
        entries: [
          {
            id: "edu-1",
            section: "education",
            title: "湖南工业大学",
            dateRange: "2020 - 2022",
            bullets: ["本科，数学与应用数学（金融统计）"],
            sourceText: "湖南工业大学｜本科｜数学与应用数学（金融统计）",
            confidence: "high",
            issues: []
          },
          {
            id: "sup-1",
            section: "supplement",
            title: "技能与证书",
            bullets: ["Excel、Tableau、R、Stata、英语六级"],
            sourceText: "技能与证书\nExcel、Tableau、R、Stata、英语六级",
            confidence: "high",
            issues: []
          },
          {
            id: "project-1",
            section: "project",
            title: "OfferYou AI 岗位定制简历助手",
            dateRange: "2026.03 - 至今",
            bullets: ["独立完成产品定义与 MVP 范围收敛，设计三阶段核心流程。"],
            sourceText: "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
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
      facts: []
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.candidateId).toBe("project-1");
    expect(suggestions[0]?.beforeText).not.toContain("湖南工业大学");
    expect(suggestions[0]?.beforeText).not.toContain("英语六级");
  });

  it("uses model output when the provider returns suggestions", async () => {
    callModelJSON.mockResolvedValue({
      provider: "openai_compatible",
      data: {
        suggestions: [
          {
            section: "project",
            title: "OfferYou 项目",
            before: "原始项目内容",
            after: "独立主导 AI 求职辅助产品 OfferYou 的产品定义、需求拆解与三阶段核心流程落地。",
            reason: "聚焦 AI 产品流程与落地"
          }
        ]
      }
    });

    const suggestions = await generateAISuggestions(
      {
        jdText: "招聘 AI 产品经理，要求 AI 产品设计、Prompt 迭代和数据分析。",
        facts: [
          {
            text: "原始项目内容",
            section: "project",
            title: "OfferYou 项目",
            sourceKind: "master_fact",
            sourceLabel: "简历原文"
          }
        ],
        gaps: [],
        keywordsToBridge: ["AI", "Prompt", "数据分析"]
      },
      { modelProvider: "openai_compatible" }
    );

    expect(callModelJSON).toHaveBeenCalledOnce();
    expect(suggestions[0]?.afterText).toContain("AI 求职辅助产品 OfferYou");
    expect(suggestions[0]?.generationMode).toBe("model");
    expect(suggestions[0]?.modelProvider).toBe("openai_compatible");
  });

  it("annotates model fallback reasons when the gateway falls back", async () => {
    callModelJSON.mockResolvedValue({
      provider: "deterministic_fallback",
      data: null,
      fallbackReason: "Gemini 返回内容无法解析为 JSON，已切换到确定性回退。"
    });

    const suggestions = await generateAISuggestions(
      {
        jdText: "招聘 AI 产品经理，要求 AI 产品设计、Prompt 迭代和数据分析。",
        facts: [
          {
            text: "独立主导 AI 求职辅助产品 OfferYou 的产品定义、需求拆解和三阶段核心流程落地，覆盖简历解析、JD 对齐分析与导出链路。",
            section: "project",
            title: "OfferYou 项目",
            sourceKind: "master_fact",
            sourceLabel: "简历原文"
          }
        ],
        gaps: [],
        keywordsToBridge: ["AI", "Prompt", "数据分析"]
      },
      { modelProvider: "gemini" }
    );

    expect(callModelJSON).toHaveBeenCalledOnce();
    expect(suggestions[0]?.generationMode).toBe("deterministic_fallback");
    expect(suggestions[0]?.modelProvider).toBe("deterministic_fallback");
    expect(suggestions[0]?.modelFallbackReason).toContain("确定性回退");
    expect(suggestions[0]?.reasonText).not.toContain("模型降级原因");
  });

  it("stores quality warnings in verification when the model echoes the original text", async () => {
    callModelJSON.mockResolvedValue({
      provider: "openai_compatible",
      data: {
        suggestions: [
          {
            section: "summary",
            title: "个人优势",
            before: "AI 产品实践者：正在独立设计 AI 求职辅助产品 OfferYou。",
            after: "AI 产品实践者：正在独立设计 AI 求职辅助产品 OfferYou。",
            reason: "沿用原始优势表述"
          }
        ]
      }
    });

    const suggestions = await generateAISuggestions(
      {
        jdText: "招聘 AI 产品经理，要求 AI 产品设计、Prompt 迭代和数据分析。",
        facts: [
          {
            text: "AI 产品实践者：正在独立设计 AI 求职辅助产品 OfferYou。",
            section: "summary",
            title: "个人优势",
            sourceKind: "resume_baseline",
            sourceLabel: "简历原文"
          }
        ],
        gaps: [],
        keywordsToBridge: ["AI", "Prompt", "数据分析"]
      },
      { modelProvider: "openai_compatible" }
    );

    expect(callModelJSON).toHaveBeenCalledOnce();
    expect(suggestions[0]?.afterText).toBe("AI 产品实践者：正在独立设计 AI 求职辅助产品 OfferYou。");
    expect(suggestions[0]?.reasonText).not.toContain("质量提示");
    expect(suggestions[0]?.verification?.issues.join(" ")).toContain("过于接近");
    expect(suggestions[0]?.generationMode).toBe("model");
  });
});
