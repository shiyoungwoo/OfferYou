export type RewriteQualityGateInput = {
  beforeText: string;
  afterText: string;
  jdKeywords: string[];
  mustPreserveFacts: string[];
  mustAvoidPhrases: string[];
};

export type RewriteQualityGateResult = {
  passed: boolean;
  issues: string[];
  matchedKeywords: string[];
  preservedFacts: string[];
  blockedPhrases: string[];
};

export function evaluateRewriteQuality(input: RewriteQualityGateInput): RewriteQualityGateResult {
  const issues: string[] = [];
  const normalizedBefore = normalizeText(input.beforeText);
  const normalizedAfter = normalizeText(input.afterText);
  const matchedKeywords = matchKeywords(normalizedAfter, input.jdKeywords);
  const preservedFacts: string[] = [];
  const blockedPhrases: string[] = [];

  if (!normalizedAfter) {
    issues.push("改写内容为空。");
  }

  if (normalizedAfter === normalizedBefore) {
    issues.push("改写前后完全一致。");
  }

  for (const phrase of input.mustAvoidPhrases) {
    const normalizedPhrase = normalizeText(phrase);
    if (normalizedPhrase && normalizedAfter.includes(normalizedPhrase)) {
      blockedPhrases.push(phrase);
      issues.push(`出现禁止短语「${phrase}」。`);
    }
  }

  if (input.jdKeywords.length > 0 && matchedKeywords.length === 0) {
    issues.push("未命中任何 JD 关键词。");
  }

  for (const fact of input.mustPreserveFacts) {
    const normalizedFact = normalizeText(fact);
    if (!normalizedFact) {
      continue;
    }

    if (normalizedBefore.includes(normalizedFact) && normalizedAfter.includes(normalizedFact)) {
      preservedFacts.push(fact);
      continue;
    }

    if (normalizedBefore.includes(normalizedFact) && !normalizedAfter.includes(normalizedFact)) {
      issues.push(`必保事实「${fact}」在改写后缺失或被改错。`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    matchedKeywords,
    preservedFacts,
    blockedPhrases
  };
}

function matchKeywords(text: string, keywords: string[]) {
  return keywords
    .map((keyword) => normalizeText(keyword))
    .filter((keyword) => keyword.length > 0 && text.includes(keyword));
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}
