import { callGemini, callGeminiJSON } from "@/lib/ai/gemini-client";
import { callOpenAICompatible, callOpenAICompatibleJSON, hasOpenAICompatibleConfig } from "@/lib/ai/openai-compatible-client";
import {
  getAvailableModelProviders as getConfiguredModelProviders,
  getDefaultModelProvider,
  hasGeminiApiKey,
  type ModelProviderKey
} from "@/lib/ai/model-provider-config";
import type { ModelTaskKey } from "@/lib/ai/model-task-config";

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
  fallbackReason?: string;
};

export function getAvailableModelProviders() {
  return getConfiguredModelProviders();
}

export async function callModelText(options: ModelCallTextOptions): Promise<ModelCallResult<string>> {
  const provider = options.provider ?? getDefaultModelProvider(options.task);
  const geminiAvailable = hasGeminiApiKey();
  const openAICompatibleAvailable = hasOpenAICompatibleConfig();

  if (provider === "deterministic_fallback" || (!geminiAvailable && provider === "gemini") || (!openAICompatibleAvailable && provider === "openai_compatible")) {
    return {
      provider: "deterministic_fallback",
      data: options.fallbackFactory ? options.fallbackFactory() : null,
      fallbackReason: getUnavailableProviderReason(provider, geminiAvailable, openAICompatibleAvailable)
    };
  }

  try {
    const data =
      provider === "openai_compatible"
        ? await callOpenAICompatible({
            systemPrompt: options.systemPrompt,
            userPrompt: options.userPrompt
          })
        : await callGemini({
            systemPrompt: options.systemPrompt,
            userPrompt: options.userPrompt
          });

    return { provider, data };
  } catch (error) {
    return {
      provider: "deterministic_fallback",
      data: options.fallbackFactory ? options.fallbackFactory() : null,
      fallbackReason: formatModelFailureReason(provider, error)
    };
  }
}

export async function callModelJSON<T>(options: ModelCallJsonOptions<T>): Promise<ModelCallResult<T>> {
  const provider = options.provider ?? getDefaultModelProvider(options.task);
  const geminiAvailable = hasGeminiApiKey();
  const openAICompatibleAvailable = hasOpenAICompatibleConfig();

  if (provider === "deterministic_fallback" || (!geminiAvailable && provider === "gemini") || (!openAICompatibleAvailable && provider === "openai_compatible")) {
    return {
      provider: "deterministic_fallback",
      data: options.fallbackFactory ? options.fallbackFactory() : null,
      fallbackReason: getUnavailableProviderReason(provider, geminiAvailable, openAICompatibleAvailable)
    };
  }

  try {
    const data =
      provider === "openai_compatible"
        ? await callOpenAICompatibleJSON<T>({
            systemPrompt: options.systemPrompt,
            userPrompt: options.userPrompt
          })
        : await callGeminiJSON<T>({
            systemPrompt: options.systemPrompt,
            userPrompt: options.userPrompt
          });

    if (!data) {
      return {
        provider: "deterministic_fallback",
        data: options.fallbackFactory ? options.fallbackFactory() : null,
        fallbackReason: getJsonParseFallbackReason(provider)
      };
    }

    return { provider, data };
  } catch (error) {
    return {
      provider: "deterministic_fallback",
      data: options.fallbackFactory ? options.fallbackFactory() : null,
      fallbackReason: formatModelFailureReason(provider, error)
    };
  }
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
    return "未检测到 OpenAI 兼容配置，已切换到确定性回退。";
  }

  if (provider === "deterministic_fallback") {
    return "已按配置使用确定性回退，不调用外部模型。";
  }

  return "已切换到确定性回退。";
}

function getJsonParseFallbackReason(provider: ModelProviderKey) {
  if (provider === "openai_compatible") {
    return "OpenAI 兼容接口返回内容无法解析为 JSON，已切换到确定性回退。";
  }

  return "Gemini 返回内容无法解析为 JSON，已切换到确定性回退。";
}

function formatModelFailureReason(provider: ModelProviderKey, error: unknown) {
  const detail = summarizeModelError(error);

  if (provider === "openai_compatible") {
    return detail
      ? `OpenAI 兼容调用失败，已切换到确定性回退。${detail}`
      : "OpenAI 兼容调用失败，已切换到确定性回退。请稍后重试。";
  }

  return detail
    ? `Gemini 调用失败，已切换到确定性回退。${detail}`
    : "Gemini 调用失败，已切换到确定性回退。请稍后重试。";
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
