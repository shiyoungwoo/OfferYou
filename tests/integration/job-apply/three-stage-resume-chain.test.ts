import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON: vi.fn(async () => ({
    provider: "deterministic_fallback",
    data: null,
    fallbackReason: "mocked fallback"
  }))
}));

vi.mock("@/lib/services/export/pdf-export-service", () => ({
  measureResumeHtmlPageCount: vi.fn(async () => 1)
}));

import { analyzeDraft } from "@/lib/services/analysis/gap-analysis-service";
import { readWorkspaceDraft, saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { generateSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";

describe("three-stage resume chain", () => {
  it("calibrates parsed resume text, generates tailored suggestions, and snapshots the accepted result", async () => {
    const calibratedResume = {
      status: "needs_review" as const,
      personalInfo: {
        name: "吴世阳",
        phone: "18513449520",
        email: "434995517@qq.com"
      },
      entries: [
        {
          id: "project-1",
          section: "project" as const,
          title: "OfferYou AI 岗位定制简历助手",
          dateRange: "2026.03 - 至今",
          bullets: ["独立完成产品定义与 MVP 范围收敛，设计三阶段核心流程。"],
          sourceText: "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
          confidence: "high" as const,
          issues: []
        },
        {
          id: "education-1",
          section: "education" as const,
          title: "对外经济贸易大学 硕士",
          dateRange: "2017.09 - 2021.06",
          bullets: ["信息管理与信息系统"],
          sourceText: "对外经济贸易大学 硕士 2017.09 - 2021.06",
          confidence: "high" as const,
          issues: []
        }
      ],
      unclassifiedText: ["O\"erYou AI 岗位定制简历助手"],
      parseWarnings: ["疑似 OCR 识别异常：O\"erYou AI 岗位定制简历助手"],
      modelNotes: ["需要人工确认教育背景顺序。"],
      modelProvider: "deterministic_fallback" as const,
      updatedAt: "2026-04-28T00:00:00.000Z"
    };

    const analysis = await analyzeDraft({
      jdText: "AI 产品经理负责岗位定制、Prompt 迭代、工作流设计与结果表达。",
      calibratedResume,
      facts: [
        {
          text: "在银行网点负责柜面现金收付与日常业务办理，保证基础服务稳定。",
          section: "experience",
          title: "银行柜面",
          sourceKind: "resume_baseline",
          sourceLabel: "原始简历"
        }
      ]
    });

    expect(analysis.suggestions[0]?.beforeText).toContain("OfferYou AI 岗位定制简历助手");
    expect(analysis.suggestions[0]?.candidateId).toBe("project-1");

    await saveWorkspaceDraft({
      id: "chain-draft-1",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI 产品经理",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "AI 产品经理负责岗位定制、Prompt 迭代、工作流设计与结果表达。",
      jdAsset: {
        storagePath: "/tmp/non-existent-jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: [
        "吴世阳",
        "项目经历",
        "O\"erYou AI 岗位定制简历助手 2026.03 - 至今",
        "教育背景",
        "对外经济贸易大学 硕士 2017.09 - 2021.06"
      ].join("\n"),
      calibratedResume,
      analysis: {
        fitScore: analysis.fitScore,
        optimizationMode: analysis.optimizationMode,
        strengths: analysis.strengths,
        gaps: analysis.gaps,
        riskNotes: analysis.riskNotes
      },
      suggestions: analysis.suggestions.map((suggestion, index) => ({
        ...suggestion,
        status: index === 0 ? "accepted" : "rejected",
        sourceLabel: suggestion.sourceLabel,
        revisionRound: suggestion.revisionRound
      })),
      factSubmissions: [],
      masterFactsUsed: []
    });

    const persisted = await readWorkspaceDraft("chain-draft-1");
    expect(persisted?.calibratedResume?.parseWarnings[0]).toContain("O\"erYou");
    expect(persisted?.masterFactsUsed).toEqual([]);

    const snapshot = await generateSnapshotForDraft("chain-draft-1");

    expect(snapshot.document.header.title).toBe("AI 产品经理");
    expect(snapshot.document.header.meta.join(" ")).toContain("低置信字段");
    expect(JSON.stringify(snapshot.document.sections.find((section) => section.id === "education")?.items)).toContain(
      "对外经济贸易大学"
    );
    expect(JSON.stringify(snapshot.document)).toContain("OfferYou AI 岗位定制简历助手");
    expect(snapshot.pageEstimate).toBeGreaterThan(0);
  });
});
