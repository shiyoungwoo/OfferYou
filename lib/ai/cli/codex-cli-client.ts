import { createTempDir, execCliCommand } from "@/lib/ai/cli/cli-command";
import { diagnoseCliError } from "@/lib/ai/cli/cli-diagnostics";
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";

export type CodexCliOptions = {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
};

function getCodexBin(): string {
  return process.env.CODEX_CLI_BIN ?? "codex";
}

export function getCodexModelForTier(tier: "simple" | "complex" = "simple"): string {
  if (tier === "complex") {
    return process.env.CODEX_CLI_MODEL_COMPLEX ?? process.env.CODEX_CLI_MODEL ?? "gpt-5.5";
  }
  return process.env.CODEX_CLI_MODEL_SIMPLE ?? process.env.CODEX_CLI_MODEL ?? "gpt-5.4-mini";
}

export async function callCodexCli(options: CodexCliOptions): Promise<string> {
  const { systemPrompt, userPrompt, jsonMode } = options;
  const bin = getCodexBin();
  const model = getCodexModelForTier();

  const tmpDir = await createTempDir("offeryou-codex-");
  const outputFile = path.join(tmpDir, "last.txt");
  await mkdir(tmpDir, { recursive: true });

  // Build prompt with safety constraints
  let prompt = "只返回模型生成结果，不要修改文件，不要运行命令，不要给计划。\n\n";
  if (systemPrompt) {
    prompt += `${systemPrompt}\n\n---\n\n`;
  }
  prompt += userPrompt;
  if (jsonMode) {
    prompt += "\n\n只返回合法 JSON，不要 Markdown，不要解释。";
  }

  const args = [
    "exec",
    "--cd", process.env.OFFERYOU_CLI_CWD ?? process.cwd(),
    "--sandbox", "read-only",
    "--model", model,
    "--output-last-message", outputFile,
    prompt,
  ];

  const timeoutMs = Number(process.env.CODEX_CLI_TIMEOUT_MS) || 120_000;

  const result = await execCliCommand({
    bin,
    args,
    timeoutMs,
    cwd: process.env.OFFERYOU_CLI_CWD ?? process.cwd(),
  });

  // Try reading the output file first
  let output = "";
  try {
    output = (await readFile(outputFile, "utf-8")).trim();
  } catch {}

  if (!output) {
    output = result.stdout.trim();
  }

  if (!output && result.exitCode !== 0) {
    const diagnostic = diagnoseCliError(result.stdout, result.stderr);
    throw new Error(`Codex CLI: ${diagnostic.message}`);
  }

  if (!output) {
    throw new Error("Codex CLI: 未返回任何内容。");
  }

  return output;
}
