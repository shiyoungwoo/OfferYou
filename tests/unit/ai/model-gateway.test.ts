import { beforeEach, describe, expect, it, vi } from "vitest";
import { callGemini } from "@/lib/ai/gemini-client";

vi.mock("@/lib/ai/gemini-client", () => ({
  callGemini: vi.fn(),
  callGeminiJSON: vi.fn()
}));

describe("model gateway", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.MIMO_API_KEY;
    delete process.env.MIMO_BASE_URL;
    delete process.env.MIMO_MODEL;
  });

  it("lists gemini, OpenAI compatible, and deterministic fallback providers", async () => {
    const { getAvailableModelProviders } = await import("@/lib/ai/model-gateway");

    const providers = getAvailableModelProviders();

    expect(providers).toEqual([
      {
        key: "gemini",
        label: "Gemini",
        available: false,
        default: false
      },
      {
        key: "openai_compatible",
        label: "OpenAI 兼容模式",
        available: false,
        default: false
      },
      {
        key: "deterministic_fallback",
        label: "Deterministic Fallback",
        available: true,
        default: true
      }
    ]);
  });

  it("returns deterministic fallback data when requested", async () => {
    const { callModelJSON, callModelText } = await import("@/lib/ai/model-gateway");

    const jsonResult = await callModelJSON({
      systemPrompt: "system",
      userPrompt: "user",
      provider: "deterministic_fallback",
      fallbackFactory: () => ({ ok: true })
    });

    const textResult = await callModelText({
      systemPrompt: "system",
      userPrompt: "user",
      provider: "deterministic_fallback",
      fallbackFactory: () => "fallback text"
    });

    expect(jsonResult.provider).toBe("deterministic_fallback");
    expect(jsonResult.data).toEqual({ ok: true });
    expect(jsonResult.fallbackReason).toContain("确定性回退");
    expect(textResult.provider).toBe("deterministic_fallback");
    expect(textResult.data).toBe("fallback text");
    expect(textResult.fallbackReason).toContain("确定性回退");
  });

  it("uses Gemini when an API key exists", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.mocked(callGemini)
      .mockResolvedValueOnce("{\"hello\":\"world\"}")
      .mockResolvedValueOnce("plain text");

    const { callModelJSON, callModelText, getAvailableModelProviders } = await import("@/lib/ai/model-gateway");

    expect(getAvailableModelProviders()[0]?.available).toBe(true);

    const jsonResult = await callModelJSON({
      systemPrompt: "system",
      userPrompt: "user",
      provider: "gemini"
    });
    const textResult = await callModelText({
      systemPrompt: "system",
      userPrompt: "user",
      provider: "gemini"
    });

    expect(jsonResult.provider).toBe("gemini");
    expect(jsonResult.data).toEqual({ hello: "world" });
    expect(textResult.provider).toBe("gemini");
    expect(textResult.data).toBe("plain text");
  });

  it("uses OpenAI compatible provider when configured", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.OPENAI_BASE_URL = "https://example.com/v1";
    process.env.OPENAI_MODEL = "gpt-4o-mini";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "{\"hello\":\"world\"}"
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "plain text response"
              }
            }
          ]
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const { callModelJSON, callModelText, getAvailableModelProviders } = await import("@/lib/ai/model-gateway");

    expect(getAvailableModelProviders().some((provider) => provider.key === "openai_compatible" && provider.available)).toBe(true);

    const jsonResult = await callModelJSON({
      systemPrompt: "system",
      userPrompt: "user"
    });
    const textResult = await callModelText({
      systemPrompt: "system",
      userPrompt: "user"
    });

    expect(jsonResult.provider).toBe("openai_compatible");
    expect(jsonResult.data).toEqual({ hello: "world" });
    expect(textResult.provider).toBe("openai_compatible");
    expect(textResult.data).toBe("plain text response");
  });

  it("returns a readable fallback reason when Gemini JSON parsing fails", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.mocked(callGemini)
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce("still not json");

    const { callModelJSON } = await import("@/lib/ai/model-gateway");

    const result = await callModelJSON({
      systemPrompt: "system",
      userPrompt: "user",
      provider: "gemini",
      fallbackFactory: () => ({ hello: "fallback" })
    });

    expect(result.provider).toBe("deterministic_fallback");
    expect(result.data).toEqual({ hello: "fallback" });
    expect(result.fallbackReason).toContain("无法解析为 JSON");
    expect(result.fallbackReason).toContain("确定性回退");
  });

  it("repairs invalid provider JSON once before falling back", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.mocked(callGemini)
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce("{\"hello\":\"repaired\"}");

    const { callModelJSON } = await import("@/lib/ai/model-gateway");

    const result = await callModelJSON({
      systemPrompt: "system",
      userPrompt: "user",
      provider: "gemini",
      fallbackFactory: () => ({ hello: "fallback" })
    });

    expect(result.provider).toBe("gemini");
    expect(result.generationMode).toBe("model_repaired");
    expect(result.data).toEqual({ hello: "repaired" });
    expect(result.trace?.generationMode).toBe("model_repaired");
  });

  it("returns a readable fallback reason when Gemini throws", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.mocked(callGemini).mockRejectedValue(new Error("text network down"));

    const { callModelJSON, callModelText } = await import("@/lib/ai/model-gateway");

    const jsonResult = await callModelJSON({
      systemPrompt: "system",
      userPrompt: "user",
      provider: "gemini",
      fallbackFactory: () => ({ hello: "fallback" })
    });
    const textResult = await callModelText({
      systemPrompt: "system",
      userPrompt: "user",
      provider: "gemini",
      fallbackFactory: () => "fallback text"
    });

    expect(jsonResult.provider).toBe("deterministic_fallback");
    expect(jsonResult.data).toEqual({ hello: "fallback" });
    expect(jsonResult.fallbackReason).toContain("Gemini 调用失败");
    expect(jsonResult.fallbackReason).not.toContain("network down");
    expect(textResult.provider).toBe("deterministic_fallback");
    expect(textResult.data).toBe("fallback text");
    expect(textResult.fallbackReason).toContain("Gemini 调用失败");
    expect(textResult.fallbackReason).not.toContain("text network down");
  });

  it("returns a readable fallback reason when Gemini auth expires", async () => {
    process.env.GEMINI_API_KEY = "expired-key";
    vi.mocked(callGemini).mockRejectedValue(new Error("API key expired. Please renew the API key."));

    const { callModelJSON } = await import("@/lib/ai/model-gateway");

    const result = await callModelJSON({
      systemPrompt: "system",
      userPrompt: "user",
      provider: "gemini",
      fallbackFactory: () => ({ hello: "fallback" })
    });

    expect(result.provider).toBe("deterministic_fallback");
    expect(result.fallbackReason).toContain("API 密钥可能已失效或未授权");
    expect(result.fallbackReason).not.toContain("expired-key");
  });
});
