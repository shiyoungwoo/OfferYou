import { z } from "zod";
import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getStorageRoot } from "@/lib/runtime/storage-root";
import { invalidateProviderPrefCache, type ModelProviderKey } from "@/lib/ai/model-provider-config";

function getPrefPath() {
  return path.join(getStorageRoot(), "model-provider-pref.json");
}

const providerSchema = z.enum(["gemini", "openai_compatible", "antigravity_cli", "codex_cli"]);
type PrefData = { provider: ModelProviderKey };

async function readPref(): Promise<PrefData> {
  try {
    const raw = await readFile(getPrefPath(), "utf-8");
    const data = JSON.parse(raw);
    if (data.provider === "gemini" || data.provider === "openai_compatible" || data.provider === "antigravity_cli" || data.provider === "codex_cli") {
      return data;
    }
  } catch {}
  return { provider: "openai_compatible" };
}

async function writePref(data: PrefData): Promise<void> {
  const prefPath = getPrefPath();
  await mkdir(path.dirname(prefPath), { recursive: true });
  await writeFile(prefPath, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const pref = await readPref();
  return NextResponse.json(pref);
}

const postBodySchema = z.object({
  provider: providerSchema
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await writePref({ provider: parsed.data.provider });
  invalidateProviderPrefCache();
  return NextResponse.json({ provider: parsed.data.provider });
}
