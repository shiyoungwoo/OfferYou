import { describe, expect, it } from "vitest";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { buildJobApplyRunFromDraft } from "@/lib/services/job-apply/job-apply-run-service";

describe("job apply run service", () => {
  it("summarizes a draft as a reviewable agent run", () => {
    const run = buildJobApplyRunFromDraft(baseDraft({
      suggestions: [
        {
          id: "s-1",
          candidateId: "summary-1",
          section: "summary",
          title: "个人优势",
          beforeText: "原文",
          afterText: "改写",
          reasonText: "理由",
          status: "pending",
          sourceKind: "resume_baseline",
          sourceLabel: "简历",
          generationMode: "model",
          modelProvider: "openai_compatible",
          jdAbility: "AI 工具 / Prompt 应用",
          factAnchors: ["原文"],
          verification: {
            status: "pass",
            issues: []
          },
          revisionRound: 0
        }
      ]
    }));

    expect(run.stage).toBe("user_reviewing");
    expect(run.steps.map((step) => step.stage)).toEqual([
      "input_received",
      "jd_analyzed",
      "strategy_planned",
      "suggestions_ready",
      "user_reviewing"
    ]);
    expect(run.jdInsight?.coreAbilities).toContain("AI 工具 / Prompt 应用");
  });

  it("moves to snapshot_ready when a suggestion has been accepted", () => {
    const run = buildJobApplyRunFromDraft(baseDraft({
      suggestions: [
        {
          id: "s-1",
          candidateId: "project-1",
          section: "project",
          title: "项目经历",
          beforeText: "原文",
          afterText: "改写",
          reasonText: "理由",
          status: "accepted",
          sourceKind: "resume_baseline",
          sourceLabel: "简历",
          generationMode: "model_repaired",
          modelProvider: "openai_compatible",
          revisionRound: 0
        }
      ]
    }));

    expect(run.stage).toBe("snapshot_ready");
    expect(run.steps.some((step) => step.stage === "snapshot_ready")).toBe(true);
  });

  it("keeps fallback and verifier issues visible inside run risk notes", () => {
    const run = buildJobApplyRunFromDraft(baseDraft({
      suggestions: [
        {
          id: "s-1",
          section: "project",
          title: "项目经历",
          beforeText: "原文",
          afterText: "原文",
          reasonText: "理由",
          status: "pending",
          sourceKind: "resume_baseline",
          sourceLabel: "简历",
          generationMode: "deterministic_fallback",
          modelProvider: "deterministic_fallback",
          modelFallbackReason: "模型不可用，已进入规则兜底。",
          verification: {
            status: "fail",
            issues: ["改写内容与原文过于接近。"]
          },
          revisionRound: 0
        }
      ]
    }));

    const suggestionStep = run.steps.find((step) => step.stage === "suggestions_ready");

    expect(suggestionStep?.confidence).toBe("medium");
    expect(suggestionStep?.riskNotes).toContain("模型不可用，已进入规则兜底。");
    expect(suggestionStep?.riskNotes).toContain("改写内容与原文过于接近。");
  });
});

function baseDraft(overrides: Partial<PersistedWorkspaceDraft> = {}): PersistedWorkspaceDraft {
  return {
    id: "draft-1",
    userId: "user-1",
    company: "图灵文化",
    jobTitle: "AI 产品经理",
    language: "zh-CN",
    stage: "analysis_ready",
    status: "created",
    jdPreview: "需要 AI 工具、Prompt 应用、产品需求拆解和数据分析能力。",
    jdAsset: {
      storagePath: "storage/jd.txt",
      mimeType: "text/plain",
      originalFilename: "jd.txt"
    },
    resumeExtractedText: "OfferYou AI 岗位定制简历助手",
    jdInsight: {
      company: "图灵文化",
      jobTitle: "AI 产品经理",
      hardRequirements: ["AI 工具 / Prompt 应用"],
      coreAbilities: ["AI 工具 / Prompt 应用", "产品需求拆解"],
      bonusItems: ["作品集或账号案例"],
      avoidItems: ["不改写公司、学历、时间和可核验事实"]
    },
    rewriteStrategy: {
      priorities: ["AI 工具 / Prompt 应用", "产品需求拆解"],
      sectionOrder: ["summary", "project", "experience", "education"],
      lowRelevancePolicy: "compress_keep_timeline",
      distortionGuards: ["不改写公司、学历、时间和可核验事实"]
    },
    analysis: {
      fitScore: 65,
      optimizationMode: "baseline_jd_match",
      strengths: ["有 AI 产品项目"],
      gaps: [],
      riskNotes: []
    },
    masterFactsUsed: [],
    suggestions: [],
    factSubmissions: [],
    ...overrides
  };
}
