export type CliDiagnosticCode =
  | "auth_required"
  | "model_missing"
  | "local_port_blocked"
  | "network_or_model_config"
  | "timeout"
  | "unknown";

export type CliDiagnostic = {
  code: CliDiagnosticCode;
  message: string;
  raw?: string;
};

const DIAGNOSTIC_PATTERNS: Array<{ pattern: RegExp; code: CliDiagnosticCode; message: string }> = [
  { pattern: /auth.*required|not.*logged.*in|unauthorized|login.*required/i, code: "auth_required", message: "CLI 未登录或授权失败，请在终端运行该 CLI 完成登录。" },
  { pattern: /model.*not.*found|invalid.*model|requested.*model|planmodel/i, code: "model_missing", message: "指定的模型不可用，请检查模型名称或切换到其他 provider。" },
  { pattern: /bind.*not.*permitted|EADDRINUSE|port.*blocked/i, code: "local_port_blocked", message: "本地端口被占用或权限不足。" },
  { pattern: /EOF|failed.*model.*config|connection.*refused|ECONNREFUSED|network/i, code: "network_or_model_config", message: "网络连接失败或模型配置错误。" },
  { pattern: /timeout|timed.*out|ETIMEDOUT/i, code: "timeout", message: "CLI 调用超时，请稍后重试或检查网络。" },
];

export function diagnoseCliError(stdout: string, stderr: string, logContent?: string): CliDiagnostic {
  const combined = [stdout, stderr, logContent ?? ""].join("\n");

  for (const { pattern, code, message } of DIAGNOSTIC_PATTERNS) {
    if (pattern.test(combined)) {
      return { code, message, raw: combined.slice(0, 500) };
    }
  }

  return {
    code: "unknown",
    message: `CLI 调用失败（exit code 非零）。`,
    raw: combined.slice(0, 500),
  };
}
