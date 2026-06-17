import { beforeEach, describe, expect, it, vi } from "vitest";

describe("openai compatible client", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.MIMO_API_KEY;
    delete process.env.MIMO_BASE_URL;
    delete process.env.MIMO_MODEL;
  });

  it("treats the OpenAI compatible config as unavailable when env vars are missing", async () => {
    const { hasOpenAICompatibleConfig, getOpenAICompatibleConfig } = await import(
      "@/lib/ai/openai-compatible-client"
    );

    expect(hasOpenAICompatibleConfig()).toBe(false);
    expect(getOpenAICompatibleConfig()).toBeNull();
  });

  it("calls the chat completions endpoint with the configured base URL and model", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.OPENAI_BASE_URL = "https://example.com/v1";
    process.env.OPENAI_MODEL = "gpt-4o-mini";

    const fetchMock = vi.fn().mockResolvedValue({
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

    const { callOpenAICompatible } = await import("@/lib/ai/openai-compatible-client");

    const text = await callOpenAICompatible({
      systemPrompt: "system",
      userPrompt: "user"
    });

    expect(text).toBe("plain text response");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer openai-key"
        })
      })
    );
  });

  it("accepts Xiaomi MiMo env vars as the OpenAI-compatible provider", async () => {
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.MIMO_BASE_URL = "https://api.xiaomimimo.com/v1";
    process.env.MIMO_MODEL = "mimo-v2.5-pro";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "mimo response"
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callOpenAICompatible, getOpenAICompatibleConfig, hasOpenAICompatibleConfig } = await import(
      "@/lib/ai/openai-compatible-client"
    );

    expect(hasOpenAICompatibleConfig()).toBe(true);
    expect(getOpenAICompatibleConfig()).toMatchObject({
      apiKey: "mimo-key",
      baseUrl: "https://api.xiaomimimo.com/v1",
      model: "mimo-v2.5-pro",
      flavor: "mimo"
    });

    await expect(callOpenAICompatible({ systemPrompt: "system", userPrompt: "user" })).resolves.toBe("mimo response");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.xiaomimimo.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mimo-key"
        })
      })
    );
  });

  it("selects MiMo v2.5 for simple tasks and v2.5-pro for complex tasks", async () => {
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "ok"
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callOpenAICompatible } = await import("@/lib/ai/openai-compatible-client");

    await callOpenAICompatible({
      systemPrompt: "system",
      userPrompt: "user",
      task: "gap_analysis"
    });
    await callOpenAICompatible({
      systemPrompt: "system",
      userPrompt: "user",
      task: "rewrite"
    });

    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("\"model\":\"mimo-v2.5\"");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain("\"model\":\"mimo-v2.5-pro\"");
  });

  it("uses MiMo v2.5 for resume calibration vision tasks", async () => {
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
    process.env.MIMO_MODEL_COMPLEX = "mimo-v2.5-pro";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "ok"
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callOpenAICompatible } = await import("@/lib/ai/openai-compatible-client");

    await callOpenAICompatible({
      systemPrompt: "system",
      userPrompt: "user",
      task: "resume_calibration"
    });

    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("\"model\":\"mimo-v2.5\"");
    expect(fetchMock.mock.calls[0]?.[1]?.body).not.toContain("\"model\":\"mimo-v2.5-pro\"");
  });

  it("parses JSON mode responses and returns null for invalid JSON", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.OPENAI_BASE_URL = "https://example.com/v1";
    process.env.OPENAI_MODEL = "gpt-4o-mini";

    const fetchMock = vi.fn().mockResolvedValue({
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
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callOpenAICompatibleJSON } = await import("@/lib/ai/openai-compatible-client");

    const parsed = await callOpenAICompatibleJSON<{ hello: string }>({
      systemPrompt: "system",
      userPrompt: "user"
    });

    expect(parsed).toEqual({ hello: "world" });
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: expect.stringContaining("\"response_format\":{\"type\":\"json_object\"}")
      })
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "not-json"
            }
          }
        ]
      })
    });

    const invalid = await callOpenAICompatibleJSON({
      systemPrompt: "system",
      userPrompt: "user"
    });

    expect(invalid).toBeNull();
  });

  it("parses Xiaomi-style fenced JSON responses", async () => {
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
    process.env.MIMO_MODEL = "mimo-v2.5-pro";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "```json\n{\"ok\":true,\"provider\":\"mimo\"}\n```"
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callOpenAICompatibleJSON } = await import("@/lib/ai/openai-compatible-client");

    await expect(
      callOpenAICompatibleJSON<{ ok: boolean; provider: string }>({
        systemPrompt: "system",
        userPrompt: "user"
      })
    ).resolves.toEqual({ ok: true, provider: "mimo" });
  });

  it("parses the first JSON object when the model adds trailing explanation", async () => {
    process.env.MIMO_API_KEY = "mimo-key";
    process.env.MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
    process.env.MIMO_MODEL = "mimo-v2.5-pro";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                "```json",
                "{\"ok\":true,\"items\":[{\"title\":\"OfferYou\",\"note\":\"保留 { 括号 } 文本\"}]}",
                "```",
                "以上 JSON 可直接使用。"
              ].join("\n")
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { callOpenAICompatibleJSON } = await import("@/lib/ai/openai-compatible-client");

    await expect(
      callOpenAICompatibleJSON<{ ok: boolean; items: Array<{ title: string }> }>({
        systemPrompt: "system",
        userPrompt: "user"
      })
    ).resolves.toEqual({
      ok: true,
      items: [{ title: "OfferYou", note: "保留 { 括号 } 文本" }]
    });
  });
});
