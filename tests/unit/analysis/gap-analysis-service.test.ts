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
          text: "Guided customers through a messy onboarding flow and rebuilt trust across teams.",
          sourceKind: "resume_baseline"
        }
      ]
    });

    expect(result.optimizationMode).toBe("talent_amplified");
    expect(result.strengths.join(" ")).toMatch(/confirmed strengths profile/i);
    expect(result.suggestions[0]?.afterText).toMatch(/underlying strengths profile/i);
  });
});
