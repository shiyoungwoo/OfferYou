import { afterEach, describe, expect, it, vi } from "vitest";
import { researchInterviewContext } from "@/lib/services/interview/interview-research-service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("interview-research-service", () => {
  it("uses the public Jina reader fallback without double-prefixing the URL", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
    vi.stubEnv("TAVILY_API_KEY", "");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      "[公司官网](https://example.com) 示例公司资料",
      { status: 200 }
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await researchInterviewContext({
      company: "示例公司",
      jobTitle: "AI 产品经理"
    });

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(requestedUrl).toContain("https://r.jina.ai/http://https://www.bing.com/search");
    expect(requestedUrl).not.toContain("r.jina.ai/http://r.jina.ai");
    expect(result.status).toBe("ready");
    expect(result.provider).toBe("jina_reader_bing");
  });

  it("returns a clear failure reason when no search key is configured and public search fails", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));

    const result = await researchInterviewContext({
      company: "深圳硅基万物科技有限公司",
      jobTitle: "AI 产品经理"
    });

    expect(result.status).toBe("failed");
    expect(result.provider).toBe("jina_reader_bing");
    expect(result.errorMessage).toContain("未配置 Brave/Tavily 搜索 Key");
    expect(result.errorMessage).toContain("fetch failed");
  });
});
