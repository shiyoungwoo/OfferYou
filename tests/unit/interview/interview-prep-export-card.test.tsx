import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewPrepExportCard } from "@/components/interview/interview-prep-export-card";

describe("InterviewPrepExportCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders a copyable markdown summary with review checklist", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock
      }
    });

    render(
      <InterviewPrepExportCard
        answeredQuestionCount={1}
        checklistItems={[
          "核对公司与岗位是否一致：OfferYou · AI Product Manager",
          "确认自我介绍是否已更新：已填写",
          "确认收藏问题是否已标记：1 题",
          "确认答案草稿是否已补齐：1 题"
        ]}
        company="OfferYou"
        exportText={createExportText()}
        favoriteQuestionCount={1}
        jobTitle="AI Product Manager"
      />
    );

    const exportText = screen.getByLabelText("面试准备导出文本") as HTMLTextAreaElement;
    expect(exportText.value).toContain("面试准备复盘卡");
    expect(exportText.value).toContain("OfferYou");
    expect(exportText.value).toContain("AI Product Manager");
    expect(exportText.value).toContain("我会先把真实经历讲清楚。");
    expect(exportText.value).toContain("请说明简历里最能支撑");
    expect(exportText.value).toContain("答案草稿：我会先用一条事实说明匹配度。");

    expect(screen.getByText("面试前复盘清单")).toBeTruthy();
    expect(screen.getByText("核对公司与岗位是否一致：OfferYou · AI Product Manager")).toBeTruthy();
    expect(screen.getByText("确认收藏问题是否已标记：1 题")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "复制复盘文本" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("面试准备复盘卡"));
      expect(screen.getByText("已复制到剪贴板。")).toBeTruthy();
    });
  });
});

function createExportText() {
  return [
    "# 面试准备复盘卡",
    "",
    "- 公司：OfferYou",
    "- 岗位：AI Product Manager",
    "",
    "## 自我介绍草稿",
    "我会先把真实经历讲清楚。",
    "",
    "## 收藏问题",
    "1. 请说明简历里最能支撑 AI Product Manager 的一条优势，并结合事实展开。",
    "   答案草稿：我会先用一条事实说明匹配度。",
    "",
    "## 已填写答案草稿",
    "1. 请说明简历里最能支撑 AI Product Manager 的一条优势，并结合事实展开。",
    "   答案草稿：我会先用一条事实说明匹配度。"
  ].join("\n");
}
