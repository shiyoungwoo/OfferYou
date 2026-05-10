import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModelProviderStatusCard } from "@/components/me/model-provider-status-card";
import { SelfUseReadinessCard } from "@/components/me/self-use-readiness-card";

describe("me status cards", () => {
  it("renders model provider availability without leaking secrets", () => {
    render(
      <ModelProviderStatusCard
        providers={[
          {
            key: "gemini",
            label: "Gemini",
            configured: true,
            authenticated: true,
            callable: true,
            available: true,
            default: true
          },
          {
            key: "openai_compatible",
            label: "OpenAI 兼容模式",
            configured: false,
            authenticated: false,
            callable: false,
            available: false,
            default: false
          },
          {
            key: "deterministic_fallback",
            label: "Deterministic Fallback",
            configured: false,
            authenticated: false,
            callable: true,
            available: true,
            default: false
          }
        ]}
      />
    );

    expect(screen.getByText("模型状态")).toBeTruthy();
    expect(screen.getByText("Gemini")).toBeTruthy();
    expect(screen.getAllByText("OpenAI 兼容模式").length).toBeGreaterThan(0);
    expect(screen.getByText("Deterministic Fallback")).toBeTruthy();
    expect(screen.getAllByText("可用").length).toBeGreaterThan(0);
    expect(screen.getByText("未配置")).toBeTruthy();
    expect(screen.getByText("多模态模型")).toBeTruthy();
    expect(screen.getByText(/岗位匹配、简历改写、面试准备/)).toBeTruthy();
    expect(screen.getByText("确定性兜底")).toBeTruthy();
    expect(screen.queryByText(/GEMINI_API_KEY|OPENAI_API_KEY|OPENAI_BASE_URL|OPENAI_MODEL/)).toBeNull();
  });

  it("renders self-use readiness metrics", () => {
    render(
      <SelfUseReadinessCard
        applicationRecordCount={3}
        fixturePdfCount={4}
        hasFixtureReport={true}
        interviewPrepCount={2}
      />
    );

    expect(screen.getByText("自用试跑状态")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("已生成")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });
});
