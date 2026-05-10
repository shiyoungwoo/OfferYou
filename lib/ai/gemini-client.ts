import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseLooseJSON } from "@/lib/ai/json-parser";

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local to enable AI-powered analysis."
      );
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

export type GeminiCallOptions = {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
};

/**
 * Call Gemini with a system prompt and user prompt.
 * When jsonMode is true, the response is expected to be valid JSON.
 */
export async function callGemini(options: GeminiCallOptions): Promise<string> {
  const { systemPrompt, userPrompt, jsonMode } = options;
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  const model = getGenAI().getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    ...(jsonMode
      ? { generationConfig: { responseMimeType: "application/json" } }
      : {}),
  });

  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

/**
 * Call Gemini and parse the response as JSON.
 * Returns null if parsing fails.
 */
export async function callGeminiJSON<T = unknown>(
  options: Omit<GeminiCallOptions, "jsonMode">
): Promise<T | null> {
  try {
    const text = await callGemini({ ...options, jsonMode: true });
    return parseLooseJSON<T>(text);
  } catch (error) {
    console.error("[Gemini JSON] Failed to parse response:", error);
    return null;
  }
}
