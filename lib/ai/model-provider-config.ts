import type { ModelTaskKey } from "@/lib/ai/model-task-config";

export type ModelProviderKey = "gemini" | "openai_compatible" | "deterministic_fallback";

export type ModelProviderCapabilityLevel = "text_only" | "vision_optional" | "fallback_only";

export type ModelProviderCapability = {
  level: ModelProviderCapabilityLevel;
  title: string;
  description: string;
  bestFor: string[];
  limitations: string[];
};

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
  if (_task === "resume_calibration") {
    if (hasOpenAICompatibleConfig()) return "openai_compatible";
    if (hasGeminiApiKey()) return "gemini";
    return "deterministic_fallback";
  }

  const envDefault = process.env.DEFAULT_MODEL_PROVIDER as ModelProviderKey;
  if (envDefault === "gemini" && hasGeminiApiKey()) return "gemini";
  if (envDefault === "openai_compatible" && hasOpenAICompatibleConfig()) return "openai_compatible";
  if (envDefault === "deterministic_fallback") return "deterministic_fallback";

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

export function getModelProviderCapability(provider: ModelProviderKey): ModelProviderCapability {
  if (provider === "openai_compatible") {
    return {
      level: "text_only",
      title: "文本模型",
      description: "适合 JD 匹配、中文改写和结构化输出。遇到截图、图片或复杂 PDF 时，需要先完成解析和结构校准。",
      bestFor: ["岗位匹配", "简历改写", "面试准备"],
      limitations: ["不能直接读取截图", "不能直接校准页面视觉结构"]
    };
  }

  if (provider === "gemini") {
    return {
      level: "vision_optional",
      title: "多模态模型",
      description: "适合校准 JD 截图、PDF 页面截图和 OCR 错误；如果只传文本，也可以作为文本模型使用。",
      bestFor: ["截图理解", "OCR 校准", "复杂版面恢复"],
      limitations: ["需要可用 Key", "效果依赖输入是否包含图片或截图"]
    };
  }

  return {
    level: "fallback_only",
    title: "确定性兜底",
    description: "只做基础规则整理，适合无 Key 时保底查看，不建议作为最终投递质量来源。",
    bestFor: ["离线兜底", "基础字段提取"],
    limitations: ["不能理解 JD 深层要求", "不能保证简历定制质量"]
  };
}
