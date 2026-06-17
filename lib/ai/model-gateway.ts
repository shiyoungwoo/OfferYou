import { callGemini } from "@/lib/ai/gemini-client";
import { callOpenAICompatible, hasOpenAICompatibleConfig } from "@/lib/ai/openai-compatible-client";
import { callAntigravityCli } from "@/lib/ai/cli/antigravity-cli-client";
import { callCodexCli } from "@/lib/ai/cli/codex-cli-client";
import { getModelReasoningTierForTask, resolveGeminiModelConfig, resolveOpenAICompatibleModelConfig } from "@/lib/ai/model-routing";
import { extractFirstJsonValue, parseLooseJSON as parseLooseJSONRaw, stripMarkdown } from "@/lib/ai/json-parser";
import {
  getAvailableModelProviders as getConfiguredModelProviders,
  getDefaultModelProvider,
  hasGeminiApiKey,
  getModelProviderAvailability,
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

export type ModelProviderRuntimeStatus = {
  provider: ModelProviderKey;
  label: string;
  configured: boolean;
  authenticated: boolean;
  callable: boolean;
  default: boolean;
  fallbackReason?: string;
};

export function getAvailableModelProviders() {
  return getConfiguredModelProviders();
}

export function getModelProviderRuntimeStatus(provider: ModelProviderKey): ModelProviderRuntimeStatus {
  const defaultProvider = getDefaultModelProvider();

  if (provider === "deterministic_fallback") {
    return {
      provider,
      label: getProviderDisplayName(provider),
      configured: false,
      authenticated: false,
      callable: true,
      default: defaultProvider === provider
    };
  }

  const configuredProvider = getModelProviderAvailability(provider);
  const fallbackReason = configuredProvider.callable
    ? undefined
    : getUnavailableProviderReason(provider, provider === "gemini" ? hasGeminiApiKey() : false, provider === "openai_compatible" ? hasOpenAICompatibleConfig() : false);

  return {
    provider,
    label: getProviderDisplayName(provider),
    configured: Boolean(configuredProvider?.configured),
    authenticated: Boolean(configuredProvider?.authenticated),
    callable: Boolean(configuredProvider?.callable),
    default: defaultProvider === provider,
    fallbackReason
  };
}

export async function callModelText(options: ModelCallTextOptions): Promise<ModelCallResult<string>> {
  const provider = options.provider ?? getDefaultModelProvider(options.task);
  const startedAt = Date.now();
  if (provider === "deterministic_fallback") {
    const fallbackReason = getUnavailableProviderReason(provider, false, false);
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

  const runtimeStatus = getModelProviderRuntimeStatus(provider);

  if (!runtimeStatus.callable) {
    const fallbackReason = runtimeStatus.fallbackReason ?? "已切换到确定性回退。";
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
      userPrompt: options.userPrompt,
      task: options.task
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
  if (provider === "deterministic_fallback") {
    const fallbackReason = getUnavailableProviderReason(provider, false, false);
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

  const runtimeStatus = getModelProviderRuntimeStatus(provider);

  if (!runtimeStatus.callable) {
    const fallbackReason = runtimeStatus.fallbackReason ?? "已切换到确定性回退。";
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
      task: options.task,
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
    task?: ModelTaskKey;
    jsonMode?: boolean;
  }
) {
  if (provider === "openai_compatible") {
    return callOpenAICompatible(options);
  }

  if (provider === "antigravity_cli") {
    return callAntigravityCli({
      systemPrompt: options.systemPrompt,
      userPrompt: options.userPrompt,
      jsonMode: options.jsonMode,
    });
  }

  if (provider === "codex_cli") {
    return callCodexCli({
      systemPrompt: options.systemPrompt,
      userPrompt: options.userPrompt,
      jsonMode: options.jsonMode,
    });
  }

  return callGemini({
    ...options,
    tier: getModelReasoningTierForTask(options.task),
  });
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
    task: options.task,
    jsonMode: true
  });

  return parseLooseJSON<T>(repairedText);
}

function parseLooseJSON<T>(text: string): { ok: true; value: T } | { ok: false } {
  try {
    const value = parseLooseJSONRaw<T>(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
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
    model: getConfiguredModelName(input.provider, input.task),
    task: input.task,
    generationMode: input.generationMode,
    latencyMs: Math.max(0, Date.now() - input.startedAt),
    fallbackReason: input.fallbackReason
  };
}

function getConfiguredModelName(provider: ModelProviderKey, task?: ModelTaskKey) {
  if (provider === "gemini") {
    return resolveGeminiModelConfig(task)?.model ?? "gemini-2.5-flash";
  }

  if (provider === "openai_compatible") {
    return resolveOpenAICompatibleModelConfig(task)?.model ?? "";
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
  const label = getProviderDisplayName(provider);

  if (provider === "openai_compatible" || provider === "antigravity_cli" || provider === "codex_cli") {
    return detail
      ? `${label} 调用失败，已切换到确定性回退。${detail}`
      : `${label} 调用失败，已切换到确定性回退。请稍后重试。`;
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
