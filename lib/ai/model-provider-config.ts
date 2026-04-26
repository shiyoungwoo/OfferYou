import type { ModelTaskKey } from "@/lib/ai/model-task-config";

export type ModelProviderKey = "gemini" | "openai_compatible" | "deterministic_fallback";

export type ModelProviderInfo = {
  key: ModelProviderKey;
  label: string;
  available: boolean;
  default: boolean;
};

export function hasGeminiApiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function hasOpenAICompatibleConfig() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL && process.env.OPENAI_MODEL);
}

export function getDefaultModelProvider(_task?: ModelTaskKey): ModelProviderKey {
  if (hasGeminiApiKey()) {
    return "gemini";
  }

  if (hasOpenAICompatibleConfig()) {
    return "openai_compatible";
  }

  return "deterministic_fallback";
}

export function getAvailableModelProviders(): ModelProviderInfo[] {
  const geminiAvailable = hasGeminiApiKey();
  const openAICompatibleAvailable = hasOpenAICompatibleConfig();
  const defaultProvider = getDefaultModelProvider();

  return [
    {
      key: "gemini",
      label: "Gemini",
      available: geminiAvailable,
      default: defaultProvider === "gemini"
    },
    {
      key: "openai_compatible",
      label: "OpenAI 兼容模式",
      available: openAICompatibleAvailable,
      default: defaultProvider === "openai_compatible"
    },
    {
      key: "deterministic_fallback",
      label: "Deterministic Fallback",
      available: true,
      default: defaultProvider === "deterministic_fallback"
    }
  ];
}
