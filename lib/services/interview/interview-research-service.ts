import type { ApplicationRecord } from "@/lib/services/applications/application-record-service";

export type InterviewResearchResult = NonNullable<ApplicationRecord["interviewResearch"]>;

type SearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export async function researchInterviewContext(input: {
  company: string;
  jobTitle: string;
}): Promise<InterviewResearchResult> {
  const query = `${input.company} ${input.jobTitle} 面试 JD 岗位要求 公司 产品`;
  const researchedAt = new Date().toISOString();

  try {
    const hits = await searchWeb(query);
    if (hits.length === 0) {
      return {
        query,
        summary: "",
        sources: [],
        provider: "web_search",
        researchedAt,
        status: "failed",
        errorMessage: "没有检索到可用的公司或岗位资料。"
      };
    }

    return {
      query,
      summary: buildResearchSummary(input, hits),
      sources: hits.slice(0, 5),
      provider: getResearchProviderName(),
      researchedAt,
      status: "ready"
    };
  } catch (error) {
    return {
      query,
      summary: "",
      sources: [],
      provider: getResearchProviderName(),
      researchedAt,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "联网研究失败。"
    };
  }
}

async function searchWeb(query: string): Promise<SearchHit[]> {
  if (process.env.BRAVE_SEARCH_API_KEY) {
    return searchWithBrave(query);
  }

  if (process.env.TAVILY_API_KEY) {
    return searchWithTavily(query);
  }

  try {
    return await searchWithJinaReader(query);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知错误";
    throw new Error(`未配置 Brave/Tavily 搜索 Key，公开检索通道不可用：${reason}`);
  }
}

async function searchWithBrave(query: string): Promise<SearchHit[]> {
  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY ?? ""
    },
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) {
    throw new Error(`Brave 搜索失败：${response.status}`);
  }

  const data = await response.json() as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
      }>;
    };
  };

  return (data.web?.results ?? []).map((item) => ({
    title: cleanText(item.title ?? ""),
    url: item.url ?? "",
    snippet: cleanText(item.description ?? "")
  })).filter(isUsableHit);
}

async function searchWithTavily(query: string): Promise<SearchHit[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 5,
      search_depth: "basic"
    }),
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) {
    throw new Error(`Tavily 搜索失败：${response.status}`);
  }

  const data = await response.json() as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
    }>;
  };

  return (data.results ?? []).map((item) => ({
    title: cleanText(item.title ?? ""),
    url: item.url ?? "",
    snippet: cleanText(item.content ?? "")
  })).filter(isUsableHit);
}

async function searchWithJinaReader(query: string): Promise<SearchHit[]> {
  const target = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(`https://r.jina.ai/http://${target}`, {
    headers: {
      Accept: "text/plain"
    },
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) {
    throw new Error(`公开网页检索失败：${response.status}`);
  }

  const text = await response.text();
  const hits = parseMarkdownLikeSearchResults(text, target);
  return hits.slice(0, 5);
}

function parseMarkdownLikeSearchResults(text: string, fallbackUrl: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const linkPattern = /\[([^\]]{4,120})\]\((https?:\/\/[^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) && hits.length < 8) {
    const title = cleanText(match[1] ?? "");
    const url = match[2] ?? "";
    if (!title || url.includes("bing.com")) {
      continue;
    }

    const tail = text.slice(match.index + match[0].length, match.index + match[0].length + 240);
    hits.push({
      title,
      url,
      snippet: cleanText(tail.replace(/\[[^\]]+\]\([^)]+\)/g, " "))
    });
  }

  if (hits.length > 0) {
    return hits.filter(isUsableHit);
  }

  const fallbackSnippet = cleanText(text.slice(0, 1000));
  return fallbackSnippet
    ? [{ title: "公开网页检索结果", url: fallbackUrl, snippet: fallbackSnippet }]
    : [];
}

function buildResearchSummary(input: { company: string; jobTitle: string }, hits: SearchHit[]) {
  const sourceLines = hits.slice(0, 5).map((hit, index) =>
    `${index + 1}. ${hit.title}：${hit.snippet || hit.url}`
  );

  return [
    `目标公司：${input.company}`,
    `目标岗位：${input.jobTitle}`,
    "以下为联网检索得到的候选资料摘要，生成面试问题时只能基于这些资料、用户补充 JD 和已确认简历事实进行推理：",
    ...sourceLines
  ].join("\n");
}

function getResearchProviderName() {
  if (process.env.BRAVE_SEARCH_API_KEY) {
    return "brave_search";
  }

  if (process.env.TAVILY_API_KEY) {
    return "tavily";
  }

  return "jina_reader_bing";
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function isUsableHit(hit: SearchHit) {
  return Boolean(hit.title && hit.url && (hit.snippet || hit.url));
}
