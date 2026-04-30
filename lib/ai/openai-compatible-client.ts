export type OpenAICompatibleCallOptions = {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
};

export type OpenAICompatibleConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function hasOpenAICompatibleConfig() {
  return Boolean(
    (process.env.OPENAI_API_KEY || process.env.MIMO_API_KEY) &&
      (process.env.OPENAI_BASE_URL || process.env.MIMO_BASE_URL) &&
      (process.env.OPENAI_MODEL || process.env.MIMO_MODEL)
  );
}

export function getOpenAICompatibleConfig(): OpenAICompatibleConfig | null {
  if (!hasOpenAICompatibleConfig()) {
    return null;
  }

  return {
    apiKey: process.env.OPENAI_API_KEY ?? process.env.MIMO_API_KEY ?? "",
    baseUrl: process.env.OPENAI_BASE_URL ?? process.env.MIMO_BASE_URL ?? "",
    model: process.env.OPENAI_MODEL ?? process.env.MIMO_MODEL ?? ""
  };
}

export async function callOpenAICompatible(options: OpenAICompatibleCallOptions): Promise<string> {
  const config = getOpenAICompatibleConfig();
  if (!config) {
    throw new Error("未检测到 OpenAI 兼容配置。");
  }

  const response = await fetch(`${trimTrailingSlash(config.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userPrompt }
      ],
      temperature: 0.2,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI 兼容接口返回 ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";

  if (!content.trim()) {
    throw new Error("OpenAI 兼容接口未返回有效内容。");
  }

  return content;
}

function stripMarkdown(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const fencedLoose = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  if (fencedLoose?.[1]) {
    return extractFirstJsonValue(fencedLoose[1]) ?? fencedLoose[1].trim();
  }

  const jsonValue = extractFirstJsonValue(trimmed);
  if (jsonValue) return jsonValue;

  return trimmed;
}

function extractFirstJsonValue(text: string) {
  const source = text.trim();
  const start = source.search(/[\[{]/u);
  if (start === -1) return null;

  const open = source[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1).trim();
      }
    }
  }

  return null;
}

export async function callOpenAICompatibleJSON<T = unknown>(
  options: Omit<OpenAICompatibleCallOptions, "jsonMode">
): Promise<T | null> {
  try {
    const text = await callOpenAICompatible({ ...options, jsonMode: true });
    return JSON.parse(stripMarkdown(text)) as T;
  } catch (error) {
    console.error("[OpenAI Compatible JSON] Failed to parse response:", error);
    return null;
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, "");
}
