import { callModelJSON } from "@/lib/ai/model-gateway";
import { getDefaultModelProvider, type ModelProviderKey } from "@/lib/ai/model-provider-config";
import { buildJDInsight, buildRewriteStrategy, selectJDAbilityLabel } from "@/lib/services/analysis/jd-insight";
import { cleanGeneratedResumeText, normalizeOcrResumeText } from "@/lib/services/analysis/text-cleaner";
import type { CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";
import type { GenerationMode, JDInsight, RewriteStrategy, RewriteVerification } from "@/lib/services/job-apply/agent-run";
import { verifyRewriteSuggestion } from "@/lib/services/quality/resume-verifier";
import fs from "node:fs";
import path from "node:path";

export type SuggestionSeedInput = {
  jdText: string;
  talentHeadline?: string;
  selectedCareerDirectionLabel?: string;
  company?: string;
  jobTitle?: string;
  facts: Array<{
    text: string;
    section?: string;
    title?: string;
    sourceKind?: "resume_baseline" | "master_fact" | "target_role_fit";
    sourceLabel?: string;
  }>;
  calibratedResume?: CalibratedResumeProfile;
};

export type AIGeneratorInput = SuggestionSeedInput & {
  gaps: string[];
  keywordsToBridge: string[];
  jdInsight?: JDInsight;
  rewriteStrategy?: RewriteStrategy;
};

export type SuggestionGenerationOptions = {
  modelProvider?: ModelProviderKey;
};

export type SuggestionSeed = {
  id: string;
  candidateId?: string;
  section: string;
  title: string;
  beforeText: string;
  afterText: string;
  reasonText: string;
  status: "pending";
  revisionRound: number;
  sourceKind: "resume_baseline" | "master_fact" | "target_role_fit" | "revision";
  sourceLabel: string;
  generationMode?: GenerationMode;
  modelProvider?: ModelProviderKey;
  modelFallbackReason?: string;
  jdAbility?: string;
  factAnchors?: string[];
  verification?: RewriteVerification;
};

// Gemini JSON response shape for suggestions
type GeminiSuggestionResponse = {
  suggestions: Array<{
    candidateId?: string;
    section: string;
    title: string;
    before: string;
    after: string;
    reason: string;
    jdAbility?: string;
    factAnchors?: string[];
  }>;
};

type SuggestionCandidate = SuggestionSeedInput["facts"][number] & {
  candidateId?: string;
  confidence?: "high" | "medium" | "low";
  issues?: string[];
};

function loadRewritePrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), "prompts", "rewrite_expert.md");
    return fs.readFileSync(promptPath, "utf-8");
  } catch {
    return `You are a Professional Resume Consultant specializing in the STAR method.
For each experience block, provide a COMPREHENSIVE After optimization.
Do NOT just provide a summary; rewrite the FULL content to be impactful and JD-aligned.
Never add facts the user didn't provide. Use strong action verbs. Focus on results.
Ensure each After text is roughly the same length as or longer than the Before text if improvements are possible.
If an experience block contains multiple projects or schools, treat them as a group and optimize each part.`;
  }
}

export async function generateAISuggestions(
  input: AIGeneratorInput,
  options: SuggestionGenerationOptions = {}
): Promise<SuggestionSeed[]> {
  const provider = options.modelProvider ?? getDefaultModelProvider("rewrite");
  if (provider === "deterministic_fallback") {
    return withFallbackReason(
      generateSeedSuggestions(input),
      "已按配置使用确定性回退，不调用外部模型。"
    );
  }

  try {
    const systemPrompt = loadRewritePrompt();
    const jdInsight = input.jdInsight ?? buildJDInsight(input);
    const rewriteStrategy = input.rewriteStrategy ?? buildRewriteStrategy(jdInsight);

    const candidates = buildSuggestionCandidates(input);
    const factBlocks = candidates
      .filter((f) => f.sourceKind !== "target_role_fit")
      .map((f, i) => {
        const candidatePrefix = f.candidateId ? ` candidateId=${f.candidateId}` : "";
        return `[Block ${i + 1}${candidatePrefix}] ${f.title || f.section || "Experience"}: ${f.text}`;
      })
      .join("\n");

    const userPrompt = `## Job Description
${input.jdText}

## Candidate Experience Blocks
${factBlocks}

## Identified Gaps (from analysis)
${input.gaps.map((g) => `- ${g}`).join("\n")}

## Keywords to Bridge
${input.keywordsToBridge.join(", ")}

## JD Insight
核心能力：${jdInsight.coreAbilities.join("、")}
硬性要求：${jdInsight.hardRequirements.join("、")}
加分项：${jdInsight.bonusItems.join("、")}
避免项：${jdInsight.avoidItems.join("、")}

## Rewrite Strategy
优先级：${rewriteStrategy.priorities.join("、")}
弱相关经历处理：保留时间线和真实职责，压缩为 1-2 行，不要强行包装为直接经验。

${input.talentHeadline ? `## Talent Profile: ${input.talentHeadline}` : ""}
${input.selectedCareerDirectionLabel ? `## Career Direction: ${input.selectedCareerDirectionLabel}` : ""}

## Required Output Format (JSON)
{
  "suggestions": [
    {
      "section": "experience | summary | project",
      "title": "Short label for this suggestion",
      "before": "The original text from the candidate's block",
      "after": "The optimized rewrite — MUST be a concrete draft of the revised text. Do not provide meta-comments or advice here; provide the actual content.",
      "reason": "Explain why this change is needed based on specific JD requirements. If the JD requires a skill (e.g. 'Data Analysis') that is missing in this block, state: '【JD 缺失能力提醒】：JD 要求 X，简历未体现，建议补充 Y' followed by the rationale.",
      "jdAbility": "A concrete JD capability from JD Insight, e.g. AI 工具 / Prompt 应用",
      "factAnchors": ["Short source facts that support this rewrite"]
    }
  ]
}

Resume rewrite rules:
1. Provide ACTUAL CONTENT in the "after" field. Avoid phrases like "建议在此增加..." or "这段经历相关性较弱". Instead, write what the revised text should actually look like.
2. The "after" field must be COMPLETE. Never use "..." or "…" or unfinished sentences. Never output placeholders.
3. The "after" field must show JD tailoring, not a copy of the original. Reorganize the source facts around 1-3 concrete JD requirements, such as AI workflow, content operations, product iteration, data analysis, collaboration, delivery, or learning ability when supported by source facts.
4. For summary blocks, rewrite into 3-5 lines in this format: 能力维度：事实证据或结果.
5. For work/project blocks, rewrite into the resume-ready structure: first line is title/company/project + role + time if available; then 2-4 concise bullets. Low-relevance blocks may keep only 1-2 lines, but still must be concrete.
6. For each suggestion, link it to a specific requirement in the JD. Explain the "Why" using JD keywords.
7. If the JD requires a competency that the user has NOT mentioned, use the "reason" field to provide a clear "Gap Reminder" (缺失能力提醒) and tell them exactly what kind of fact or action they should add to this section to bridge the gap.
8. Follow STAR principles (Situation, Task, Action, Result) for "after" text.
9. If a candidate has low calibration confidence, do not fabricate a投递版 rewrite. Keep the description conservative and focus on structure confirmation.
10. All output (title, after, reason) MUST be in Chinese (中文).
11. Include candidateId when you can map a suggestion to a specific candidate.
12. section 由系统根据 candidateId 固定，不允许模型改变。请不要尝试把 education、credential 或 other_needs_review 内容改成工作经历。`;

    const result = await callModelJSON<GeminiSuggestionResponse>({
      systemPrompt,
      userPrompt,
      provider,
      fallbackFactory: () => null
    });

    if (result.data?.suggestions && Array.isArray(result.data.suggestions) && result.data.suggestions.length > 0) {
      return result.data.suggestions
        .flatMap((s, i) => {
          const matchedCandidate = resolveModelSuggestionCandidate(s, candidates, i);

          if (!matchedCandidate || !isRewritableSuggestionSection(matchedCandidate.section)) {
            return [];
          }

          return [reviewSuggestion(
            {
              id: `ai-${i + 1}`,
              candidateId: matchedCandidate.candidateId ?? s.candidateId,
              section: matchedCandidate.section || "experience",
              title: matchedCandidate.title || s.title || `AI Suggestion ${i + 1}`,
              beforeText: matchedCandidate.text ?? s.before,
              afterText: normalizeModelSuggestionAfterText(s.after),
              reasonText: s.reason,
              status: "pending" as const,
              revisionRound: 0,
              sourceKind: "resume_baseline" as const,
              sourceLabel: getAIRewriteSourceLabel(provider),
              generationMode: result.generationMode ?? "model",
              modelProvider: provider,
              jdAbility: selectJDAbilityLabel({
                text: `${s.jdAbility ?? ""} ${s.after} ${s.reason}`,
                jdInsight,
                fallback: s.jdAbility
              }),
              factAnchors: Array.isArray(s.factAnchors) && s.factAnchors.length
                ? s.factAnchors
                : deriveFactAnchors(matchedCandidate.text ?? s.before)
            },
            {
              ...input,
              jdInsight,
              rewriteStrategy
            }
          )];
        });
    }

    return withFallbackReason(
      generateSeedSuggestions(input),
      result.fallbackReason ?? "模型返回内容为空，已切换到确定性回退。"
    );
  } catch (error) {
    const fallbackReason =
      error instanceof Error && error.message
        ? "AI 改写调用失败，已切换到确定性回退。"
        : "AI 改写调用失败，已切换到确定性回退。";
    return withFallbackReason(generateSeedSuggestions(input), fallbackReason);
  }
}

/**
 * Deterministic seed suggestions (original logic — kept as fallback).
 */
export function generateSeedSuggestions(input: SuggestionSeedInput): SuggestionSeed[] {
  return buildSuggestionCandidates(input)
    .map((fact, index) => rankSuggestionCandidate(fact, input.jdText, index))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map(({ fact }, index) => {
      const lowConfidenceCalibration = fact.candidateId && (fact.confidence === "low" || (fact.issues?.length ?? 0) > 0);
      const rewrite = lowConfidenceCalibration
        ? {
            after: cleanGeneratedResumeText(fact.text),
            reason: `这段内容的结构置信度较低，先确认归属和时间线，再进入岗位定制。；标签：结构校准`
          }
        : rewriteFactForJd(fact.text, input.jdText, {
            talentHeadline: input.talentHeadline,
            selectedCareerDirectionLabel: input.selectedCareerDirectionLabel,
            sourceKind: fact.sourceKind,
          });
      const cleanedAfter = normalizeModelSuggestionAfterText(rewrite.after);

      return reviewSuggestion(
        {
          id: `seed-${index + 1}`,
          candidateId: fact.candidateId,
          section: fact.section ?? "experience",
          title: fact.title ?? `改写建议 ${index + 1}`,
          beforeText: fact.text,
          afterText: cleanedAfter,
          reasonText: rewrite.reason,
          status: "pending",
          revisionRound: 0,
          sourceKind: fact.sourceKind ?? "resume_baseline",
          sourceLabel: fact.sourceLabel ?? getDefaultSourceLabel(fact.sourceKind),
          generationMode: "deterministic_fallback",
          modelProvider: "deterministic_fallback",
          jdAbility: selectJDAbilityLabel({
            text: `${cleanedAfter} ${rewrite.reason}`,
            jdInsight: buildJDInsight({
              jdText: input.jdText
            }),
          }),
          factAnchors: deriveFactAnchors(fact.text)
        },
        input
      );
    });
}

function withFallbackReason(suggestions: SuggestionSeed[], reason: string): SuggestionSeed[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    modelFallbackReason: reason,
    generationMode: "deterministic_fallback",
    modelProvider: "deterministic_fallback"
  }));
}

function rankSuggestionCandidate(
  fact: SuggestionCandidate,
  jdText: string,
  index: number
) {
  const relevance = scoreFactRelevance(fact.text, jdText);
  const sectionScore =
    fact.section === "project" ? 2 :
    fact.section === "experience" ? 1 :
    fact.section === "summary" ? 0.5 :
    fact.section === "credential" ? -1 :
    fact.section === "other_needs_review" ? -2 : 0;
  return {
    fact,
    score: relevance * 10 + sectionScore - index * 0.01
  };
}

function reviewSuggestion(suggestion: SuggestionSeed, input: SuggestionSeedInput | AIGeneratorInput): SuggestionSeed {
  const jdInsight = "jdInsight" in input ? (input as AIGeneratorInput).jdInsight : undefined;
  const verification = verifyRewriteSuggestion({
    beforeText: suggestion.beforeText,
    afterText: suggestion.afterText,
    reasonText: suggestion.reasonText,
    jdText: input.jdText,
    jdInsight,
    company: input.company,
    jobTitle: input.jobTitle,
    masterFacts: input.facts.map((fact) => ({
      title: fact.title ?? "",
      text: fact.text
    })),
    resumeText: input.facts
      .filter((fact) => fact.sourceKind === "resume_baseline")
      .map((fact) => fact.text)
      .join("\n")
  });

  return {
    ...suggestion,
    jdAbility: suggestion.jdAbility ?? selectJDAbilityLabel({
      text: `${suggestion.afterText} ${suggestion.reasonText}`,
      jdInsight,
      fallback: extractKeywords(input.jdText)[0]
    }),
    factAnchors: suggestion.factAnchors?.length ? suggestion.factAnchors : deriveFactAnchors(suggestion.beforeText),
    verification
  };
}

function extractKeywords(text: string) {
  return text
    .split(/[\s,，;；、/]+/u)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length >= 2)
    .slice(0, 8);
}

function deriveFactAnchors(text: string) {
  return text
    .split(/[\n。；;]+/u)
    .map((line) => cleanGeneratedResumeText(line).trim())
    .filter((line) => line.length >= 6)
    .slice(0, 3);
}

function resolveModelSuggestionCandidate(
  suggestion: GeminiSuggestionResponse["suggestions"][number],
  candidates: SuggestionCandidate[],
  index: number
): SuggestionCandidate | undefined {
  if (suggestion.candidateId) {
    const explicit = candidates.find((candidate) => candidate.candidateId === suggestion.candidateId);
    if (explicit) {
      return explicit;
    }
  }

  const before = normalizeForMatching(suggestion.before);
  const title = normalizeForMatching(suggestion.title);
  const byBefore = pickBestCandidateMatch(
    candidates,
    (candidate) => scoreTextOverlap(before, normalizeForMatching(candidate.text))
  );

  if (byBefore) {
    return byBefore;
  }

  const byTitle = pickBestCandidateMatch(
    candidates,
    (candidate) => scoreTextOverlap(title, normalizeForMatching(candidate.title ?? ""))
  );

  if (byTitle) {
    return byTitle;
  }

  // Some model providers omit candidateId even when the prompt asks for it.
  // Use candidate order as the last binding fallback, while still inheriting
  // section from the calibrated candidate so the model cannot drift labels.
  return candidates[index];
}

function pickBestCandidateMatch(
  candidates: SuggestionCandidate[],
  scoreFn: (candidate: SuggestionCandidate) => number
) {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreFn(candidate)
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0] && ranked[0].score >= 0.28 ? ranked[0].candidate : undefined;
}

function scoreTextOverlap(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  if (right.includes(left) || left.includes(right)) {
    return 1;
  }

  const leftTokens = tokenSlices(left);
  const rightTokens = new Set(tokenSlices(right));
  const hits = leftTokens.filter((token) => rightTokens.has(token)).length;
  return leftTokens.length ? hits / leftTokens.length : 0;
}

function tokenSlices(text: string) {
  const windowSize = 4;
  if (text.length <= windowSize) {
    return text ? [text] : [];
  }

  const tokens: string[] = [];
  for (let index = 0; index <= text.length - windowSize; index += 1) {
    tokens.push(text.slice(index, index + windowSize));
  }

  return tokens;
}

function normalizeForMatching(text?: string) {
  return cleanGeneratedResumeText(text ?? "")
    .replace(/\s+/g, "")
    .replace(/[，。；：、,.／/｜|()（）【】\[\]{}"'「」『』]/gu, "")
    .toLowerCase();
}

// ─── Deterministic helpers (unchanged) ───

function getReasonText({
  hasTalentProfile,
  sourceKind,
}: {
  hasTalentProfile: boolean;
  sourceKind?: SuggestionSeedInput["facts"][number]["sourceKind"];
}) {
  if (sourceKind === "master_fact") {
    return "这版改写会保留已经确认过的真实事实，同时把这段经历写得更贴近目标岗位的动作和结果。";
  }
  if (hasTalentProfile) {
    return "这版改写不会改变事实本身，但会把你的底层优势、具体动作和岗位关键词一起写出来。";
  }
  return "这版改写会让这段经历更贴近 JD 重点，同时保留原始事实和可核实依据。";
}

function getDefaultSourceLabel(sourceKind?: SuggestionSeedInput["facts"][number]["sourceKind"]) {
  if (sourceKind === "master_fact") return "默认事实档案";
  if (sourceKind === "target_role_fit") return "岗位适配分析";
  return "简历原文";
}

function getAIRewriteSourceLabel(provider: ModelProviderKey) {
  if (provider === "openai_compatible") return "小米 MiMo 改写建议";
  if (provider === "gemini") return "Gemini 改写建议";
  return "AI 改写建议";
}

export function rewriteFactForJd(
  fact: string,
  jdText: string,
  context?: {
    talentHeadline?: string;
    selectedCareerDirectionLabel?: string;
    sourceKind?: SuggestionSeedInput["facts"][number]["sourceKind"];
  }
) {
  const cleanedFact = normalizeOcrResumeText(fact);
  const hasTalentProfile = Boolean(context?.talentHeadline);
  const focus = deriveRewriteFocus(jdText);
  const datedEntries = splitDatedResumeEntries(cleanedFact);

  if (datedEntries.length > 1) {
    const multiRewrites = datedEntries.map((entry) => rewriteDatedEntryForJd(entry, jdText, focus));
    
    return {
      after: multiRewrites.join("\n\n"),
      reason: `按原始时间线拆分为 ${datedEntries.length} 段分别改写，避免把不同项目内容混在一起；重点参考 JD 中的「${focus}」。；标签：${focus}`
    };
  }

  // Single project logic
  const relevance = scoreFactRelevance(cleanedFact, jdText);
  const normalizedFact = cleanedFact.trim().replace(/[。．\.！!？?]+$/u, "");
  const rewriteLead = getRewriteLead(normalizedFact, relevance < 2 ? 60 : 120);

  if (relevance < 2) {
    const fallbackAfter = `${rewriteLead}。`;
    const fallbackReason = `【JD 缺失能力提醒】：这段经历与「${focus}」关联较弱，建议只保留时间线和可迁移动作，除非能补充真实的岗位相关成果。；标签：${focus}`;
    return { after: fallbackAfter, reason: fallbackReason };
  }

  const baseAfter = `${rewriteLead}，对应「${focus}」。`;
  const baseReason = `保留原始事实中与「${focus}」相关的动作和结果，压缩空泛表达。；标签：${focus}；质量提升`;

  return { after: baseAfter, reason: baseReason };
}

function normalizeModelSuggestionAfterText(text: string) {
  return cleanGeneratedResumeText(text)
    .replace(/(?:\.{3}|…)+/gu, "")
    .replace(/^可以改为[:：]\s*/u, "")
    .replace(/^建议(?:改为|写成|调整为)[:：]?\s*/u, "")
    .replace(/(?:建议补充|建议增加)[:：]?.*$/gmu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type DatedResumeEntry = {
  title: string;
  date: string;
  body: string;
};

function splitDatedResumeEntries(text: string): DatedResumeEntry[] {
  const lines = normalizeOcrResumeText(text)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: DatedResumeEntry[] = [];
  let current: DatedResumeEntry | null = null;

  for (const line of lines) {
    // Support YYYY.MM, YYYY/MM, and YYYY (Year-only) formats
    const match = line.match(/(?<date>(?:\d{4}[./]\d{2}|\d{4})\s*-\s*(?:至今|Present|\d{4}[./]\d{2}|\d{4}))/ui);

    if (match?.groups?.date) {
      if (current) {
        entries.push(current);
      }

      const date = match.groups.date;
      const title = line.slice(0, match.index).trim() || "项目经历";
      const rest = line.slice((match.index ?? 0) + date.length).trim();
      current = {
        title: cleanResumeTitle(title),
        date,
        body: rest
      };
      continue;
    }

    if (current) {
      current.body = [current.body, line].filter(Boolean).join("\n");
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries.filter((entry) => `${entry.title}${entry.body}`.replace(/\s+/g, "").length >= 8);
}

function rewriteDatedEntryForJd(entry: DatedResumeEntry, jdText: string, focus: string) {
  const source = [entry.title, entry.body].filter(Boolean).join("\n");
  const relevance = scoreFactRelevance(source, jdText);
  const selectedLines = selectRelevantResumeLines(entry.body, jdText, relevance < 2 ? 1 : 3);
  const header = `${entry.title} ${entry.date}`.trim();

  if (selectedLines.length === 0) {
    return header;
  }

  if (relevance < 2) {
    return `${header}\n${selectedLines[0]}`;
  }

  return `${header}\n${selectedLines.map((line) => `- ${line}`).join("\n")}`;
}

function selectRelevantResumeLines(text: string, jdText: string, maxLines: number) {
  const lines = normalizeOcrResumeText(text)
    .split(/\r?\n/u)
    .flatMap((line) => line.split(/[；。]/u))
    .map((line) => cleanGeneratedResumeText(line).replace(/^[-•]\s*/u, "").trim())
    .filter((line) => line.length >= 8)
    .map((line, index) => ({
      line: shortenResumePhrase(line, 140),
      score: scoreFactRelevance(line, jdText) * 10 - index * 0.01
    }))
    .sort((left, right) => right.score - left.score);

  return lines.slice(0, maxLines).map((item) => item.line);
}

function cleanResumeTitle(title: string) {
  return cleanGeneratedResumeText(title)
    .replace(/[｜|]\s*$/u, "")
    .replace(/[，,、：:;；-]+$/u, "")
    .trim();
}

function deriveRewriteFocus(jdText: string) {
  const normalized = jdText.toLowerCase();

  if (normalized.includes("workflow") || jdText.includes("工作流")) {
    return "工作流设计、流程梳理和跨团队协作";
  }

  if (normalized.includes("content") || jdText.includes("内容")) {
    return "内容流程、模板化交付和质量控制";
  }

  if (normalized.includes("data") || jdText.includes("数据") || normalized.includes("analysis") || jdText.includes("分析")) {
    return "数据分析、复盘和结果表达";
  }

  if (normalized.includes("ai") || jdText.includes("AI")) {
    return "AI 工作流、提示词和产品推进";
  }

  if (normalized.includes("product") || jdText.includes("产品")) {
    return "需求拆解、方案推进和结果表达";
  }

  if (normalized.includes("user") || jdText.includes("用户")) {
    return "用户理解、需求拆解和沟通推进";
  }

  return "目标岗位要求的动作、结果和协作方式";
}

function scoreFactRelevance(fact: string, jdText: string) {
  const normalizedFact = fact.toLowerCase();
  const normalizedJd = jdText.toLowerCase();
  let score = 0;

  if (/(prompt|提示词|模型|对话|训练|数据生成|标注|评测)/i.test(normalizedJd) && /(prompt|提示词|模型|对话|训练|数据|生成|标注|评测|ai)/i.test(normalizedFact)) {
    score += 3;
  }

  if (/(产品|需求|原型|用户|迭代|prd|流程|工作流|agent)/i.test(normalizedJd) && /(产品|需求|原型|用户|迭代|prd|流程|工作流|agent|mvp)/i.test(normalizedFact)) {
    score += 3;
  }

  if (/(workflow|流程|clarity|delivery|交付)/i.test(normalizedJd) && /(workflow|flow|onboarding|clarity|delivery|trust|流程|交付|推进|信任)/i.test(normalizedFact)) {
    score += 2;
  }

  if (/(客户|交付|协作|沟通|方案|onboarding|续约)/i.test(normalizedJd) && /(客户|交付|协作|沟通|方案|服务|推介)/i.test(normalizedFact)) {
    score += 2;
  }

  return score;
}

function buildSuggestionCandidates(input: SuggestionSeedInput): SuggestionCandidate[] {
  if (input.calibratedResume?.entries?.length) {
    return input.calibratedResume.entries
      .map((entry) => calibratedEntryToSuggestionCandidate(entry))
      .filter((fact) => isRewritableSuggestionSection(fact.section))
      .filter((fact) => isSubstantiveFactText(fact.text));
  }

  return input.facts
    .filter((fact) => fact.sourceKind !== "target_role_fit")
    .flatMap((fact) => splitFactIntoSuggestionCandidates(fact))
    .filter((fact) => isRewritableSuggestionSection(fact.section))
    .filter((fact) => isSubstantiveFactText(fact.text));
}

function calibratedEntryToSuggestionCandidate(entry: CalibratedResumeProfile["entries"][number]): SuggestionCandidate {
  const text = [entry.title, entry.dateRange, ...(entry.bullets ?? [])].filter(Boolean).join("\n");
  const section = normalizeCalibratedEntrySection(entry.section);

  return {
    candidateId: entry.id,
    text,
    section,
    title: entry.title,
    sourceKind: "resume_baseline",
    sourceLabel: "结构校准结果",
    confidence: entry.confidence,
    issues: entry.issues
  };
}

function normalizeCalibratedEntrySection(section: CalibratedResumeProfile["entries"][number]["section"]): string {
  if (section === "summary") return "summary";
  if (section === "work") return "experience";
  if (section === "project") return "project";
  if (section === "education") return "education";
  if (section === "credential") return "credential";
  if (section === "personal_info") return "personal_info";
  return "other_needs_review";
}

function splitFactIntoSuggestionCandidates(fact: SuggestionSeedInput["facts"][number]): SuggestionCandidate[] {
  if (fact.sourceKind !== "resume_baseline") {
    return [fact];
  }

  const blocks = splitResumeTextIntoBlocks(fact.text);
  if (blocks.length === 0) {
    return [fact];
  }

  return blocks.map((block, index) => ({
    ...fact,
    title: block.title || fact.title || `简历段落 ${index + 1}`,
    section: block.section || fact.section,
    text: block.text
  }));
}

function splitResumeTextIntoBlocks(text: string) {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: Array<{ title: string; section: string; text: string }> = [];
  let currentTitle = "简历抬头";
  let currentSection = "profile";
  let currentLines: string[] = [];
  let sawHeading = false;

  for (const line of lines) {
    const heading = classifyResumeHeading(line);
    if (heading) {
      sawHeading = true;
      pushCurrentBlock(blocks, currentTitle, currentSection, currentLines);
      currentTitle = heading.title;
      currentSection = heading.section;
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  pushCurrentBlock(blocks, currentTitle, currentSection, currentLines);

  if (!sawHeading && text.trim()) {
    return [{ title: "简历原文", section: "summary", text: text.trim() }];
  }

  return blocks.filter((block) => block.section !== "profile").slice(0, 6);
}

function classifyResumeHeading(line: string) {
  const normalized = line.replace(/\s+/g, "");

  if (/^(个人概述|个人总结|自我评价|个人优势|简介|优势档案|核心优势)$/u.test(normalized)) {
    return { title: "个人优势", section: "summary" };
  }

  if (/^(工作经历|实习经历|职业经历|任职经历|工作经验|工作履历)$/u.test(normalized)) {
    return { title: "工作经历", section: "experience" };
  }

  if (/^(项目经历|项目经验|作品集|代表项目|个人项目|核心项目)$/u.test(normalized)) {
    return { title: "项目经历", section: "project" };
  }

  if (/^(教育经历|教育背景|学历背景|教育信息|毕业院校|学习经历)$/u.test(normalized)) {
    return { title: "教育背景", section: "education" };
  }

  if (/^(技能与证书|技能证书|专业技能|技能|证书|语言能力)$/u.test(normalized)) {
    return { title: "技能与证书", section: "credential" };
  }

  return null;
}

function isRewritableSuggestionSection(section?: string) {
  const normalized = (section ?? "").toLowerCase().replace(/\s+/g, "");
  return normalized === "summary" || normalized === "work" || normalized === "experience" || normalized === "project";
}

function pushCurrentBlock(
  blocks: Array<{ title: string; section: string; text: string }>,
  title: string,
  section: string,
  lines: string[]
) {
  const text = lines.join("\n").trim();
  if (text) {
    blocks.push({ title, section, text });
  }
}

function isSubstantiveFactText(text: string) {
  const normalized = text.replace(/\s+/g, "");
  return normalized.length >= 12 && !normalized.includes("暂无提取到的简历内容");
}

function getRewriteLead(text: string, maxLength = 96) {
  const compact = text.replace(/\s+/g, " ").trim();
  const withoutNameLine = compact
    .split(/(?=个人概述|工作经历|项目经历|教育经历)/u)
    .filter(Boolean)[0] ?? compact;
  const shortened = shortenResumePhrase(withoutNameLine, maxLength);

  if (/[\u4e00-\u9fa5]/u.test(shortened)) {
    return shortened;
  }

  return `基于原始经历「${shortened}」进行中文化表达`;
}

function shortenResumePhrase(text: string, maxLength: number) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const cutAt = Math.max(
    cleaned.lastIndexOf("，", maxLength),
    cleaned.lastIndexOf("；", maxLength),
    cleaned.lastIndexOf("。", maxLength),
    cleaned.lastIndexOf(" ", maxLength)
  );
  const end = cutAt >= Math.floor(maxLength * 0.55) ? cutAt : maxLength;
  return cleaned.slice(0, end).replace(/[，；。\s]+$/u, "");
}
