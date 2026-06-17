import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn()
}));

vi.mock("@/lib/ai/cli/cli-command", () => ({
  execCliCommand: vi.fn(),
  createTempDir: vi.fn().mockResolvedValue("/tmp/offeryou-agy-test")
}));

import { execCliCommand } from "@/lib/ai/cli/cli-command";
import { callAntigravityCli, getAntigravityModelForTier } from "@/lib/ai/cli/antigravity-cli-client";

describe("antigravity-cli-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTIGRAVITY_CLI_BIN;
    delete process.env.AGY_BIN;
    delete process.env.ANTIGRAVITY_CLI_MODEL;
    delete process.env.ANTIGRAVITY_CLI_MODEL_SIMPLE;
    delete process.env.ANTIGRAVITY_CLI_MODEL_COMPLEX;
  });

  it("builds correct args with --print, --model, --log-file, --sandbox", async () => {
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: "OK",
      stderr: "",
      exitCode: 0
    });

    await callAntigravityCli({
      systemPrompt: "You are helpful.",
      userPrompt: "Say OK"
    });

    const call = vi.mocked(execCliCommand).mock.calls[0]?.[0];
    expect(call?.bin).toBe("agy");
    expect(call?.args).toContain("--print");
    expect(call?.args).toContain("--model");
    expect(call?.args).toContain("--log-file");
    expect(call?.args).toContain("--sandbox");
  });

  it("does NOT include --dangerously-skip-permissions", async () => {
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: "OK",
      stderr: "",
      exitCode: 0
    });

    await callAntigravityCli({
      systemPrompt: "sys",
      userPrompt: "user"
    });

    const call = vi.mocked(execCliCommand).mock.calls[0]?.[0];
    expect(call?.args).not.toContain("--dangerously-skip-permissions");
  });

  it("allows overriding bin via ANTIGRAVITY_CLI_BIN", async () => {
    process.env.ANTIGRAVITY_CLI_BIN = "/custom/agy";
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: "OK",
      stderr: "",
      exitCode: 0
    });

    await callAntigravityCli({
      systemPrompt: "sys",
      userPrompt: "user"
    });

    const call = vi.mocked(execCliCommand).mock.calls[0]?.[0];
    expect(call?.bin).toBe("/custom/agy");
  });

  it("allows overriding model via env vars", () => {
    process.env.ANTIGRAVITY_CLI_MODEL = "Custom Model";
    expect(getAntigravityModelForTier("simple")).toBe("Custom Model");

    process.env.ANTIGRAVITY_CLI_MODEL_COMPLEX = "Complex Model";
    expect(getAntigravityModelForTier("complex")).toBe("Complex Model");
  });

  it("throws on auth failure with clear message", async () => {
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: "",
      stderr: "Error: auth required, not logged in",
      exitCode: 1
    });

    await expect(
      callAntigravityCli({ systemPrompt: "sys", userPrompt: "user" })
    ).rejects.toThrow("未登录");
  });

  it("adds JSON-only constraint when jsonMode is true", async () => {
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: '{"ok": true}',
      stderr: "",
      exitCode: 0
    });

    await callAntigravityCli({
      systemPrompt: "sys",
      userPrompt: "user",
      jsonMode: true
    });

    const call = vi.mocked(execCliCommand).mock.calls[0]?.[0];
    const prompt = call?.args[1]; // --print value
    expect(prompt).toContain("只返回合法 JSON");
  });

  it("returns stdout text on success", async () => {
    vi.mocked(execCliCommand).mockResolvedValue({
      stdout: "  这是模型的回答  \n",
      stderr: "",
      exitCode: 0
    });

    const result = await callAntigravityCli({
      systemPrompt: "sys",
      userPrompt: "user"
    });

    expect(result).toBe("这是模型的回答");
  });
});
