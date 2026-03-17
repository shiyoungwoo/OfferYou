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

const factSeed: MasterFactSummary[] = [
  {
    id: "fact-offeryou",
    title: "OfferYou product buildout",
    summary: "Designed a three-stage AI workflow around deconstruct, mentor, and snapshot with explicit distortion controls.",
    blockType: "project"
  },
  {
    id: "fact-ai-content",
    title: "AI toolchain operating system",
    summary: "Shipped reusable AI-assisted content workflows across Xiaohongshu, WeChat, and Weibo publishing scenarios.",
    blockType: "experience"
  }
];

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

export function createMasterFact(input: CreateMasterFactInput): MasterFactSummary {
  if (!canCreateMasterFact({ integrityNoticeConfirmedAt: input.integrityNoticeConfirmedAt })) {
    throw new Error("Integrity notice must be confirmed before creating facts.");
  }

  return {
    id: `fact-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: input.title,
    summary: input.summary,
    blockType: input.blockType
  };
}

export function listMasterFacts(_userId: string): MasterFactSummary[] {
  return factSeed;
}

export function listMasterInsights(_userId: string): MasterInsightSummary[] {
  return insightSeed;
}
