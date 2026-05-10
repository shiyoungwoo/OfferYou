import { randomUUID } from "node:crypto";
import { executeSqlParams, querySqlParams } from "@/lib/db";
import { parseJsonPayload } from "@/lib/services/persistence/json-payload";

export type MasterState = {
  integrityNoticeConfirmedAt: string | null;
};

export type CreateMasterFactInput = {
  userId: string;
  title: string;
  summary: string;
  blockType: "summary" | "experience" | "project" | "education" | "skill" | "certificate" | "other";
  integrityNoticeConfirmedAt: string;
};

export type MasterFactSummary = {
  id: string;
  title: string;
  summary: string;
  blockType: CreateMasterFactInput["blockType"];
};

export type MasterInsightSummary = {
  id: string;
  userId: string;
  title: string;
  insightText: string;
  evidenceFactIds: string[];
  status: "pending_confirmation" | "confirmed" | "rejected";
  createdAt: string;
  updatedAt: string;
};


export function canCreateMasterFact(state: MasterState) {
  return Boolean(state.integrityNoticeConfirmedAt);
}

export async function createMasterFact(input: CreateMasterFactInput): Promise<MasterFactSummary> {
  if (!canCreateMasterFact({ integrityNoticeConfirmedAt: input.integrityNoticeConfirmedAt })) {
    throw new Error("Integrity notice must be confirmed before creating facts.");
  }

  const fact = {
    id: `fact-${randomUUID()}`,
    title: input.title,
    summary: input.summary,
    blockType: input.blockType
  };

  await executeSqlParams(
    "INSERT INTO master_facts (id, user_id, title, summary, block_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    [fact.id, input.userId, fact.title, fact.summary, fact.blockType]
  );

  return fact;
}

export async function listMasterFacts(userId: string): Promise<MasterFactSummary[]> {
  const rows = await querySqlParams<{
    id: string;
    title: string;
    summary: string;
    block_type: CreateMasterFactInput["blockType"];
  }>(
    "SELECT id, title, summary, block_type FROM master_facts WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC",
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    blockType: row.block_type
  }));
}

export async function saveMasterInsight(input: {
  userId: string;
  title: string;
  insightText: string;
  evidenceFactIds: string[];
  status?: "pending_confirmation" | "confirmed" | "rejected";
}): Promise<MasterInsightSummary> {
  const now = new Date().toISOString();
  const insight: MasterInsightSummary = {
    id: `insight-${randomUUID()}`,
    userId: input.userId,
    title: input.title,
    insightText: input.insightText,
    evidenceFactIds: input.evidenceFactIds,
    status: input.status ?? "pending_confirmation",
    createdAt: now,
    updatedAt: now
  };

  await executeSqlParams(
    "INSERT INTO master_insights (id, user_id, status, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [insight.id, insight.userId, insight.status, JSON.stringify(insight), insight.createdAt, insight.updatedAt]
  );

  return insight;
}

export async function listMasterInsights(userId: string): Promise<MasterInsightSummary[]> {
  const rows = await querySqlParams<{ payload_json: string }>(
    "SELECT payload_json FROM master_insights WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC",
    [userId]
  );

  const insights: MasterInsightSummary[] = [];

  for (const row of rows) {
    const parsed = parseJsonPayload<MasterInsightSummary>(row.payload_json, "洞察");
    if (parsed.ok) {
      insights.push(parsed.value);
    }
  }

  return insights;
}
