import { describe, expect, it } from "vitest";
import { analyzeDraft } from "@/lib/services/analysis/gap-analysis-service";

describe("analyzeDraft", () => {
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
