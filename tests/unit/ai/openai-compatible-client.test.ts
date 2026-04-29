import { beforeEach, describe, expect, it, vi } from "vitest";

describe("openai compatible client", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
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
});
