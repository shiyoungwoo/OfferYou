import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InterviewOutcomePopover } from "@/components/interview/interview-outcome-popover";
import type { ApplicationRecord } from "@/lib/services/applications/application-record-service";

function buildRecord(overrides: Partial<ApplicationRecord> = {}): ApplicationRecord {
  return {
    id: "record-1",
    draftId: "",
    snapshotId: "",
    source: "manual_interview",
    company: "和讯网",
    jobTitle: "金融 AI 产品经理",
    interviewStatus: "scheduled",
    interviewAt: "2026-06-15T08:00:00.000Z",
    interviewRound: "一面",
    interviewNotes: "Boss 直聘 HR 联系，已加微信",
    appliedAt: "2026-06-15T08:00:00.000Z",
    acceptedSuggestionCount: 0,
    reusedMasterFacts: [],
    ...overrides
  };
}

describe("InterviewOutcomePopover", () => {
  it("renders interview progress as a popup action for dashboard records", () => {
    render(
      <InterviewOutcomePopover
        record={buildRecord()}
        saveAction={vi.fn()}
        triggerLabel="记录进展"
      />
    );

    expect(screen.getByText("记录进展")).toBeTruthy();
    expect(screen.getByText("记录结果和下一轮安排")).toBeTruthy();
    expect(screen.getByText("最近一场：06/15 16:00 · 一面 · Boss 直聘 HR 联系，已加微信")).toBeTruthy();
    expect(screen.getByLabelText("面试结果")).toBeTruthy();
    expect(screen.getByLabelText("下一轮时间")).toBeTruthy();
    expect(screen.getByLabelText("跟进记录")).toBeTruthy();
    expect(screen.getByRole("button", { name: "保存面试进展" })).toBeTruthy();
  });
});
