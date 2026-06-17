import { GoogleGenAI } from "@google/genai";
import type { ModelReasoningTier } from "@/lib/ai/model-routing";

let _ai: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local to enable AI-powered analysis."
      );
    }
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

/** 切换 Provider 或轮换 API Key 后调用，使下次请求重新创建客户端。 */
export function invalidateGeminiClientCache() {
  _ai = null;
}

export type GeminiCallOptions = {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  tier?: ModelReasoningTier;
};

function getModelForTier(tier?: ModelReasoningTier): string {
  if (tier === "complex") {
    return process.env.GEMINI_MODEL_COMPLEX ?? "gemini-2.5-pro";
  }
  if (tier === "vision") {
    return process.env.GEMINI_MODEL_VISION ?? "gemini-2.5-flash";
  }
  return process.env.GEMINI_MODEL_SIMPLE ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

export async function callGemini(options: GeminiCallOptions): Promise<string> {
  const { systemPrompt, userPrompt, jsonMode, tier } = options;
  const model = getModelForTier(tier);
  const ai = getGenAI();

  const config: Record<string, unknown> = {
    systemInstruction: systemPrompt,
  };

  if (jsonMode) {
    config.responseMimeType = "application/json";
  }

  const timeoutMs = Number(process.env.OFFERYOU_MODEL_TIMEOUT_MS) || 45_000;

  const callPromise = ai.models.generateContent({
    model,
    contents: userPrompt,
    config,
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error("Gemini API 调用超时。")), timeoutMs);
    /* 防止 timer 阻止进程退出 */
    timer.unref();
  });

  const response = await Promise.race([callPromise, timeoutPromise]);

  return response.text ?? "";
}
