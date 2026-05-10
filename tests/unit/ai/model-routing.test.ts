import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getDefaultMimoModelForTier,
  getDefaultOpenAICodexModelForTier,
  getModelReasoningTierForTask,
  resolveOpenAICompatibleModelConfig
} from "@/lib/ai/model-routing";

describe("model-routing", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.MIMO_API_KEY;
    delete process.env.MIMO_BASE_URL;
    delete process.env.MIMO_MODEL;
    delete process.env.MIMO_MODEL_SIMPLE;
    delete process.env.MIMO_MODEL_COMPLEX;
    delete process.env.MIMO_MODEL_VISION;
    delete process.env.OPENAI_CODEX_ACCESS_TOKEN;
    delete process.env.OPENAI_CODEX_BASE_URL;
    delete process.env.OPENAI_CODEX_MODEL_SIMPLE;
    delete process.env.OPENAI_CODEX_MODEL_COMPLEX;
    delete process.env.OPENAI_COMPATIBLE_FLAVOR;
  });

  it("routes complex OfferYou tasks to stronger models", () => {
    expect(getModelReasoningTierForTask("jd_analysis")).toBe("complex");
    expect(getModelReasoningTierForTask("rewrite")).toBe("complex");
    expect(getModelReasoningTierForTask("interview")).toBe("complex");
    expect(getModelReasoningTierForTask("gap_analysis")).toBe("simple");
  });

  it("defaults MiMo simple tasks to v2.5 and complex tasks to v2.5-pro", () => {
    expect(getDefaultMimoModelForTier("simple")).toBe("mimo-v2.5");
    expect(getDefaultMimoModelForTier("complex")).toBe("mimo-v2.5-pro");
  });

  it("defaults OpenAI Codex OAuth simple and complex model aliases", () => {
    expect(getDefaultOpenAICodexModelForTier("simple")).toBe("gpt-5.4-mini");
    expect(getDefaultOpenAICodexModelForTier("complex")).toBe("gpt-5.5");
  });

  it("resolves MiMo model per task without requiring a legacy MIMO_MODEL", () => {
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";

    expect(resolveOpenAICompatibleModelConfig("gap_analysis")).toMatchObject({
      flavor: "mimo",
      model: "mimo-v2.5",
      tier: "simple"
    });
    expect(resolveOpenAICompatibleModelConfig("rewrite")).toMatchObject({
      flavor: "mimo",
      model: "mimo-v2.5-pro",
      tier: "complex"
    });
  });

  it("can prefer OpenAI Codex OAuth when explicitly requested", () => {
    process.env.OPENAI_COMPATIBLE_FLAVOR = "openai_codex";
    process.env.OPENAI_CODEX_ACCESS_TOKEN = "oauth-token";

    expect(resolveOpenAICompatibleModelConfig("gap_analysis")).toMatchObject({
      authMode: "oauth",
      flavor: "openai_codex",
      model: "gpt-5.4-mini"
    });
    expect(resolveOpenAICompatibleModelConfig("jd_analysis")).toMatchObject({
      authMode: "oauth",
      flavor: "openai_codex",
      model: "gpt-5.5"
    });
  });
});
