import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeDraft } from "@/lib/services/analysis/gap-analysis-service";

describe("analyzeDraft", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    delete process.env.MIMO_API_KEY;
    delete process.env.MIMO_BASE_URL;
    delete process.env.MIMO_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.GEMINI_API_KEY;
  });

  it("returns strengths, gaps, and fit score", async () => {
    const result = await analyzeDraft({
      jdText: "Need AI product management and workflow design with user impact and metrics.",
      facts: [{ text: "Designed an AI workflow product with user-facing flow improvements." }]
    });

    expect(result.fitScore).toBeGreaterThanOrEqual(0);
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.optimizationMode).toBe("baseline_jd_match");
    expect(result.riskNotes.join(" ")).toContain("模型降级原因");
  });

  it("uses calibrated resume entries when they are available", async () => {
    const result = await analyzeDraft({
      jdText: "Need AI product management and workflow design with user impact and metrics.",
      facts: [
        {
          text: "在银行网点负责柜面现金收付与日常业务办理，保证基础服务稳定。"
        }
      ],
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
            bullets: ["独立完成产品定义与 MVP 范围收敛。"],
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
      }
    });

    expect(result.suggestions[0]?.beforeText).toContain("OfferYou AI 岗位定制简历助手");
    expect(result.suggestions[0]?.candidateId).toBe("cal-1");
  });

  it("uses OpenAI-compatible providers for AI rewrite suggestions instead of seed fallback", async () => {
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
    process.env.MIMO_MODEL = "mimo-v2.5-pro";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  fitScore: 82,
                  strengths: ["具备 AI 产品实践经验"],
                  gaps: ["需要更突出新媒体 AI 化运营"],
                  keywordsToBridge: ["AI 工作流", "Prompt Engineering"],
                  riskNotes: []
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      section: "project",
                      title: "OfferYou 项目岗位化改写",
                      before: "独立完成产品定义与 MVP 范围收敛。",
                      after: "OfferYou AI 岗位定制简历助手：围绕 AI 产品经理岗位，完成 JD 解析、Prompt 改写、简历快照与导出链路设计，并用真实求职场景验证产品流程。",
                      reason: "对应 JD 中 AI 工作流和 Prompt Engineering 要求。"
                    }
                  ]
                })
              }
            }
          ]
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeDraft({
      jdText: "AI 产品经理要求 AI 工作流优化、Prompt Engineering 和新媒体 AI 化运营。",
      facts: [
        {
          text: "独立完成产品定义与 MVP 范围收敛。",
          section: "project",
          sourceKind: "resume_baseline",
          sourceLabel: "简历原文"
        }
      ]
    });

    expect(result.suggestions[0]?.id).toBe("ai-1");
    expect(result.suggestions[0]?.sourceLabel).toBe("小米 MiMo 改写建议");
    expect(result.suggestions[0]?.afterText).toContain("Prompt 改写");
    expect(result.suggestions[0]?.afterText).not.toBe(result.suggestions[0]?.beforeText);
  });

  it("switches into talent-amplified optimization when a strengths profile exists", async () => {
    const result = await analyzeDraft({
      jdText: "Need customer guidance, workflow clarity, and cross-functional delivery.",
      talentProfile: {
        headline: "你最容易发光的状态，是作为“建立信任的人”。",
        confidenceNote: "当前可信度为中等。"
      },
      careerDirection: {
        label: "客户成功、客户关系与服务推进类方向",
        rationale: "Rationale"
      },
      facts: [
        {
          text: "Guided customers through a messy onboarding flow and rebuilt trust across teams."
        }
      ]
    });

    expect(result.optimizationMode).toBe("talent_amplified");
    expect(result.strengths.join(" ")).toContain("已确认的优势档案");
    expect(result.strengths.join(" ")).toContain("客户成功、客户关系与服务推进类方向");
    expect(result.suggestions[0]?.afterText).toContain("工作流设计");
  });
});
