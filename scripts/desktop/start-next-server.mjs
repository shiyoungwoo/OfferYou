import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
let workspaceDir = process.cwd();
let pnpmBin = "pnpm";
let port = process.env.OFFERYOU_DESKTOP_PORT || "3100";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--workspace" && args[i + 1]) workspaceDir = args[++i];
  if (args[i] === "--pnpm-bin" && args[i + 1]) pnpmBin = args[++i];
  if (args[i] === "--port" && args[i + 1]) port = args[++i];
}

const logDir = path.join(workspaceDir, "storage", "logs");
mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, "desktop-server.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(logFile, line);
  process.stdout.write(line);
}

log(`Starting OfferYou server from ${workspaceDir}`);
log(`Using pnpm: ${pnpmBin}`);
log(`Using desktop port: ${port}`);

const hasProductionBuild = existsSync(path.join(workspaceDir, ".next", "BUILD_ID"));
const nextCommand = hasProductionBuild ? "start" : "dev";
log(`Using Next command: pnpm ${nextCommand}`);

const child = spawn(pnpmBin, [nextCommand, "--hostname", "127.0.0.1", "--port", port], {
  cwd: workspaceDir,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    OFFERYOU_DESKTOP: "1",
  },
});

child.stdout.on("data", (data) => {
  log(`[stdout] ${data.toString().trim()}`);
});

child.stderr.on("data", (data) => {
  log(`[stderr] ${data.toString().trim()}`);
});

child.on("exit", (code) => {
  log(`Server exited with code ${code}`);
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  log("Received SIGINT, stopping server...");
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  log("Received SIGTERM, stopping server...");
  child.kill("SIGTERM");
});
