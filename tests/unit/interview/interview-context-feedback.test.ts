import { describe, expect, it } from "vitest";
import { getInterviewContextSavedMessage } from "@/lib/services/interview/interview-context-feedback";

describe("getInterviewContextSavedMessage", () => {
  it("explains that saved context regenerated AI interview prep", () => {
    expect(getInterviewContextSavedMessage("model")).toBe(
      "岗位资料已保存，并已基于当前资料重新生成 AI 面试准备。"
    );
  });

  it("does not describe fallback prep as AI generation", () => {
    expect(getInterviewContextSavedMessage("deterministic_fallback")).toBe(
      "岗位资料已保存；当前仍是基础准备版，请补充 JD、公司资料或检查模型配置后再生成深度问题。"
    );
  });
});
