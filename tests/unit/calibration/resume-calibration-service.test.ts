import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON: vi.fn()
}));

import { callModelJSON } from "@/lib/ai/model-gateway";
import {
  calibrateResumeStructure,
  calibrateResumeStructureDeterministic
} from "@/lib/services/calibration/resume-calibration-service";

describe("calibrateResumeStructureDeterministic", () => {
  it("keeps education in education section and suspicious OCR text in warnings", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "吴世阳",
        "手机：18513449520 邮箱：434995517@qq.com",
        "项目经历",
        "O\"erYou ) AI 岗位定制简历助手 2026.03 - 至今",
        "独立完成产品定义与 MVP 范围收敛。",
        "教育背景",
        "对外经济贸易大学 硕士 2017.09 - 2021.06"
      ].join("\n")
    });

    expect(result.personalInfo.name).toBe("吴世阳");
    expect(result.personalInfo.phone).toBe("18513449520");
    const educationEntry = result.entries.find(
      (entry) => entry.section === "education" && entry.title.includes("对外经济贸易大学")
    );

    expect(educationEntry).toBeTruthy();
    expect(educationEntry?.candidateId).toBe(educationEntry?.id);
    expect(educationEntry?.sectionType).toBe("education");
    expect(educationEntry?.rawText).toContain("对外经济贸易大学");
    expect(result.entries.some((entry) => entry.title.includes("OfferYou"))).toBe(true);
    expect(result.status).toBe("confirmed");
  });

  it("recognizes markdown headings and spaced Chinese names from PDF extraction", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "# 吴 世 阳",
        "男 | 31岁 | 共产党员 | 18513449520 | 434995517@qq.com",
        "## 项 目 经 历",
        "O\"erYou ) AI 岗位定制简历助手 （个人产品项目） 2026.03 - 至今",
        "独立完成产品定义与 MVP 范围收敛。",
        "## 工 作 经 历",
        "陕西怡阳医疗科技有限公司 % 数据工程师 2025.09 - 2025.11"
      ].join("\n")
    });

    expect(result.personalInfo.name).toBe("吴世阳");
    expect(result.entries.some((entry) => entry.section === "project" && entry.title.includes("OfferYou"))).toBe(true);
    expect(result.entries.some((entry) => entry.section === "work" && entry.title.includes("陕西怡阳"))).toBe(true);
    expect(JSON.stringify(result.entries)).not.toContain("陕西正大");
  });

  it("classifies language and certificates as credential instead of work", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "吴世阳",
        "技能与证书",
        "英语：CET-6",
        "基金从业资格证",
        "工作经历",
        "广发银行北京分行 | 综合柜员岗 2022.08 - 2025.08",
        "负责运营数据统计与客户服务。"
      ].join("\n")
    });

    expect(result.entries.some((entry) => entry.section === "credential" && entry.rawText?.includes("CET-6"))).toBe(true);
    expect(result.entries.some((entry) => entry.section === "work" && entry.rawText?.includes("CET-6"))).toBe(false);
    expect(result.entries.some((entry) => entry.section === "work" && entry.rawText?.includes("广发银行"))).toBe(true);
  });

  it("keeps unknown blocks in other_needs_review and does not promote them to work", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "其他信息",
        "2026/3/11 00:26 吴世阳 - AI 产品经理简历",
        "file:///tmp/resume-ai-pm.html"
      ].join("\n")
    });

    expect(result.entries.some((entry) => entry.section === "other_needs_review")).toBe(true);
    expect(result.entries.some((entry) => entry.section === "work")).toBe(false);
  });

  it("keeps project body lines under their project instead of promoting them to fake projects", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "吴世阳",
        "手机：18513449520 邮箱：434995517@qq.com",
        "项目经历",
        "OfferYou AI 岗位定制简历助手 （个人产品项目） 2026.03 - 至今",
        "独立完成产品定义与 MVP 范围收敛，设计「输入即解构 → 导师式优化 → 快照派生」三阶段核心流程。",
        "输出完整的产品输入输出协议文档、OpenAPI 3.1 接口草案、前端四页面状态机设计。",
        "定义「绝对防失真」原则，AI 仅提供带理由的局部改写建议，用户逐条确认。",
        "AI 工具自媒体内容运营 （个人项目） 2026.03 - 至今",
        "策划并发布 AI 工具类深度图文系列，覆盖小红书、微信公众号、微博三平台。",
        "「Codex + Obsidian 智能工作流」单篇阅读量 8000+，点赞收藏 700+。"
      ].join("\n")
    });

    const projects = result.entries.filter((entry) => entry.section === "project");

    expect(projects).toHaveLength(2);
    expect(projects[0]?.title).toContain("OfferYou");
    expect(projects[0]?.dateRange).toBe("2026.03 - 至今");
    expect(projects[0]?.bullets.join(" ")).toContain("独立完成产品定义");
    expect(projects[0]?.bullets.join(" ")).toContain("OpenAPI 3.1");
    expect(projects[0]?.bullets.join(" ")).toContain("绝对防失真");
    expect(projects[0]?.candidateId).toBe(projects[0]?.id);
    expect(projects[0]?.sectionType).toBe("project");
    expect(projects[0]?.rawText).toContain("独立完成产品定义");
    expect(projects[1]?.title).toContain("AI 工具自媒体内容运营");
    expect(projects[1]?.bullets.join(" ")).toContain("Codex + Obsidian");
  });

  it("attaches standalone education date lines to the previous school entry", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "吴世阳",
        "手机：18513449520 邮箱：434995517@qq.com",
        "教育背景",
        "对外经济贸易大学 | 硕士 | 全球价值链（应用经济学）",
        "2020 - 2022",
        "湖南工业大学 | 本科 | 数学与应用数学（金融统计）",
        "2013 - 2017"
      ].join("\n")
    });

    const education = result.entries.filter((entry) => entry.section === "education");

    expect(education).toHaveLength(2);
    expect(education[0]?.title).toContain("对外经济贸易大学");
    expect(education[0]?.dateRange).toBe("2020 - 2022");
    expect(education[0]?.candidateId).toBe(education[0]?.id);
    expect(education[0]?.sectionType).toBe("education");
    expect(education[0]?.rawText).toContain("对外经济贸易大学");
    expect(education[1]?.title).toContain("湖南工业大学");
    expect(education[1]?.dateRange).toBe("2013 - 2017");
    expect(education.some((entry) => /^\d{4}\s*-\s*\d{4}$/.test(entry.title))).toBe(false);
  });
});

describe("calibrateResumeStructure", () => {
  it("falls back to deterministic calibration when the model is unavailable", async () => {
    vi.mocked(callModelJSON).mockResolvedValue({
      provider: "deterministic_fallback",
      data: null,
      fallbackReason: "未检测到模型"
    });

    const result = await calibrateResumeStructure({
      resumeText: [
        "吴世阳",
        "手机：18513449520 邮箱：434995517@qq.com",
        "项目经历",
        "O\"erYou ) AI 岗位定制简历助手 2026.03 - 至今"
      ].join("\n")
    });

    expect(result.modelProvider).toBe("deterministic_fallback");
    expect(result.modelNotes.join(" ")).toContain("未检测到模型");
  });

  it("falls back when the model returns an invalid structure", async () => {
    vi.mocked(callModelJSON).mockResolvedValue({
      provider: "gemini",
      data: {
        status: "confirmed",
        personalInfo: { name: "吴世阳" },
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "gemini"
      }
    });

    const result = await calibrateResumeStructure({
      resumeText: [
        "吴世阳",
        "手机：18513449520 邮箱：434995517@qq.com",
        "项目经历",
        "O\"erYou ) AI 岗位定制简历助手 2026.03 - 至今"
      ].join("\n")
    });

    expect(result.modelProvider).toBe("deterministic_fallback");
    expect(result.modelNotes.join(" ")).toContain("模型返回结构无法通过校验");
  });

  it("normalizes usable model entries that omit mechanical fields", async () => {
    vi.mocked(callModelJSON).mockResolvedValue({
      provider: "openai_compatible",
      data: {
        status: "confirmed",
        personalInfo: { name: "吴世阳", phone: "18513449520" },
        entries: [
          {
            section: "project",
            title: "OfferYou AI 岗位定制简历助手",
            dateRange: "2026.03 - 至今",
            bullets: "完成 MVP 产品协议设计；设计 JD 智能对齐分析",
            confidence: "high"
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: ["模型校准完成"]
      }
    });

    const result = await calibrateResumeStructure({
      resumeText: "OfferYou AI 岗位定制简历助手 2026.03 - 至今"
    });

    expect(result.modelProvider).toBe("openai_compatible");
    expect(result.entries[0]?.id).toBeTruthy();
    expect(result.entries[0]?.candidateId).toBe(result.entries[0]?.id);
    expect(result.entries[0]?.sectionType).toBe("project");
    expect(result.entries[0]?.sourceText).toContain("OfferYou AI 岗位定制简历助手");
    expect(result.entries[0]?.rawText).toContain("OfferYou AI 岗位定制简历助手");
    expect(result.entries[0]?.bullets).toEqual(["完成 MVP 产品协议设计", "设计 JD 智能对齐分析"]);
  });
});
