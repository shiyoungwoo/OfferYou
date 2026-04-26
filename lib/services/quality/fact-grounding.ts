export type FactGroundingEvidence = {
  text: string;
  title?: string;
};

export type FactGroundingInput = {
  beforeText: string;
  afterText: string;
  reasonText?: string;
  jdText: string;
  company?: string;
  jobTitle?: string;
  masterFacts?: FactGroundingEvidence[];
  resumeText?: string;
};

export type FactGroundingResult = {
  riskNotes: string[];
  highRisk: boolean;
};

const MANAGEMENT_PATTERNS = [/(?:管理|带领|负责)\s*\d+\s*人/u, /\d+\s*人团队/u];
const REVENUE_PATTERNS = [/千万级收入/u, /百万级收入/u, /年薪百万/u, /\d+\s*万[元]?/u];
const TITLE_PATTERNS = [/总监/u, /负责人/u, /主管/u, /经理/u, /lead/u, /head/u];

export function checkFactGrounding(input: FactGroundingInput): FactGroundingResult {
  const corpus = buildCorpus(input);
  const riskNotes: string[] = [];

  for (const match of input.afterText.matchAll(/\d{2,}(?:\.\d+)?/g)) {
    const token = match[0];
    if (!corpus.includes(token)) {
      riskNotes.push(`数字成果「${token}」未在原始材料中找到依据。`);
    }
  }

  for (const pattern of MANAGEMENT_PATTERNS) {
    if (pattern.test(input.afterText) && !pattern.test(corpus)) {
      riskNotes.push("管理人数表述缺少原始依据。");
      break;
    }
  }

  for (const pattern of REVENUE_PATTERNS) {
    if (pattern.test(input.afterText) && !pattern.test(corpus)) {
      riskNotes.push("收入或金额表述缺少原始依据。");
      break;
    }
  }

  for (const pattern of TITLE_PATTERNS) {
    if (pattern.test(input.afterText) && !pattern.test(corpus)) {
      riskNotes.push("职级或岗位头衔表述缺少原始依据。");
      break;
    }
  }

  if (input.company && input.afterText.includes(input.company) && !corpus.includes(input.company)) {
    riskNotes.push(`公司名「${input.company}」未在原始材料中找到依据。`);
  }

  if (input.jobTitle && input.afterText.includes(input.jobTitle) && !corpus.includes(input.jobTitle)) {
    riskNotes.push(`岗位名「${input.jobTitle}」未在原始材料中找到依据。`);
  }

  const highRisk = riskNotes.length > 0;

  return {
    riskNotes,
    highRisk
  };
}

function buildCorpus(input: FactGroundingInput) {
  const pieces = [
    input.beforeText,
    input.reasonText ?? "",
    input.jdText,
    input.company ?? "",
    input.jobTitle ?? "",
    input.resumeText ?? "",
    ...(input.masterFacts ?? []).flatMap((fact) => [fact.text, fact.title ?? ""])
  ];

  return pieces.join(" ").replace(/\s+/g, " ");
}
