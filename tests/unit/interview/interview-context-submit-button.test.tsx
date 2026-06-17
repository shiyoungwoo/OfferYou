import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFormStatus } from "react-dom";
import { InterviewContextSubmitButton } from "@/components/interview/interview-context-submit-button";

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormStatus: vi.fn()
  };
});

describe("InterviewContextSubmitButton", () => {
  beforeEach(() => {
    vi.mocked(useFormStatus).mockReturnValue({
      pending: false,
      data: null,
      method: null,
      action: null
    });
  });

  it("shows the normal submit label before submission", () => {
    render(<InterviewContextSubmitButton />);

    expect(screen.getByRole("button", { name: "保存资料并重新生成" })).toBeTruthy();
  });

  it("shows a busy disabled state while the server action is running", () => {
    vi.mocked(useFormStatus).mockReturnValue({
      pending: true,
      data: new FormData(),
      method: "post",
      action: "/prep"
    } as ReturnType<typeof useFormStatus>);

    render(<InterviewContextSubmitButton />);

    const button = screen.getByRole("button", { name: "正在保存并重新生成..." }) as HTMLButtonElement;
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.disabled).toBe(true);
  });
});
