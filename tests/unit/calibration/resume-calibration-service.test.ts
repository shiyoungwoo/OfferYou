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
    expect(
      result.entries.some(
        (entry) => entry.section === "education" && entry.title.includes("对外经济贸易大学")
      )
    ).toBe(true);
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
    expect(result.entries[0]?.sourceText).toContain("OfferYou AI 岗位定制简历助手");
    expect(result.entries[0]?.bullets).toEqual(["完成 MVP 产品协议设计", "设计 JD 智能对齐分析"]);
  });
});
