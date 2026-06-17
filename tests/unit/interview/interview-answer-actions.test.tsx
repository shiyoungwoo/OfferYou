import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFormStatus } from "react-dom";
import { InterviewAnswerActions } from "@/components/interview/interview-answer-actions";

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormStatus: vi.fn()
  };
});

const optimizeAction = vi.fn(async (_formData: FormData) => {});

describe("InterviewAnswerActions", () => {
  beforeEach(() => {
    vi.mocked(useFormStatus).mockReturnValue({
      pending: false,
      data: null,
      method: null,
      action: null
    });
  });

  it("shows save and AI optimize actions before submission", () => {
    render(<InterviewAnswerActions optimizeAction={optimizeAction} />);

    expect(screen.getByRole("button", { name: "保存答案草稿" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "AI 优化答案" })).toBeTruthy();
  });

  it("shows saving state when the save action is pending", () => {
    vi.mocked(useFormStatus).mockReturnValue({
      pending: true,
      data: new FormData(),
      method: "post",
      action: "/prep"
    } as ReturnType<typeof useFormStatus>);

    render(<InterviewAnswerActions optimizeAction={optimizeAction} />);

    const saveButton = screen.getByRole("button", { name: "正在保存..." }) as HTMLButtonElement;
    const optimizeButton = screen.getByRole("button", { name: "AI 优化答案" }) as HTMLButtonElement;
    expect(saveButton.getAttribute("aria-busy")).toBe("true");
    expect(saveButton.disabled).toBe(true);
    expect(optimizeButton.disabled).toBe(true);
  });

  it("shows optimizing state when the AI optimize action is pending", () => {
    vi.mocked(useFormStatus).mockReturnValue({
      pending: true,
      data: new FormData(),
      method: "post",
      action: optimizeAction
    } as ReturnType<typeof useFormStatus>);

    render(<InterviewAnswerActions optimizeAction={optimizeAction} />);

    const saveButton = screen.getByRole("button", { name: "保存答案草稿" }) as HTMLButtonElement;
    const optimizeButton = screen.getByRole("button", { name: "正在优化..." }) as HTMLButtonElement;
    expect(optimizeButton.getAttribute("aria-busy")).toBe("true");
    expect(saveButton.disabled).toBe(true);
    expect(optimizeButton.disabled).toBe(true);
  });
});
