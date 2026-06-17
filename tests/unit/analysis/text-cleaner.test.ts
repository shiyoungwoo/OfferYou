import { describe, expect, it } from "vitest";
import { cleanGeneratedResumeText, normalizeOcrResumeText } from "@/lib/services/analysis/text-cleaner";

describe("text-cleaner", () => {
  it("preserves line breaks while normalizing horizontal whitespace", () => {
    expect(normalizeOcrResumeText("项目 A   2026.03 - 至今\n  负责 MVP 收敛")).toBe(
      "项目 A 2026.03 - 至今\n负责 MVP 收敛"
    );
  });

  it("repairs common OfferYou PDF OCR artifacts", () => {
    expect(normalizeOcrResumeText('O"erYou ) AI 岗位定制\n设计$输入即解析')).toBe(
      "OfferYou AI 岗位定制\n设计输入即解析"
    );
  });

  it("removes browser PDF headers and footers from parsed resume text", () => {
    expect(
      normalizeOcrResumeText(
        [
          "2026/3/11 00:26示例候选人 - AI产品经理简历",
          "第2/2页file:///tmp/resume-ai-pm.html",
          "运用 Excel 和 Tableau 搭建自动化预算分析模板"
        ].join("\n")
      )
    ).toBe("运用 Excel 和 Tableau 搭建自动化预算分析模板");
  });

  it("keeps generated resume structure after removing AI wrapper text", () => {
    expect(cleanGeneratedResumeText("建议在此经历中补充与岗位相关的具体动作或成果描述，以增强竞争力。\n项目 A")).toBe("项目 A");
  });
});
