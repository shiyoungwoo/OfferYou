import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddInterviewScheduleForm } from "@/components/interview/add-interview-schedule-form";

describe("AddInterviewScheduleForm", () => {
  it("allows manually adding an interview without application records", () => {
    render(<AddInterviewScheduleForm records={[]} scheduleAction={vi.fn()} />);

    expect(screen.getByLabelText("公司名称")).toBeTruthy();
    expect(screen.getByLabelText("岗位名称")).toBeTruthy();
    expect(screen.getByLabelText("面试时间")).toBeTruthy();
    expect(screen.getByRole("button", { name: "保存面试安排" })).toBeTruthy();
    expect(screen.queryByText("先完成一次简历定制或导出后")).toBeNull();
  });

  it("keeps existing application records optional instead of required", () => {
    render(
      <AddInterviewScheduleForm
        records={[
          {
            id: "record-1",
            company: "OfferYou",
            jobTitle: "AI 产品经理"
          }
        ]}
        scheduleAction={vi.fn()}
      />
    );

    const select = screen.getByLabelText("关联岗位记录（可选）") as HTMLSelectElement;

    expect(select).toBeTruthy();
    expect(select.hasAttribute("required")).toBe(false);
    expect(screen.getByLabelText("公司名称")).toBeTruthy();
    expect(screen.getByLabelText("岗位名称")).toBeTruthy();
  });
});
