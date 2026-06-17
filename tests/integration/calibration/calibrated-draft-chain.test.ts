import { describe, expect, it } from "vitest";
import { readWorkspaceDraft, saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { composeSnapshotDocument } from "@/lib/services/snapshot/snapshot-composer";

describe("calibrated draft chain", () => {
  it("persists calibrated resume data and uses it for snapshot composition", async () => {
    await saveWorkspaceDraft({
      id: "calibrated-draft-1",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI 产品经理",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "AI 产品经理需要结构化表达、JD 匹配和复杂信息整理能力。",
      jdAsset: {
        storagePath: "/tmp/non-existent-jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: [
        "示例候选人",
        "项目经历",
        "O\"erYou AI 岗位定制简历助手 2026.03 - 至今",
        "教育背景",
        "对外经济贸易大学 硕士 2017.09 - 2021.06"
      ].join("\n"),
      calibratedResume: {
        status: "needs_review",
        personalInfo: {
          name: "示例候选人",
          phone: "13800000000",
          email: "candidate@example.com",
          github: "github.com/wsyoung",
          portfolio: "portfolio.link"
        },
        entries: [
          {
            id: "summary-1",
            section: "summary",
            title: "独立完成产品定义与 MVP 范围收敛。",
            bullets: ["设计输入即解析、导师式优化、快照派生三阶段流程。"],
            sourceText: "独立完成产品定义与 MVP 范围收敛。",
            confidence: "high",
            issues: []
          },
          {
            id: "project-1",
            section: "project",
            title: "OfferYou AI 岗位定制简历助手",
            dateRange: "2026.03 - 至今",
            bullets: ["独立完成产品定义与 MVP 范围收敛。"],
            sourceText: "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
            confidence: "high",
            issues: []
          },
          {
            id: "education-1",
            section: "education",
            title: "对外经济贸易大学 硕士",
            dateRange: "2017.09 - 2021.06",
            bullets: ["信息管理与信息系统"],
            sourceText: "对外经济贸易大学 硕士 2017.09 - 2021.06",
            confidence: "high",
            issues: []
          }
        ],
        unclassifiedText: ["O\"erYou AI 岗位定制简历助手 2026.03 - 至今"],
        parseWarnings: ["疑似 OCR 识别异常：O\"erYou AI 岗位定制简历助手 2026.03 - 至今"],
        modelNotes: ["需要人工确认教育背景年份。"],
        modelProvider: "deterministic_fallback",
        updatedAt: "2026-04-28T00:00:00.000Z"
      },
      analysis: {
        fitScore: 84,
        optimizationMode: "baseline_jd_match",
        strengths: ["结构化表达"],
        gaps: ["需要更明确的结果描述"],
        riskNotes: ["注意事实一致性"]
      },
      suggestions: [],
      factSubmissions: [],
      masterFactsUsed: []
    });

    const persisted = await readWorkspaceDraft("calibrated-draft-1");
    expect(persisted?.calibratedResume?.status).toBe("needs_review");
    expect(persisted?.calibratedResume?.entries.some((entry) => entry.section === "education")).toBe(true);

    const document = await composeSnapshotDocument(persisted!);

    expect(document.header.name).toBe("示例候选人");
    expect(document.header.meta.join(" ")).toContain("低置信字段");
    expect(JSON.stringify(document.sections.find((section) => section.id === "education")?.items)).toContain(
      "对外经济贸易大学"
    );
    expect(JSON.stringify(document.sections.find((section) => section.id === "project-experience")?.items)).toContain(
      "OfferYou AI 岗位定制简历助手"
    );
  });
});
