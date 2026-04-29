import { describe, expect, it } from "vitest";
import { generateFinalResumeDraft } from "@/lib/services/snapshot/final-resume-draft-service";

describe("generateFinalResumeDraft", () => {
  it("uses calibrated resume entries to build a final document", async () => {
    const document = await generateFinalResumeDraft({
      calibratedResume: {
        status: "confirmed",
        personalInfo: {
          name: "吴世阳",
          phone: "18513449520",
          email: "434995517@qq.com"
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
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "deterministic_fallback",
        updatedAt: "2026-04-28T00:00:00.000Z"
      },
      jdText: "AI 产品经理负责岗位定制、工作流设计与结果表达。",
      acceptedSuggestions: [
        {
          id: "s1",
          section: "project",
          title: "Accepted",
          beforeText: "Before",
          afterText: "Built AI product workflow",
          reasonText: "Reason",
          status: "accepted",
          sourceKind: "master_fact",
          sourceLabel: "Master fact",
          revisionRound: 0
        }
      ],
      company: "OfferYou",
      jobTitle: "AI 产品经理"
    });

    expect(document.header.name).toBe("吴世阳");
    expect(document.header.title).toBe("AI 产品经理");
    expect(JSON.stringify(document)).toContain("Built AI product workflow");
    expect(JSON.stringify(document.sections.find((section) => section.id === "education")?.items)).toContain(
      "对外经济贸易大学"
    );
  });
});
