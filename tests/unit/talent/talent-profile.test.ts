import { describe, expect, it, vi } from "vitest";
import { buildTalentProfile } from "@/lib/services/talent/talent-profile";
import { buildTalentProfileWithModel } from "@/lib/services/talent/talent-profile-model";

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON: vi.fn()
}));

describe("buildTalentProfile", () => {
  it("derives strength signals and role directions from lived-experience answers", () => {
    const profile = buildTalentProfile({
      proudMoment:
        "I led a messy client onboarding, clarified the workflow, and organized the team around a plan the customer trusted.",
      trustedProblem:
        "People rely on me when cross-team work is confusing because I can listen, coordinate, and turn ambiguity into clear next steps.",
      energyPattern:
        "I gain energy from solving complex problems with people and owning the path forward."
    });

    expect(profile.signals.map((signal) => signal.key)).toEqual(
      expect.arrayContaining(["clarity_builder", "relationship_driver", "cross_functional_translator", "ownership_runner"])
    );
    expect(profile.suitableDirections).toEqual(
      expect.arrayContaining(["客户成功、客户关系与服务推进类方向", "运营、项目推进与交付类方向"])
    );
    expect(profile.confidenceNote).toMatch(/中等/);
  });

  it("stays cautious when the evidence base is thin", () => {
    const profile = buildTalentProfile({
      proudMoment: "I did okay.",
      trustedProblem: "People ask me for help.",
      energyPattern: "Quiet work."
    });

    expect(profile.signals).toHaveLength(0);
    expect(profile.cautionNotes.join(" ")).toMatch(/证据还不够多/);
    expect(profile.confidenceNote).toMatch(/早期/);
  });

  it("generates talent profile with model output when available", async () => {
    const { callModelJSON } = await import("@/lib/ai/model-gateway");
    vi.mocked(callModelJSON).mockResolvedValueOnce({
      provider: "openai_compatible",
      data: {
        headline: "你最容易发光的状态，是作为「结构化梳理者」。",
        summary: "模型生成的天赋画像。",
        signals: [
          { key: "clarity_builder", label: "结构化梳理者", description: "能把混乱信息理清。", evidence: ["梳理了复杂流程"] }
        ],
        workStyle: ["需要自主空间"],
        suitableDirections: ["运营、项目推进类方向"],
        cautionNotes: ["继续保持验证"],
        confidenceNote: "当前可信度为中等。",
        talentManual: "这是一份模型生成的个人天赋使用说明书。"
      },
      generationMode: "model"
    });

    const result = await buildTalentProfileWithModel({
      proudMoment: "I led a messy workflow recovery and clarified the next steps."
    });

    expect(result.profile.headline).toContain("结构化梳理者");
    expect(result.profile.signals).toHaveLength(1);
    expect(result.profile.talentManual).toContain("天赋使用说明书");
    expect(result.generationMode).toBe("model");
    expect(result.modelProvider).toBe("openai_compatible");
    expect(result.riskNotes).toBeUndefined();
  });

  it("propagates model error for caller to handle fallback", async () => {
    const { callModelJSON } = await import("@/lib/ai/model-gateway");
    vi.mocked(callModelJSON).mockRejectedValueOnce(new Error("Model timeout"));

    await expect(
      buildTalentProfileWithModel({ proudMoment: "Some answer." })
    ).rejects.toThrow("Model timeout");
  });
});
