import { callGemini } from "@/lib/ai/gemini-client";
import { callOpenAICompatible, hasOpenAICompatibleConfig } from "@/lib/ai/openai-compatible-client";
import {
  getAvailableModelProviders as getConfiguredModelProviders,
  getDefaultModelProvider,
  hasGeminiApiKey,
  getModelProviderCapability,
  type ModelProviderKey
} from "@/lib/ai/model-provider-config";
import type { ModelTaskKey } from "@/lib/ai/model-task-config";
import type { GenerationMode, ModelProviderTrace } from "@/lib/services/job-apply/agent-run";

export type ModelCallTextOptions = {
  systemPrompt: string;
  userPrompt: string;
  provider?: ModelProviderKey;
  fallbackFactory?: () => string;
  task?: ModelTaskKey;
};

export type ModelCallJsonOptions<T> = {
  systemPrompt: string;
  userPrompt: string;
  provider?: ModelProviderKey;
  fallbackFactory?: () => T | null;
  task?: ModelTaskKey;
};

export type ModelCallResult<T> = {
  provider: ModelProviderKey;
  data: T | null;
  generationMode?: GenerationMode;
  trace?: ModelProviderTrace;
  fallbackReason?: string;
};

export function getAvailableModelProviders() {
  return getConfiguredModelProviders();
}

export async function callModelText(options: ModelCallTextOptions): Promise<ModelCallResult<string>> {
  const provider = options.provider ?? getDefaultModelProvider(options.task);
  const startedAt = Date.now();
  const geminiAvailable = hasGeminiApiKey();
  const openAICompatibleAvailable = hasOpenAICompatibleConfig();

  if (provider === "deterministic_fallback" || (!geminiAvailable && provider === "gemini") || (!openAICompatibleAvailable && provider === "openai_compatible")) {
    const fallbackReason = getUnavailableProviderReason(provider, geminiAvailable, openAICompatibleAvailable);
    return {
      provider: "deterministic_fallback",
      data: options.fallbackFactory ? options.fallbackFactory() : null,
      generationMode: "deterministic_fallback",
      trace: buildProviderTrace({
        provider: "deterministic_fallback",
        task: options.task,
        startedAt,
        generationMode: "deterministic_fallback",
        fallbackReason
      }),
      fallbackReason
    };
  }

  try {
    const data = await callProviderText(provider, {
      systemPrompt: options.systemPrompt,
      userPrompt: options.userPrompt
    });

    return {
      provider,
      data,
      generationMode: "model",
      trace: buildProviderTrace({
        provider,
        task: options.task,
        startedAt,
        generationMode: "model"
      })
    };
  } catch (error) {
    const fallbackReason = formatModelFailureReason(provider, error);
    return {
      provider: "deterministic_fallback",
      data: options.fallbackFactory ? options.fallbackFactory() : null,
      generationMode: "deterministic_fallback",
      trace: buildProviderTrace({
        provider: "deterministic_fallback",
        task: options.task,
        startedAt,
        generationMode: "deterministic_fallback",
        fallbackReason
      }),
      fallbackReason
    };
  }
}

export async function callModelJSON<T>(options: ModelCallJsonOptions<T>): Promise<ModelCallResult<T>> {
  const provider = options.provider ?? getDefaultModelProvider(options.task);
  const startedAt = Date.now();
  const geminiAvailable = hasGeminiApiKey();
  const openAICompatibleAvailable = hasOpenAICompatibleConfig();

  if (provider === "deterministic_fallback" || (!geminiAvailable && provider === "gemini") || (!openAICompatibleAvailable && provider === "openai_compatible")) {
    const fallbackReason = getUnavailableProviderReason(provider, geminiAvailable, openAICompatibleAvailable);
    return {
      provider: "deterministic_fallback",
      data: options.fallbackFactory ? options.fallbackFactory() : null,
      generationMode: "deterministic_fallback",
      trace: buildProviderTrace({
        provider: "deterministic_fallback",
        task: options.task,
        startedAt,
        generationMode: "deterministic_fallback",
        fallbackReason
      }),
      fallbackReason
    };
  }

  try {
    const rawText = await callProviderText(provider, {
      systemPrompt: options.systemPrompt,
      userPrompt: options.userPrompt,
      jsonMode: true
    });
    const parsed = parseLooseJSON<T>(rawText);

    if (parsed.ok) {
      return {
        provider,
        data: parsed.value,
        generationMode: "model",
        trace: buildProviderTrace({
          provider,
          task: options.task,
          startedAt,
          generationMode: "model"
        })
      };
    }

    const repaired = await repairProviderJSON<T>(provider, rawText, options);
    if (repaired.ok) {
      return {
        provider,
        data: repaired.value,
        generationMode: "model_repaired",
        trace: buildProviderTrace({
          provider,
          task: options.task,
          startedAt,
          generationMode: "model_repaired"
        })
      };
    }

    const fallbackReason = getJsonParseFallbackReason(provider);
    return {
      provider: "deterministic_fallback",
      data: options.fallbackFactory ? options.fallbackFactory() : null,
      generationMode: "deterministic_fallback",
      trace: buildProviderTrace({
        provider: "deterministic_fallback",
        task: options.task,
        startedAt,
        generationMode: "deterministic_fallback",
        fallbackReason
      }),
      fallbackReason
    };
  } catch (error) {
    const fallbackReason = formatModelFailureReason(provider, error);
    return {
      provider: "deterministic_fallback",
      data: options.fallbackFactory ? options.fallbackFactory() : null,
      generationMode: "deterministic_fallback",
      trace: buildProviderTrace({
        provider: "deterministic_fallback",
        task: options.task,
        startedAt,
        generationMode: "deterministic_fallback",
        fallbackReason
      }),
      fallbackReason
    };
  }
}

async function callProviderText(
  provider: Exclude<ModelProviderKey, "deterministic_fallback">,
  options: {
    systemPrompt: string;
    userPrompt: string;
    jsonMode?: boolean;
  }
) {
  if (provider === "openai_compatible") {
    return callOpenAICompatible(options);
  }

  return callGemini(options);
}

async function repairProviderJSON<T>(
  provider: Exclude<ModelProviderKey, "deterministic_fallback">,
  rawText: string,
  options: ModelCallJsonOptions<T>
): Promise<{ ok: true; value: T } | { ok: false }> {
  const repairedText = await callProviderText(provider, {
    systemPrompt: "你是 JSON 修复器。只返回合法 JSON，不要解释，不要输出 Markdown。",
    userPrompt: [
      "下面是一次模型输出，内容不是合法 JSON。",
      "请在不新增事实、不改变字段含义的前提下，修复为合法 JSON。",
      "原始系统要求：",
      options.systemPrompt,
      "原始用户要求：",
      options.userPrompt,
      "待修复内容：",
      rawText
    ].join("\n\n"),
    jsonMode: true
  });

  return parseLooseJSON<T>(repairedText);
}

function parseLooseJSON<T>(text: string): { ok: true; value: T } | { ok: false } {
  const jsonText = extractFirstJsonValue(stripMarkdown(text));
  if (!jsonText) {
    return { ok: false };
  }

  try {
    return { ok: true, value: JSON.parse(jsonText) as T };
  } catch {
    return { ok: false };
  }
}

function stripMarkdown(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const fencedLoose = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/iu);
  return fencedLoose?.[1]?.trim() ?? trimmed;
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

function buildProviderTrace(input: {
  provider: ModelProviderKey;
  task?: ModelTaskKey;
  startedAt: number;
  generationMode: GenerationMode;
  fallbackReason?: string;
}): ModelProviderTrace {
  return {
    provider: input.provider,
    model: getConfiguredModelName(input.provider),
    task: input.task,
    generationMode: input.generationMode,
    latencyMs: Math.max(0, Date.now() - input.startedAt),
    fallbackReason: input.fallbackReason
  };
}

function getConfiguredModelName(provider: ModelProviderKey) {
  if (provider === "gemini") {
    return process.env.GEMINI_MODEL || "gemini-1.5-flash";
  }

  if (provider === "openai_compatible") {
    return process.env.OPENAI_MODEL ?? process.env.MIMO_MODEL ?? "";
  }

  return "deterministic_fallback";
}

function getUnavailableProviderReason(
  provider: ModelProviderKey,
  geminiAvailable: boolean,
  openAICompatibleAvailable: boolean
) {
  if (provider === "gemini" && !geminiAvailable) {
    return "未检测到 `GEMINI_API_KEY`，已切换到确定性回退。";
  }

  if (provider === "openai_compatible" && !openAICompatibleAvailable) {
    return "未检测到小米 MiMo / OpenAI 兼容配置，已切换到确定性回退。";
  }

  if (provider === "deterministic_fallback") {
    return "已按配置使用确定性回退，不调用外部模型。";
  }

  return "已切换到确定性回退。";
}

function getJsonParseFallbackReason(provider: ModelProviderKey) {
  if (provider === "openai_compatible") {
    return `${getProviderDisplayName(provider)} 返回内容无法解析为 JSON，已切换到确定性回退。`;
  }

  return "Gemini 返回内容无法解析为 JSON，已切换到确定性回退。";
}

function formatModelFailureReason(provider: ModelProviderKey, error: unknown) {
  const detail = summarizeModelError(error);

  if (provider === "openai_compatible") {
    return detail
      ? `${getProviderDisplayName(provider)} 调用失败，已切换到确定性回退。${detail}`
      : `${getProviderDisplayName(provider)} 调用失败，已切换到确定性回退。请稍后重试。`;
  }

  return detail
    ? `Gemini 调用失败，已切换到确定性回退。${detail}`
    : "Gemini 调用失败，已切换到确定性回退。请稍后重试。";
}

function getProviderDisplayName(provider: ModelProviderKey) {
  return getModelProviderCapability(provider).title;
}

function summarizeModelError(error: unknown) {
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();

    if (normalized.includes("expired") || normalized.includes("api key") || normalized.includes("unauthorized") || normalized.includes("forbidden") || normalized.includes("401") || normalized.includes("403")) {
      return "API 密钥可能已失效或未授权。";
    }

    if (normalized.includes("timeout")) {
      return "请求超时。";
    }

    if (normalized.includes("network")) {
      return "网络请求失败。";
    }

    if (normalized.includes("json")) {
      return "返回内容格式异常。";
    }

    if (normalized.includes("rate")) {
      return "调用频率受限。";
    }
  }

  return "";
}
