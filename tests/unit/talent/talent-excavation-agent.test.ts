import { describe, expect, it, vi } from "vitest";
import {
  finalizeTalentExcavation,
  generateTalentExcavationQuestion
} from "@/lib/services/talent/talent-excavation-agent";

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON: vi.fn()
}));

describe("talent excavation agent", () => {
  it("asks the next deep question with model output", async () => {
    const { callModelJSON } = await import("@/lib/ai/model-gateway");
    vi.mocked(callModelJSON).mockResolvedValueOnce({
      provider: "openai_compatible",
      generationMode: "model",
      data: {
        reflection: "这里已经出现了早期线索。",
        question: "成年后哪件事让你觉得显而易见，但别人觉得很难？",
        requiredAnchor: "unconscious_competence",
        canFinalize: false
      }
    });

    const result = await generateTalentExcavationQuestion({
      turns: [
        {
          question: "16 岁以前会反复做什么？",
          answer: "我会反复整理复杂的信息，并追着问为什么。",
          requiredAnchor: "early_memory"
        }
      ]
    });

    expect(result.generationMode).toBe("model");
    expect(result.question).toContain("成年后");
    expect(result.requiredAnchor).toBe("unconscious_competence");
    expect(result.riskNotes).toBeUndefined();
  });

  it("does not pretend deterministic fallback is a deep AI question", async () => {
    const { callModelJSON } = await import("@/lib/ai/model-gateway");
    vi.mocked(callModelJSON).mockResolvedValueOnce({
      provider: "deterministic_fallback",
      generationMode: "deterministic_fallback",
      data: null,
      fallbackReason: "未检测到模型配置，已切换到确定性回退。"
    });

    const result = await generateTalentExcavationQuestion({
      turns: []
    });

    expect(result.generationMode).toBe("deterministic_fallback");
    expect(result.question).toContain("16 岁以前");
    expect(result.riskNotes?.join(" ")).toContain("未检测到模型配置");
    expect(result.riskNotes?.join(" ")).toContain("基础追问");
  });

  it("keeps a completed deep transcript usable when final manual model generation fails", async () => {
    const { callModelJSON } = await import("@/lib/ai/model-gateway");
    vi.mocked(callModelJSON).mockRejectedValueOnce(new Error("AGY CLI timeout"));

    const result = await finalizeTalentExcavation({
      turns: [
        {
          question: "早期线索是什么？",
          answer: "我从小就喜欢把混乱信息梳理清晰，找到事情背后的规律。",
          requiredAnchor: "early_memory"
        },
        {
          question: "什么事情别人觉得难？",
          answer: "别人觉得复杂的数据分析很难，但我会主动整理流程并推进落地。",
          requiredAnchor: "unconscious_competence"
        },
        {
          question: "什么事情让你回血？",
          answer: "分析复杂问题并把结论讲清楚会让我更兴奋。",
          requiredAnchor: "energy_audit"
        },
        {
          question: "你羡慕哪种状态？",
          answer: "我羡慕能用 AI 产品帮助别人提升效率的人。",
          requiredAnchor: "jealousy_signal"
        }
      ]
    });

    expect(result.type).toBe("final");
    expect(result.generationMode).toBe("deterministic_fallback");
    expect(result.talentManual).toContain("个人天赋使用说明书");
    expect(result.talentManual).toContain("梳理混乱的人");
    expect(result.riskNotes?.join(" ")).toContain("模型生成暂时失败");
    expect(result.riskNotes?.join(" ")).toContain("AGY CLI timeout");
  });
});
