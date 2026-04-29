import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResumeCalibrationPanel } from "@/components/applications/resume-calibration-panel";

describe("ResumeCalibrationPanel", () => {
  it("shows a calibration summary when data exists", () => {
    render(
      <ResumeCalibrationPanel
        calibratedResume={{
          status: "needs_review",
          personalInfo: {
            name: "吴世阳",
            phone: "18513449520",
            email: "434995517@qq.com",
            portfolio: "portfolio.link",
            github: "github.com/wsyoung",
            educationSummary: "对外经济贸易大学 · 硕士"
          },
          entries: [
            {
              id: "entry-1",
              section: "education",
              title: "对外经济贸易大学 硕士",
              dateRange: "2017.09 - 2021.06",
              bullets: ["信息管理与信息系统"],
              sourceText: "对外经济贸易大学 硕士 2017.09 - 2021.06",
              confidence: "high",
              issues: []
            }
          ],
          unclassifiedText: ["O\"erYou AI 岗位定制简历助手"],
          parseWarnings: ["疑似 OCR 识别异常：O\"erYou"],
          modelNotes: ["当前结果来自确定性结构恢复。"],
          modelProvider: "deterministic_fallback",
          updatedAt: "2026-04-28T00:00:00.000Z"
        }}
      />
    );

    expect(screen.getByText("简历结构校准")).toBeTruthy();
    expect(screen.getByText("需要确认")).toBeTruthy();
    expect(screen.getByText("吴世阳")).toBeTruthy();
    expect(screen.getAllByRole("listitem")[0]?.textContent).toContain("疑似 OCR 识别异常：O\"erYou");
  });

  it("shows the empty-state calibration message when data is missing", () => {
    render(<ResumeCalibrationPanel />);

    expect(screen.getByText("简历结构校准")).toBeTruthy();
    expect(screen.getByText("先把原始简历恢复成稳定结构")).toBeTruthy();
    expect(screen.getByText(/上传简历后，系统会先恢复姓名、联系方式、工作经历、项目经历和教育背景/)).toBeTruthy();
  });
});
