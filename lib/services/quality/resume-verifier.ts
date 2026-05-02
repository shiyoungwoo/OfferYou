import type { JDInsight, RewriteVerification } from "@/lib/services/job-apply/agent-run";
import { checkFactGrounding } from "@/lib/services/quality/fact-grounding";
import { scoreSuggestionQuality } from "@/lib/services/quality/suggestion-quality";

export function verifyRewriteSuggestion(input: {
  beforeText: string;
  afterText: string;
  reasonText: string;
  jdText: string;
  jdInsight?: JDInsight;
  company?: string;
  jobTitle?: string;
  masterFacts: Array<{ title: string; text: string }>;
  resumeText: string;
}): RewriteVerification {
  const issues: string[] = [];
  const after = input.afterText.trim();
  const before = input.beforeText.trim();

  if (!after) {
    issues.push("改写内容为空。");
  }

  if (/(?:\.{3}|…|待补充|TODO|TBD|建议在此|建议补充)/iu.test(after)) {
    issues.push("改写内容包含省略、占位或建议性空话。");
  }

  if (normalizeForCompare(after) === normalizeForCompare(before)) {
    issues.push("改写内容与原文过于接近。");
  }

  const quality = scoreSuggestionQuality({
    beforeText: before,
    afterText: after,
    reasonText: input.reasonText,
    keywords: input.jdInsight?.coreAbilities ?? []
  });
  const grounding = checkFactGrounding({
    beforeText: before,
    afterText: after,
    reasonText: input.reasonText,
    jdText: input.jdText,
    company: input.company,
    jobTitle: input.jobTitle,
    masterFacts: input.masterFacts,
    resumeText: input.resumeText
  });

  issues.push(...quality.notes, ...grounding.riskNotes);

  const status = issues.some((issue) => /为空|省略|占位|虚构|无法追溯|过于接近/u.test(issue))
    ? "fail"
    : issues.length > 0
      ? "warn"
      : "pass";

  return {
    status,
    issues: dedupe(issues)
  };
}

function normalizeForCompare(text: string) {
  return text.replace(/\s+/g, "").replace(/[。；，、,.!！?？:：-]/g, "").toLowerCase();
}

function dedupe(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
