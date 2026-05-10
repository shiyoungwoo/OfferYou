import { describe, expect, it } from "vitest";
import { checkFactGrounding } from "@/lib/services/quality/fact-grounding";

describe("checkFactGrounding", () => {
  it("flags numbers and scale claims without source evidence", () => {
    const result = checkFactGrounding({
      beforeText: "负责客户沟通",
      afterText: "独立管理 20 人团队，并在 3 个月内推动 300 万收入。",
      jdText: "需要客户协作和流程梳理。",
      company: "星桥智能",
      jobTitle: "AI 产品经理",
      resumeText: "负责客户沟通与流程梳理。",
      masterFacts: [{ title: "流程梳理", text: "优化过投递流程。" }]
    });

    expect(result.highRisk).toBe(true);
    expect(result.riskNotes.join(" ")).toContain("管理人数");
    expect(result.riskNotes.join(" ")).toContain("收入");
  });

  it("does not treat JD text as candidate fact evidence", () => {
    const result = checkFactGrounding({
      beforeText: "负责产品需求整理。",
      afterText: "带领 30 人团队完成 AI 产品上线。",
      jdText: "要求有带领 30 人团队经验。",
      resumeText: "负责产品需求整理。",
      masterFacts: []
    });

    expect(result.highRisk).toBe(true);
    expect(result.riskNotes.join("\n")).toContain("30");
  });

  it("does not use company or job title as evidence for candidate achievements", () => {
    const result = checkFactGrounding({
      beforeText: "负责需求文档。",
      afterText: "在目标公司完成 50% 转化提升。",
      company: "目标公司",
      jobTitle: "AI 产品经理",
      resumeText: "负责需求文档。",
      masterFacts: []
    });

    expect(result.highRisk).toBe(true);
  });

  it("keeps grounded statements low risk", () => {
    const result = checkFactGrounding({
      beforeText: "负责客户沟通",
      afterText: "负责客户沟通与流程梳理，推动跨团队协作。",
      jdText: "需要客户协作和流程梳理。",
      company: "星桥智能",
      jobTitle: "AI 产品经理",
      resumeText: "负责客户沟通与流程梳理。",
      masterFacts: [{ title: "流程梳理", text: "优化过投递流程。" }]
    });

    expect(result.highRisk).toBe(false);
    expect(result.riskNotes).toHaveLength(0);
  });
});
