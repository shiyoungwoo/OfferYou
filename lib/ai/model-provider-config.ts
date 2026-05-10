import type { ModelTaskKey } from "@/lib/ai/model-task-config";
import { hasResolvedOpenAICompatibleConfig, resolveOpenAICompatibleModelConfig } from "@/lib/ai/model-routing";

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
  configured: boolean;
  authenticated: boolean;
  callable: boolean;
  available: boolean;
  default: boolean;
};

export type ModelProviderAvailability = Pick<ModelProviderInfo, "configured" | "authenticated" | "callable">;

export function hasGeminiApiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function hasOpenAICompatibleConfig() {
  return hasResolvedOpenAICompatibleConfig();
}

export function getDefaultModelProvider(_task?: ModelTaskKey): ModelProviderKey {
  const envDefault = process.env.DEFAULT_MODEL_PROVIDER as ModelProviderKey;
  if (envDefault === "gemini" && hasGeminiApiKey()) return "gemini";
  if (envDefault === "openai_compatible" && hasOpenAICompatibleConfig()) return "openai_compatible";
  if (envDefault === "openai_compatible") return "deterministic_fallback";
  if (envDefault === "deterministic_fallback") return "deterministic_fallback";

  if (hasOpenAICompatibleConfig()) {
    return "openai_compatible";
  }

  return "deterministic_fallback";
}

export function getAvailableModelProviders(): ModelProviderInfo[] {
  const geminiAvailability = getModelProviderAvailability("gemini");
  const openAICompatibleAvailability = getModelProviderAvailability("openai_compatible");
  const defaultProvider = getDefaultModelProvider();

  return [
    {
      key: "gemini",
      label: "Gemini",
      configured: geminiAvailability.configured,
      authenticated: geminiAvailability.authenticated,
      callable: geminiAvailability.callable,
      available: geminiAvailability.callable,
      default: defaultProvider === "gemini"
    },
    {
      key: "openai_compatible",
      label: getOpenAICompatibleProviderLabel(),
      configured: openAICompatibleAvailability.configured,
      authenticated: openAICompatibleAvailability.authenticated,
      callable: openAICompatibleAvailability.callable,
      available: openAICompatibleAvailability.callable,
      default: defaultProvider === "openai_compatible"
    },
    {
      key: "deterministic_fallback",
      label: "Deterministic Fallback",
      configured: false,
      authenticated: false,
      callable: true,
      available: true,
      default: defaultProvider === "deterministic_fallback"
    }
  ];
}

export function getModelProviderAvailability(provider: Exclude<ModelProviderKey, "deterministic_fallback">): ModelProviderAvailability {
  if (provider === "gemini") {
    const configured = hasGeminiApiKey();
    return {
      configured,
      authenticated: configured,
      callable: configured
    };
  }

  const configured = hasOpenAICompatibleConfig();
  return {
    configured,
    authenticated: configured,
    callable: configured
  };
}

export function getModelProviderCapability(provider: ModelProviderKey): ModelProviderCapability {
  if (provider === "openai_compatible") {
    const providerLabel = getOpenAICompatibleProviderLabel();
    const isMimo = providerLabel.includes("小米");
    const isOpenAICodex = providerLabel.includes("OpenAI Codex");
    return {
      level: isMimo ? "vision_optional" : "text_only",
      title: providerLabel,
      description: isMimo
        ? "当前按 OpenAI 兼容接口调用小米 MiMo：复杂推理默认使用 v2.5-pro，普通文本节点默认使用 v2.5；截图 JD 需要显式进入视觉识别链路。"
        : isOpenAICodex
          ? "OpenAI Codex OAuth 模式用于高质量推理与轻量节点分流；需要有效 OAuth 访问令牌，不能使用普通页面登录态代替服务端调用。"
          : "适合 JD 匹配、中文改写和结构化输出。遇到截图、图片或复杂 PDF 时，需要先完成解析和结构校准。",
      bestFor: ["岗位匹配", "简历改写", "面试准备"],
      limitations: isMimo ? ["v2.5-pro 不作为图片识别模型使用", "截图 JD 识别必须记录用户确认"] : ["不能直接读取截图", "不能直接校准页面视觉结构"]
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

function getOpenAICompatibleProviderLabel() {
  const config = resolveOpenAICompatibleModelConfig();
  const model = config?.model ?? process.env.OPENAI_MODEL ?? process.env.MIMO_MODEL ?? "";
  const baseUrl = config?.baseUrl ?? process.env.OPENAI_BASE_URL ?? process.env.MIMO_BASE_URL ?? "";
  if (config?.flavor === "openai_codex" || process.env.OPENAI_COMPATIBLE_FLAVOR === "openai_codex") {
    return "OpenAI Codex OAuth";
  }

  if (config?.flavor === "mimo" || /mimo|xiaomi/i.test(`${model} ${baseUrl}`)) {
    return "小米 MiMo";
  }

  return "OpenAI 兼容模式";
}
