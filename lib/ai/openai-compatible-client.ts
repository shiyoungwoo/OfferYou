import type { ModelTaskKey } from "@/lib/ai/model-task-config";
import { parseLooseJSON } from "@/lib/ai/json-parser";
import { hasResolvedOpenAICompatibleConfig, resolveOpenAICompatibleModelConfig } from "@/lib/ai/model-routing";

export type OpenAICompatibleCallOptions = {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  task?: ModelTaskKey;
};

export type OpenAICompatibleConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  flavor?: string;
  tier?: string;
  authMode?: "api_key" | "oauth";
};

export function hasOpenAICompatibleConfig() {
  return hasResolvedOpenAICompatibleConfig();
}

export function getOpenAICompatibleConfig(task?: ModelTaskKey): OpenAICompatibleConfig | null {
  return resolveOpenAICompatibleModelConfig(task);
}

export async function callOpenAICompatible(options: OpenAICompatibleCallOptions): Promise<string> {
  const config = getOpenAICompatibleConfig(options.task);
  if (!config) {
    throw new Error("未检测到 OpenAI 兼容配置。");
  }

  const timeoutMs = Number(process.env.OFFERYOU_MODEL_TIMEOUT_MS) || 45_000;

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
    }),
    signal: AbortSignal.timeout(timeoutMs)
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

export async function callOpenAICompatibleJSON<T = unknown>(
  options: Omit<OpenAICompatibleCallOptions, "jsonMode">
): Promise<T | null> {
  try {
    const text = await callOpenAICompatible({ ...options, jsonMode: true });
    return parseLooseJSON<T>(text);
  } catch (error) {
    if (process.env.OFFERYOU_DEBUG_AI === "1") {
      console.error("[OpenAI Compatible JSON] Failed to parse response:", error);
    }
    return null;
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, "");
}
