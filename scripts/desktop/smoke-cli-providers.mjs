/**
 * Desktop CLI provider smoke test.
 *
 * Usage:
 *   node --import ./scripts/register-alias.mjs scripts/desktop/smoke-cli-providers.mjs
 *
 * Loads .env.local and tests each CLI provider with a lightweight prompt.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

// Load .env.local
const envPath = path.resolve(import.meta.dirname, "../../.env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
} catch {
  console.log("⚠️  No .env.local found, using existing env vars");
}

// Import after env is loaded (uses alias-hooks.mjs for @/ resolution)
const { callModelText } = await import("@/lib/ai/model-gateway.ts");

const PROMPT = "请用一句中文回答：OfferYou 桌面版模型通道已连通。";

async function smokeProvider(provider) {
  console.log(`\n--- Testing: ${provider} ---`);
  try {
    const start = Date.now();
    const result = await callModelText({
      systemPrompt: "你是一个测试助手。只用一句中文回答。",
      userPrompt: PROMPT,
      provider,
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ provider: ${result.provider}`);
    console.log(`✅ generationMode: ${result.generationMode}`);
    console.log(`✅ response (${elapsed}s): ${(result.data ?? "").slice(0, 80)}`);
    if (result.fallbackReason) {
      console.log(`⚠️  fallbackReason: ${result.fallbackReason}`);
    }
    return true;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

console.log("=== OfferYou Desktop CLI Provider Smoke Test ===");

const providers = ["antigravity_cli", "codex_cli"];
const results = {};

for (const provider of providers) {
  results[provider] = await smokeProvider(provider);
}

console.log("\n=== Summary ===");
for (const [provider, ok] of Object.entries(results)) {
  console.log(`${ok ? "✅" : "❌"} ${provider}`);
}

const allOk = Object.values(results).every(Boolean);
process.exit(allOk ? 0 : 1);
