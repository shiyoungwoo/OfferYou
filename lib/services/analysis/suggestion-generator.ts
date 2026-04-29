import { callModelJSON } from "@/lib/ai/model-gateway";
import { getDefaultModelProvider, type ModelProviderKey } from "@/lib/ai/model-provider-config";
import { checkFactGrounding } from "@/lib/services/quality/fact-grounding";
import { scoreSuggestionQuality } from "@/lib/services/quality/suggestion-quality";
import { cleanGeneratedResumeText, normalizeOcrResumeText } from "@/lib/services/analysis/text-cleaner";
import type { CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";
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
  }>;
};

type SuggestionCandidate = SuggestionSeedInput["facts"][number] & {
  candidateId?: string;
  confidence?: "high" | "medium" | "low";
  issues?: string[];
};

function loadRewritePrompt(): string {
  const promptPath = path.join(process.cwd(), "prompts", "rewrite_expert.md");
  try {
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
  const provider = options.modelProvider ?? getDefaultModelProvider();

  if (provider === "deterministic_fallback") {
    return generateSeedSuggestions(input);
  }

  try {
    const systemPrompt = loadRewritePrompt();

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
      "reason": "Explain why this change is needed based on specific JD requirements. If the JD requires a skill (e.g. 'Data Analysis') that is missing in this block, state: '【JD 缺失能力提醒】：JD 要求 X，简历未体现，建议补充 Y' followed by the rationale."
    }
  ]
}

Resume rewrite rules:
1. Provide ACTUAL CONTENT in the "after" field. Avoid phrases like "建议在此增加..." or "这段经历相关性较弱". Instead, write what the revised text should actually look like.
2. For each suggestion, link it to a specific requirement in the JD. Explain the "Why" using JD keywords.
3. If the JD requires a competency that the user has NOT mentioned, use the "reason" field to provide a clear "Gap Reminder" (缺失能力提醒) and tell them exactly what kind of fact or action they should add to this section to bridge the gap.
4. Follow STAR principles (Situation, Task, Action, Result) for "after" text.
5. If a candidate has low calibration confidence, do not fabricate a投递版 rewrite. Keep the description conservative and focus on structure confirmation.
6. All output (title, after, reason) MUST be in Chinese (中文).
7. Include candidateId when you can map a suggestion to a specific candidate.`;

    const result = await callModelJSON<GeminiSuggestionResponse>({
      systemPrompt,
      userPrompt,
      provider,
      fallbackFactory: () => null
    });

    if (result.data?.suggestions && Array.isArray(result.data.suggestions) && result.data.suggestions.length > 0) {
      return result.data.suggestions.map((s, i) =>
        reviewSuggestion(
          {
            id: `ai-${i + 1}`,
            candidateId: s.candidateId,
            section: s.section || "experience",
            title: s.title || `AI Suggestion ${i + 1}`,
            beforeText: s.before,
            afterText: s.after,
            reasonText: s.reason,
            status: "pending" as const,
            revisionRound: 0,
            sourceKind: "resume_baseline" as const,
            sourceLabel: "AI 改写建议"
          },
          input
        )
      );
    }
  } catch {
    return generateSeedSuggestions(input);
  }

  return generateSeedSuggestions(input);
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

      return reviewSuggestion(
        {
          id: `seed-${index + 1}`,
          candidateId: fact.candidateId,
          section: fact.section ?? "experience",
          title: fact.title ?? `改写建议 ${index + 1}`,
          beforeText: fact.text,
          afterText: rewrite.after,
          reasonText: rewrite.reason,
          status: "pending",
          revisionRound: 0,
          sourceKind: fact.sourceKind ?? "resume_baseline",
          sourceLabel: fact.sourceLabel ?? getDefaultSourceLabel(fact.sourceKind),
        },
        input
      );
    });
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
    fact.section === "summary" ? 0.5 : 0;
  return {
    fact,
    score: relevance * 10 + sectionScore - index * 0.01
  };
}

function reviewSuggestion(suggestion: SuggestionSeed, input: SuggestionSeedInput): SuggestionSeed {
  const keywords = "keywordsToBridge" in input ? ((input as AIGeneratorInput).keywordsToBridge as string[]) : extractKeywords(input.jdText);
  const quality = scoreSuggestionQuality({
    beforeText: suggestion.beforeText,
    afterText: suggestion.afterText,
    reasonText: suggestion.reasonText,
    keywords
  });
  const grounding = checkFactGrounding({
    beforeText: suggestion.beforeText,
    afterText: suggestion.afterText,
    reasonText: suggestion.reasonText,
    jdText: input.jdText,
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

  const notes = [...quality.notes, ...grounding.riskNotes];
  if (notes.length === 0) {
    return suggestion;
  }

  return {
    ...suggestion,
    reasonText: `${suggestion.reasonText}；质量提示：${notes.join("；")}`
  };
}

function extractKeywords(text: string) {
  return text
    .split(/[\s,，;；、/]+/u)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length >= 2)
    .slice(0, 8);
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
      line: shortenResumePhrase(line, 86),
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
      .filter((fact) => isSubstantiveFactText(fact.text));
  }

  return input.facts
    .filter((fact) => fact.sourceKind !== "target_role_fit")
    .flatMap((fact) => splitFactIntoSuggestionCandidates(fact))
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
  if (section === "project") return "project";
  if (section === "education") return "education";
  if (section === "work") return "experience";
  return "experience";
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

  return null;
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
  return `${cleaned.slice(0, end).replace(/[，；。\s]+$/u, "")}…`;
}
