import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type CliExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  logContent?: string;
};

export type CliExecOptions = {
  bin: string;
  args: string[];
  timeoutMs?: number;
  maxBuffer?: number;
  cwd?: string;
  logFile?: string;
  env?: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_BUFFER = 1024 * 1024 * 4; // 4MB

export async function execCliCommand(options: CliExecOptions): Promise<CliExecResult> {
  const { bin, args, timeoutMs = DEFAULT_TIMEOUT_MS, maxBuffer = DEFAULT_MAX_BUFFER, cwd, logFile, env } = options;

  return new Promise((resolve) => {
    const child = execFile(
      bin,
      args,
      {
        timeout: timeoutMs,
        maxBuffer,
        cwd: cwd ?? process.cwd(),
        env: { ...process.env, ...env },
        encoding: "utf-8",
      },
      async (error, stdout, stderr) => {
        let logContent: string | undefined;
        if (logFile) {
          try {
            logContent = await readFile(logFile, "utf-8");
          } catch {}
        }

        if (error) {
          resolve({
            stdout: stdout ?? "",
            stderr: stderr ?? error.message,
            exitCode: typeof error.code === "number" ? error.code : 1,
            logContent,
          });
        } else {
          resolve({
            stdout: stdout ?? "",
            stderr: stderr ?? "",
            exitCode: 0,
            logContent,
          });
        }
      }
    );

    // Close stdin immediately — some CLIs (e.g. agy) wait for stdin even in --print mode
    child.stdin?.end();
  });
}

export async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}
