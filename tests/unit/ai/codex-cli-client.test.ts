import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/cli/cli-command", () => ({
  execCliCommand: vi.fn(),
  createTempDir: vi.fn().mockResolvedValue("/tmp/offeryou-codex-test")
}));

const mockReadFile = vi.fn();
const mockMkdir = vi.fn().mockResolvedValue(undefined);
vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
  },
}));

import { execCliCommand } from "@/lib/ai/cli/cli-command";
import { callCodexCli, getCodexModelForTier } from "@/lib/ai/cli/codex-cli-client";

describe("codex-cli-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockReset();
    mockReadFile.mockResolvedValue("");
    delete process.env.CODEX_CLI_BIN;
    delete process.env.CODEX_CLI_MODEL;
    delete process.env.CODEX_CLI_MODEL_SIMPLE;
    delete process.env.CODEX_CLI_MODEL_COMPLEX;
  });

  it("uses codex exec with --sandbox read-only", async () => {
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: "OK response",
      stderr: "",
      exitCode: 0
    });

    await callCodexCli({
      systemPrompt: "sys",
      userPrompt: "user"
    });

    const call = vi.mocked(execCliCommand).mock.calls[0]?.[0];
    expect(call?.bin).toBe("codex");
    expect(call?.args[0]).toBe("exec");
    expect(call?.args).toContain("--sandbox");
    expect(call?.args).toContain("read-only");
    expect(call?.args).toContain("--cd");
    expect(call?.args).toContain("--output-last-message");
  });

  it("does NOT include --dangerously-bypass-approvals-and-sandbox", async () => {
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: "OK",
      stderr: "",
      exitCode: 0
    });

    await callCodexCli({
      systemPrompt: "sys",
      userPrompt: "user"
    });

    const call = vi.mocked(execCliCommand).mock.calls[0]?.[0];
    expect(call?.args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  it("allows overriding model via env vars", () => {
    process.env.CODEX_CLI_MODEL_SIMPLE = "custom-mini";
    expect(getCodexModelForTier("simple")).toBe("custom-mini");

    process.env.CODEX_CLI_MODEL_COMPLEX = "custom-pro";
    expect(getCodexModelForTier("complex")).toBe("custom-pro");
  });

  it("reads output-last-message file when available", async () => {
    mockReadFile.mockResolvedValue("File output");
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: "Stdout output",
      stderr: "",
      exitCode: 0
    });

    const result = await callCodexCli({
      systemPrompt: "sys",
      userPrompt: "user"
    });

    expect(result).toBe("File output");
  });

  it("falls back to stdout when file read fails", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: "Stdout fallback",
      stderr: "",
      exitCode: 0
    });

    const result = await callCodexCli({
      systemPrompt: "sys",
      userPrompt: "user"
    });

    expect(result).toBe("Stdout fallback");
  });

  it("includes safety instruction in prompt", async () => {
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: "OK",
      stderr: "",
      exitCode: 0
    });

    await callCodexCli({
      systemPrompt: "sys",
      userPrompt: "user"
    });

    const call = vi.mocked(execCliCommand).mock.calls[0]?.[0];
    const prompt = call?.args[call.args.length - 1];
    expect(prompt).toContain("不要修改文件");
    expect(prompt).toContain("不要运行命令");
  });

  it("adds JSON constraint when jsonMode is true", async () => {
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: '{"ok": true}',
      stderr: "",
      exitCode: 0
    });

    await callCodexCli({
      systemPrompt: "sys",
      userPrompt: "user",
      jsonMode: true
    });

    const call = vi.mocked(execCliCommand).mock.calls[0]?.[0];
    const prompt = call?.args[call.args.length - 1];
    expect(prompt).toContain("只返回合法 JSON");
  });
});
