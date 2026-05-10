import { beforeEach, describe, expect, it, vi } from "vitest";

const { callModelJSON } = vi.hoisted(() => ({
  callModelJSON: vi.fn()
}));

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON
}));

vi.mock("node:fs", () => {
  return {
    default: { readFileSync: () => { throw new Error("no file in test"); } },
    readFileSync: () => { throw new Error("no file in test"); },
    existsSync: () => false,
    writeFileSync: () => {},
    mkdirSync: () => {}
  };
});

vi.mock("node:path", () => {
  return {
    default: { join: (...args: string[]) => args.join("/"), resolve: (...args: string[]) => args.join("/") },
    join: (...args: string[]) => args.join("/"),
    resolve: (...args: string[]) => args.join("/")
  };
});

import {
  generateAISuggestions,
  generateSeedSuggestions,
  rewriteFactForJd
} from "@/lib/services/analysis/suggestion-generator";
import { buildJDInsight } from "@/lib/services/analysis/jd-insight";

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

  it("does not create rewrite suggestions for education or credential blocks", () => {
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
            section: "credential",
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
            before: "独立主导 AI 求职辅助产品 OfferYou 的产品定义与需求拆解。",
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
            text: "独立主导 AI 求职辅助产品 OfferYou 的产品定义与需求拆解。",
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

  it("matches model suggestions back to calibrated candidateId by before text instead of array order", async () => {
    callModelJSON.mockResolvedValue({
      provider: "openai_compatible",
      generationMode: "model",
      data: {
        suggestions: [
          {
            section: "project",
            title: "第二项目",
            before: "AI 工具内容运营\n策划并发布 AI 工具深度图文。",
            after: "AI 工具内容运营：围绕目标岗位要求的内容运营和传播能力，策划并发布 AI 工具深度图文。",
            reason: "贴合 JD 中的内容运营要求",
            jdAbility: "内容运营与传播"
          },
          {
            section: "project",
            title: "第一项目",
            before: "OfferYou AI 岗位定制简历助手\n独立完成产品定义与 MVP 范围收敛。",
            after: "OfferYou AI 岗位定制简历助手：围绕 AI 产品设计和工作流设计，独立完成产品定义与 MVP 范围收敛。",
            reason: "贴合 JD 中的 AI 产品设计要求",
            jdAbility: "AI 产品设计"
          }
        ]
      }
    });

    const suggestions = await generateAISuggestions(
      {
        jdText: "招聘 AI 产品经理，要求 AI 产品设计、工作流设计、内容运营与传播。",
        calibratedResume: {
          status: "confirmed",
          personalInfo: { name: "吴世阳" },
          entries: [
            {
              id: "project-1",
              section: "project",
              title: "OfferYou AI 岗位定制简历助手",
              dateRange: "2026.03 - 至今",
              bullets: ["独立完成产品定义与 MVP 范围收敛。"],
              sourceText: "OfferYou AI 岗位定制简历助手\n独立完成产品定义与 MVP 范围收敛。",
              confidence: "high",
              issues: []
            },
            {
              id: "project-2",
              section: "project",
              title: "AI 工具内容运营",
              dateRange: "2026.03 - 至今",
              bullets: ["策划并发布 AI 工具深度图文。"],
              sourceText: "AI 工具内容运营\n策划并发布 AI 工具深度图文。",
              confidence: "high",
              issues: []
            }
          ],
          unclassifiedText: [],
          parseWarnings: [],
          modelNotes: [],
          modelProvider: "openai_compatible",
          updatedAt: "2026-04-28T00:00:00.000Z"
        },
        facts: [],
        gaps: [],
        keywordsToBridge: ["AI 产品设计", "内容运营"]
      },
      { modelProvider: "openai_compatible" }
    );

    expect(suggestions[0]?.candidateId).toBe("project-2");
    expect(suggestions[1]?.candidateId).toBe("project-1");
  });

  it("keeps model rewrites when the candidateId is rewritable even if the model section is wrong", async () => {
    callModelJSON.mockResolvedValue({
      provider: "openai_compatible",
      generationMode: "model",
      data: {
        suggestions: [
          {
            candidateId: "project-1",
            section: "education",
            title: "模型误标 section 的项目",
            before: "OfferYou AI 岗位定制简历助手\n独立完成产品定义与 MVP 范围收敛。",
            after: "OfferYou AI 岗位定制简历助手：围绕 AI 产品设计和工作流设计，独立完成产品定义与 MVP 范围收敛。",
            reason: "贴合 JD 中 AI 产品设计要求",
            jdAbility: "AI 产品设计"
          }
        ]
      }
    });

    const suggestions = await generateAISuggestions(
      {
        jdText: "招聘 AI 产品经理，要求 AI 产品设计和工作流设计。",
        calibratedResume: {
          status: "confirmed",
          personalInfo: { name: "吴世阳" },
          entries: [
            {
              id: "project-1",
              candidateId: "project-1",
              section: "project",
              sectionType: "project",
              title: "OfferYou AI 岗位定制简历助手",
              dateRange: "2026.03 - 至今",
              bullets: ["独立完成产品定义与 MVP 范围收敛。"],
              sourceText: "OfferYou AI 岗位定制简历助手\n独立完成产品定义与 MVP 范围收敛。",
              rawText: "OfferYou AI 岗位定制简历助手\n独立完成产品定义与 MVP 范围收敛。",
              confidence: "high",
              issues: []
            }
          ],
          unclassifiedText: [],
          parseWarnings: [],
          modelNotes: [],
          modelProvider: "openai_compatible",
          updatedAt: "2026-05-09T00:00:00.000Z"
        },
        facts: [],
        gaps: [],
        keywordsToBridge: ["AI 产品设计", "工作流设计"]
      },
      { modelProvider: "openai_compatible" }
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.candidateId).toBe("project-1");
    expect(suggestions[0]?.section).toBe("project");
    expect(suggestions[0]?.afterText).toContain("工作流设计");
  });

  it("drops model rewrites when candidateId points to education even if the model section says project", async () => {
    callModelJSON.mockResolvedValue({
      provider: "openai_compatible",
      generationMode: "model",
      data: {
        suggestions: [
          {
            candidateId: "edu-1",
            section: "project",
            title: "模型误标为项目的教育背景",
            before: "对外经济贸易大学\n硕士\n英语：CET-6",
            after: "对外经济贸易大学｜硕士｜英语：CET-6",
            reason: "错误建议",
            jdAbility: "学历背景"
          }
        ]
      }
    });

    const suggestions = await generateAISuggestions(
      {
        jdText: "招聘 AI 产品经理。",
        calibratedResume: {
          status: "confirmed",
          personalInfo: { name: "吴世阳" },
          entries: [
            {
              id: "edu-1",
              candidateId: "edu-1",
              section: "education",
              sectionType: "education",
              title: "对外经济贸易大学",
              dateRange: "2020 - 2022",
              bullets: ["硕士", "英语：CET-6"],
              sourceText: "对外经济贸易大学\n2020 - 2022\n硕士\n英语：CET-6",
              rawText: "对外经济贸易大学\n2020 - 2022\n硕士\n英语：CET-6",
              confidence: "high",
              issues: []
            }
          ],
          unclassifiedText: [],
          parseWarnings: [],
          modelNotes: [],
          modelProvider: "openai_compatible",
          updatedAt: "2026-05-09T00:00:00.000Z"
        },
        facts: [],
        gaps: [],
        keywordsToBridge: ["AI 产品经理"]
      },
      { modelProvider: "openai_compatible" }
    );

    expect(suggestions).toHaveLength(0);
  });

  it("replaces generic model jdAbility labels with concrete JD labels", async () => {
    callModelJSON.mockResolvedValue({
      provider: "openai_compatible",
      generationMode: "model",
      data: {
        suggestions: [
          {
            section: "project",
            title: "OfferYou 项目",
            before: "独立主导 AI 求职辅助产品 OfferYou 的产品定义与需求拆解。",
            after: "围绕 Prompt Engineering 改进 AI 简历改写流程。",
            reason: "贴合 Prompt Engineering 要求",
            jdAbility: "目标岗位要求的动作、结果和协作方式"
          }
        ]
      }
    });

    const suggestions = await generateAISuggestions(
      {
        jdText: "招聘 AI 产品经理，要求 Prompt Engineering 和 AI 产品设计。",
        facts: [
          {
            text: "独立主导 AI 求职辅助产品 OfferYou 的产品定义与需求拆解。",
            section: "project",
            title: "OfferYou 项目",
            sourceKind: "master_fact",
            sourceLabel: "简历原文"
          }
        ],
        gaps: [],
        keywordsToBridge: ["Prompt Engineering"],
        jdInsight: buildJDInsight({
          jdText: "招聘 AI 产品经理，要求 Prompt Engineering 和 AI 产品设计。"
        })
      },
      { modelProvider: "openai_compatible" }
    );

    expect(suggestions[0]?.jdAbility).not.toContain("目标岗位要求");
    expect(suggestions[0]?.jdAbility).toContain("AI");
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

  it("does not generate rewrite suggestions for credential or other_needs_review entries", () => {
    const suggestions = generateSeedSuggestions({
      jdText: "需要 AI 产品经理，熟悉 Prompt 和产品流程。",
      facts: [],
      calibratedResume: {
        status: "confirmed",
        personalInfo: {},
        entries: [
          {
            id: "credential-1",
            candidateId: "credential-1",
            section: "credential",
            sectionType: "credential",
            title: "英语：CET-6",
            bullets: [],
            sourceText: "英语：CET-6",
            rawText: "英语：CET-6",
            confidence: "high",
            issues: []
          },
          {
            id: "unknown-1",
            candidateId: "unknown-1",
            section: "other_needs_review",
            sectionType: "other_needs_review",
            title: "file:///tmp/resume-ai-pm.html",
            bullets: [],
            sourceText: "file:///tmp/resume-ai-pm.html",
            rawText: "file:///tmp/resume-ai-pm.html",
            confidence: "low",
            issues: ["无法确定所属模块"]
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "deterministic_fallback",
        updatedAt: new Date().toISOString()
      }
    });

    expect(suggestions).toHaveLength(0);
  });

  it("does not normalize unknown calibrated sections to experience", () => {
    const suggestions = generateSeedSuggestions({
      jdText: "需要产品经理。",
      facts: [],
      calibratedResume: {
        status: "needs_review",
        personalInfo: {},
        entries: [
          {
            id: "other-1",
            candidateId: "other-1",
            section: "other_needs_review",
            sectionType: "other_needs_review",
            title: "无法归类内容",
            bullets: ["学历：对外经济贸易大学 | 硕士", "英语：CET-6"],
            sourceText: "学历：对外经济贸易大学 | 硕士\n英语：CET-6",
            rawText: "学历：对外经济贸易大学 | 硕士\n英语：CET-6",
            confidence: "low",
            issues: ["需要人工确认"]
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "deterministic_fallback",
        updatedAt: new Date().toISOString()
      }
    });

    expect(suggestions.some((item) => item.section === "experience")).toBe(false);
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
