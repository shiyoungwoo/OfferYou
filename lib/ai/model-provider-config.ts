import { readFileSync } from "node:fs";
import path from "node:path";
import type { ModelTaskKey } from "@/lib/ai/model-task-config";
import { getStorageRoot } from "@/lib/runtime/storage-root";
import { hasResolvedGeminiConfig, hasResolvedOpenAICompatibleConfig, resolveGeminiModelConfig, resolveOpenAICompatibleModelConfig } from "@/lib/ai/model-routing";

export type ModelProviderKey = "gemini" | "openai_compatible" | "antigravity_cli" | "codex_cli" | "deterministic_fallback";

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

export function hasAntigravityCliConfig() {
  // Check if agy binary exists (we just check if the env is configured or default works)
  return Boolean(process.env.ANTIGRAVITY_CLI_BIN ?? process.env.AGY_BIN ?? "agy");
}

export function hasCodexCliConfig() {
  return Boolean(process.env.CODEX_CLI_BIN ?? "codex");
}

let _prefCache: { provider: ModelProviderKey; at: number } | null = null;
const PREF_CACHE_TTL_MS = 3_000;

function readUserProviderPref(): ModelProviderKey | null {
  const now = Date.now();
  if (_prefCache && now - _prefCache.at < PREF_CACHE_TTL_MS) {
    return _prefCache.provider;
  }

  try {
    const prefPath = path.join(getStorageRoot(), "model-provider-pref.json");
    const raw = readFileSync(prefPath, "utf-8");
    const data = JSON.parse(raw);
    if (data.provider === "gemini" || data.provider === "openai_compatible" || data.provider === "antigravity_cli" || data.provider === "codex_cli") {
      _prefCache = { provider: data.provider, at: now };
      return data.provider;
    }
  } catch {}

  return null;
}

export function invalidateProviderPrefCache() {
  _prefCache = null;
}

export function getDefaultModelProvider(_task?: ModelTaskKey): ModelProviderKey {
  // 1. 用户通过 UI 切换的偏好（最高优先级）
  const userPref = readUserProviderPref();
  if (userPref === "gemini" && hasGeminiApiKey()) return "gemini";
  if (userPref === "openai_compatible" && hasOpenAICompatibleConfig()) return "openai_compatible";
  if (userPref === "antigravity_cli" && hasAntigravityCliConfig()) return "antigravity_cli";
  if (userPref === "codex_cli" && hasCodexCliConfig()) return "codex_cli";

  // 2. 环境变量默认值
  const envDefault = process.env.DEFAULT_MODEL_PROVIDER as ModelProviderKey;
  if (envDefault === "gemini" && hasGeminiApiKey()) return "gemini";
  if (envDefault === "openai_compatible" && hasOpenAICompatibleConfig()) return "openai_compatible";
  if (envDefault === "antigravity_cli" && hasAntigravityCliConfig()) return "antigravity_cli";
  if (envDefault === "codex_cli" && hasCodexCliConfig()) return "codex_cli";
  if (envDefault === "openai_compatible") return "deterministic_fallback";
  if (envDefault === "deterministic_fallback") return "deterministic_fallback";

  // 3. 自动检测
  if (hasOpenAICompatibleConfig()) {
    return "openai_compatible";
  }

  if (hasGeminiApiKey()) {
    return "gemini";
  }

  return "deterministic_fallback";
}

export function getAvailableModelProviders(): ModelProviderInfo[] {
  const geminiAvailability = getModelProviderAvailability("gemini");
  const openAICompatibleAvailability = getModelProviderAvailability("openai_compatible");
  const antigravityAvailability = getModelProviderAvailability("antigravity_cli");
  const codexAvailability = getModelProviderAvailability("codex_cli");
  const defaultProvider = getDefaultModelProvider();

  return [
    {
      key: "gemini",
      label: getGeminiProviderLabel(),
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
      key: "antigravity_cli",
      label: "Antigravity CLI",
      configured: antigravityAvailability.configured,
      authenticated: antigravityAvailability.authenticated,
      callable: antigravityAvailability.callable,
      available: antigravityAvailability.callable,
      default: defaultProvider === "antigravity_cli"
    },
    {
      key: "codex_cli",
      label: "Codex CLI",
      configured: codexAvailability.configured,
      authenticated: codexAvailability.authenticated,
      callable: codexAvailability.callable,
      available: codexAvailability.callable,
      default: defaultProvider === "codex_cli"
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

  if (provider === "antigravity_cli") {
    const configured = hasAntigravityCliConfig();
    return { configured, authenticated: configured, callable: configured };
  }

  if (provider === "codex_cli") {
    const configured = hasCodexCliConfig();
    return { configured, authenticated: configured, callable: configured };
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
      title: "Google Gemini",
      description: "按任务分层：简单任务使用 gemini-3.5-flash（快、智能），复杂推理使用 gemini-3.1-pro（最强），视觉任务使用 gemini-3.5-flash。支持原生 JSON mode。",
      bestFor: ["岗位匹配", "简历改写", "面试准备", "截图理解", "OCR 校准"],
      limitations: ["需要配置有效模型密钥", "3.1 Pro 为 preview 状态"]
    };
  }

  if (provider === "antigravity_cli") {
    return {
      level: "text_only" as const,
      title: "Antigravity CLI",
      description: "调用本机已授权的 Antigravity CLI (agy)，使用 Gemini 系列模型。适合文本生成和结构化输出。",
      bestFor: ["简历改写", "面试准备", "天赋发掘"],
      limitations: ["不直接读取图片", "需要本机安装 agy CLI 并完成登录"]
    };
  }

  if (provider === "codex_cli") {
    return {
      level: "text_only" as const,
      title: "Codex CLI",
      description: "调用本机已授权的 Codex CLI，使用 OpenAI 系列模型。只读模式，不修改文件。",
      bestFor: ["简历改写", "面试回答优化", "职业规划文本组织"],
      limitations: ["不直接读取图片", "不允许在 provider 模式修改文件"]
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

function getGeminiProviderLabel() {
  const config = resolveGeminiModelConfig();
  if (!config) return "Google Gemini";
  return `Google Gemini (${config.model})`;
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
