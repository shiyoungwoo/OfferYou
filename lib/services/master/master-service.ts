import { randomUUID } from "node:crypto";
import { executeSql, querySql, sqlString } from "@/lib/db";

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
  title: string;
  insightText: string;
  status: "pending_confirmation" | "confirmed";
  evidenceLabels: string[];
};

const insightSeed: MasterInsightSummary[] = [
  {
    id: "insight-workflow-abstraction",
    title: "Workflow abstraction under ambiguity",
    insightText: "Likely strongest when turning messy human processes into explicit operating workflows.",
    status: "pending_confirmation",
    evidenceLabels: ["OfferYou", "Cross-platform content systems"]
  },
  {
    id: "insight-zero-to-one",
    title: "Zero-to-one product orientation",
    insightText: "Shows repeated preference for system definition and operating model design over narrow feature polishing.",
    status: "confirmed",
    evidenceLabels: ["MVP protocol design", "AI workflow packaging"]
  }
];

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

  await executeSql(`
    INSERT INTO master_facts (id, user_id, title, summary, block_type, created_at, updated_at)
    VALUES (
      ${sqlString(fact.id)},
      ${sqlString(input.userId)},
      ${sqlString(fact.title)},
      ${sqlString(fact.summary)},
      ${sqlString(fact.blockType)},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  `);

  return fact;
}

export async function listMasterFacts(userId: string): Promise<MasterFactSummary[]> {
  const rows = await querySql<{
    id: string;
    title: string;
    summary: string;
    block_type: CreateMasterFactInput["blockType"];
  }>(`
    SELECT id, title, summary, block_type
    FROM master_facts
    WHERE user_id = ${sqlString(userId)}
    ORDER BY updated_at DESC, created_at DESC;
  `);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    blockType: row.block_type
  }));
}

export function listMasterInsights(_userId: string): MasterInsightSummary[] {
  return insightSeed;
}
