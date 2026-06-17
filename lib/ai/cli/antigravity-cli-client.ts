import { createTempDir, execCliCommand } from "@/lib/ai/cli/cli-command";
import { diagnoseCliError } from "@/lib/ai/cli/cli-diagnostics";
import path from "node:path";
import { mkdir } from "node:fs/promises";

export type AntigravityCliOptions = {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
};

export type AntigravityCliResult = {
  text: string;
  model: string;
  diagnostic?: string;
};

function getAgyBin(): string {
  return process.env.ANTIGRAVITY_CLI_BIN ?? process.env.AGY_BIN ?? "agy";
}

function getAgyModel(tier: "simple" | "complex" | "vision" = "simple"): string {
  if (tier === "complex") {
    return process.env.ANTIGRAVITY_CLI_MODEL_COMPLEX ?? process.env.ANTIGRAVITY_CLI_MODEL ?? "Gemini 3.5 Flash (Medium)";
  }
  if (tier === "vision") {
    return process.env.ANTIGRAVITY_CLI_MODEL_VISION ?? process.env.ANTIGRAVITY_CLI_MODEL ?? "Gemini 3.5 Flash (Medium)";
  }
  return process.env.ANTIGRAVITY_CLI_MODEL_SIMPLE ?? process.env.ANTIGRAVITY_CLI_MODEL ?? "Gemini 3.5 Flash (Medium)";
}

export function getAntigravityModelForTier(tier: "simple" | "complex" | "vision" = "simple"): string {
  return getAgyModel(tier);
}

export async function callAntigravityCli(options: AntigravityCliOptions): Promise<string> {
  const { systemPrompt, userPrompt, jsonMode } = options;
  const bin = getAgyBin();
  const model = getAgyModel();

  const tmpDir = await createTempDir("offeryou-agy-");
  const logFile = path.join(tmpDir, "agy.log");
  await mkdir(tmpDir, { recursive: true });

  // Build prompt: merge system + user
  let prompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${userPrompt}` : userPrompt;
  if (jsonMode) {
    prompt += "\n\n只返回合法 JSON，不要 Markdown，不要解释。";
  }

  const args = [
    "--print", prompt,
    "--print-timeout", "120s",
    "--model", model,
    "--log-file", logFile,
    "--sandbox",
  ];

  const timeoutMs = Number(process.env.ANTIGRAVITY_CLI_TIMEOUT_MS) || 120_000;

  const result = await execCliCommand({
    bin,
    args,
    timeoutMs,
    cwd: process.env.OFFERYOU_CLI_CWD ?? process.cwd(),
    logFile,
  });

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    const diagnostic = diagnoseCliError(result.stdout, result.stderr, result.logContent);
    throw new Error(`Antigravity CLI: ${diagnostic.message}`);
  }

  return result.stdout.trim();
}
