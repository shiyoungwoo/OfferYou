import type { ModelTaskKey } from "@/lib/ai/model-task-config";
import { getAntigravityModelForTier } from "@/lib/ai/cli/antigravity-cli-client";
import { getCodexModelForTier } from "@/lib/ai/cli/codex-cli-client";

export type ModelReasoningTier = "simple" | "complex" | "vision";

export type OpenAICompatibleFlavor = "mimo" | "openai_codex" | "generic";

export type RoutedModelConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  flavor: OpenAICompatibleFlavor;
  tier: ModelReasoningTier;
  authMode: "api_key" | "oauth";
};

export type GeminiModelConfig = {
  apiKey: string;
  model: string;
  tier: ModelReasoningTier;
};

const COMPLEX_TASKS = new Set<ModelTaskKey>([
  "jd_analysis",
  "rewrite",
  "talent",
  "interview"
]);

const VISION_TASKS = new Set<ModelTaskKey>([
  "resume_calibration"
]);

export function getModelReasoningTierForTask(task?: ModelTaskKey): ModelReasoningTier {
  if (!task) {
    return "simple";
  }

  if (VISION_TASKS.has(task)) {
    return "vision";
  }

  return COMPLEX_TASKS.has(task) ? "complex" : "simple";
}

export function getDefaultMimoModelForTier(tier: ModelReasoningTier) {
  if (tier === "complex") {
    return "mimo-v2.5-pro";
  }

  return "mimo-v2.5";
}

export function getDefaultOpenAICodexModelForTier(tier: ModelReasoningTier) {
  if (tier === "complex") {
    return "gpt-5.5";
  }

  return "gpt-5.4-mini";
}

export function resolveOpenAICompatibleModelConfig(task?: ModelTaskKey): RoutedModelConfig | null {
  const tier = getModelReasoningTierForTask(task);
  const requestedFlavor = normalizeFlavor(process.env.OPENAI_COMPATIBLE_FLAVOR);

  if (requestedFlavor === "openai_codex") {
    return resolveOpenAICodexConfig(tier);
  }

  if (requestedFlavor === "generic") {
    return resolveGenericOpenAICompatibleConfig(tier);
  }

  return (
    resolveMimoConfig(tier) ??
    resolveOpenAICodexConfig(tier) ??
    resolveGenericOpenAICompatibleConfig(tier)
  );
}

export function hasResolvedOpenAICompatibleConfig() {
  return Boolean(resolveOpenAICompatibleModelConfig());
}

function resolveMimoConfig(tier: ModelReasoningTier): RoutedModelConfig | null {
  const apiKey = process.env.MIMO_API_KEY;
  const baseUrl = process.env.MIMO_BASE_URL;

  if (!apiKey || !baseUrl) {
    return null;
  }

  return {
    apiKey,
    baseUrl,
    model: getMimoModelForTier(tier),
    flavor: "mimo",
    tier,
    authMode: "api_key"
  };
}

function resolveOpenAICodexConfig(tier: ModelReasoningTier): RoutedModelConfig | null {
  const apiKey = process.env.OPENAI_CODEX_ACCESS_TOKEN;
  const baseUrl = process.env.OPENAI_CODEX_BASE_URL ?? "https://api.openai.com/v1";

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl,
    model: getOpenAICodexModelForTier(tier),
    flavor: "openai_codex",
    tier,
    authMode: "oauth"
  };
}

function resolveGenericOpenAICompatibleConfig(tier: ModelReasoningTier): RoutedModelConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey || !baseUrl || !model) {
    return null;
  }

  return {
    apiKey,
    baseUrl,
    model,
    flavor: "generic",
    tier,
    authMode: "api_key"
  };
}

function getMimoModelForTier(tier: ModelReasoningTier) {
  if (tier === "vision") {
    return process.env.MIMO_MODEL_VISION ?? "mimo-v2.5";
  }

  if (tier === "complex") {
    return process.env.MIMO_MODEL_COMPLEX ?? process.env.MIMO_MODEL ?? "mimo-v2.5-pro";
  }

  return process.env.MIMO_MODEL_SIMPLE ?? process.env.MIMO_MODEL ?? "mimo-v2.5";
}

function getOpenAICodexModelForTier(tier: ModelReasoningTier) {
  if (tier === "complex") {
    return process.env.OPENAI_CODEX_MODEL_COMPLEX ?? "gpt-5.5";
  }

  return process.env.OPENAI_CODEX_MODEL_SIMPLE ?? "gpt-5.4-mini";
}

function normalizeFlavor(value: string | undefined): OpenAICompatibleFlavor | undefined {
  if (value === "mimo" || value === "openai_codex" || value === "generic") {
    return value;
  }

  return undefined;
}

export function resolveGeminiModelConfig(task?: ModelTaskKey): GeminiModelConfig | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const tier = getModelReasoningTierForTask(task);

  return {
    apiKey,
    model: getGeminiModelForTier(tier),
    tier,
  };
}

export function hasResolvedGeminiConfig(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function resolveAntigravityCliModel(task?: ModelTaskKey): string {
  const tier = getModelReasoningTierForTask(task);
  return getAntigravityModelForTier(tier);
}

export function resolveCodexCliModel(task?: ModelTaskKey): string {
  const tier = getModelReasoningTierForTask(task);
  return getCodexModelForTier(tier === "vision" ? "simple" : tier);
}

function getGeminiModelForTier(tier: ModelReasoningTier): string {
  if (tier === "vision") {
    return process.env.GEMINI_MODEL_VISION ?? "gemini-3.5-flash";
  }

  if (tier === "complex") {
    return process.env.GEMINI_MODEL_COMPLEX ?? "gemini-3.1-pro";
  }

  return process.env.GEMINI_MODEL_SIMPLE ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
}
