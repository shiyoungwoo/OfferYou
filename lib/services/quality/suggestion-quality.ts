export type SuggestionQualityInput = {
  beforeText: string;
  afterText: string;
  reasonText: string;
  keywords?: string[];
};

export type SuggestionQualityResult = {
  score: number;
  passed: boolean;
  notes: string[];
  matchedKeywords: string[];
};

const FORBIDDEN_PATTERNS = [
  /管理数十人/u,
  /管理上百人/u,
  /千万级收入/u,
  /百万级收入/u,
  /年薪百万/u,
  /负责全公司/u,
  /从\s*0\s*到\s*1/u
];

const GENERIC_PHRASES = [
  /更贴近岗位/u,
  /更契合岗位/u,
  /提升表达/u,
  /优化表达/u,
  /突出.*能力/u,
  /重新描述/u,
  /重新构筑/u,
  /重新提炼/u,
  /按.*重新/u
];

const MIN_LENGTH = 24;

export function scoreSuggestionQuality(input: SuggestionQualityInput): SuggestionQualityResult {
  let score = 100;
  const notes: string[] = [];
  const matchedKeywords = matchKeywords(input.afterText, input.keywords ?? []);

  const normalizedBefore = normalizeText(input.beforeText);
  const normalizedAfter = normalizeText(input.afterText);
  const normalizedReason = normalizeText(input.reasonText);

  if (normalizedAfter.length < MIN_LENGTH) {
    score -= 28;
    notes.push("改写内容过短。");
  } else if (normalizedAfter.length < 48) {
    score -= 12;
    notes.push("改写内容偏短。");
  }

  if (normalizedAfter === normalizedBefore) {
    score -= 38;
    notes.push("改写前后几乎相同。");
  }

  if (!normalizedReason) {
    score -= 18;
    notes.push("缺少改写理由。");
  }

  if (input.keywords && input.keywords.length > 0 && matchedKeywords.length === 0) {
    score -= 20;
    notes.push("没有覆盖岗位关键词。");
  }

  const forbiddenHit = FORBIDDEN_PATTERNS.find((pattern) => pattern.test(input.afterText));
  if (forbiddenHit) {
    score -= 45;
    notes.push("存在明显虚构表达。");
  }

  if (matchedKeywords.length > 0) {
    score += 6;
  }

  if (GENERIC_PHRASES.some((pattern) => pattern.test(normalizedAfter))) {
    score -= 10;
    notes.push("改写仍然偏泛，缺少可落地的岗位映射。");
  }

  score = clamp(score, 0, 100);

  return {
    score,
    passed: score >= 60 && !notes.includes("存在明显虚构表达。"),
    notes,
    matchedKeywords
  };
}

function matchKeywords(text: string, keywords: string[]) {
  const normalizedText = normalizeText(text);
  return keywords
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword && normalizedText.includes(normalizeText(keyword)));
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
