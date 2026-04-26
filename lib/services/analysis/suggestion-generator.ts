import { callModelJSON } from "@/lib/ai/model-gateway";
import { getDefaultModelProvider, type ModelProviderKey } from "@/lib/ai/model-provider-config";
import { checkFactGrounding } from "@/lib/services/quality/fact-grounding";
import { scoreSuggestionQuality } from "@/lib/services/quality/suggestion-quality";
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
    section: string;
    title: string;
    before: string;
    after: string;
    reason: string;
  }>;
};

function loadRewritePrompt(): string {
  const promptPath = path.join(process.cwd(), "prompts", "rewrite_expert.md");
  try {
    return fs.readFileSync(promptPath, "utf-8");
  } catch {
    return `You are a Professional Resume Consultant specializing in the STAR method.
For each experience block, provide Before/After/Reason optimization.
Never add facts the user didn't provide. Use strong action verbs. Focus on results.`;
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

    const factBlocks = input.facts
      .filter((f) => f.sourceKind !== "target_role_fit")
      .slice(0, 5)
      .map((f, i) => `[Block ${i + 1}] ${f.title || f.section || "Experience"}: ${f.text}`)
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
      "after": "The optimized rewrite — must not add unverified facts",
      "reason": "Why this change improves JD alignment"
    }
  ]
}

Resume rewrite rules:
1. Follow this section logic: personal information, personal strengths, work experience, project experience, education, optional skills only when strongly relevant.
2. Work experience must preserve company, role, and time. If an experience is weakly related to the target JD, shorten it aggressively and keep only the timeline plus one transferable point at most.
3. Project experience must explain background, responsibility, key actions, and result only when the source block supports those facts.
4. Personal strengths should be 3-5 verifiable, Chinese, role-facing statements. Do not output English talent-profile prose.
5. Prefer one-page A4 output. Do not produce long paragraphs. Each after text should usually be 1-2 compact sentences or 2-3 short bullets.

Generate 1-5 suggestions if there are actual experiences to rewrite. If the Candidate Experience Blocks contain NO substantive experience (e.g., they only say "暂无提取到的简历内容"), you MUST return an empty array \`[]\` for suggestions. Do NOT hallucinate or make up fake experiences under any circumstances. Each "before" must quote actual text from the blocks above.
CRITICAL INSTRUCTION: All output text values (title, before, after, reason) MUST be written in Chinese (中文).`;

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
    .map(({ fact }, index) =>
      reviewSuggestion(
        {
          id: `seed-${index + 1}`,
          section: fact.section ?? "experience",
          title: fact.title ?? `改写建议 ${index + 1}`,
          beforeText: fact.text,
          afterText: rewriteFactForJd(fact.text, input.jdText, {
            talentHeadline: input.talentHeadline,
            selectedCareerDirectionLabel: input.selectedCareerDirectionLabel,
            sourceKind: fact.sourceKind,
          }),
          reasonText: getReasonText({
            hasTalentProfile: Boolean(input.talentHeadline),
            sourceKind: fact.sourceKind,
          }),
          status: "pending",
          revisionRound: 0,
          sourceKind: fact.sourceKind ?? "resume_baseline",
          sourceLabel: fact.sourceLabel ?? getDefaultSourceLabel(fact.sourceKind),
        },
        input
      )
    );
}

function rankSuggestionCandidate(
  fact: SuggestionSeedInput["facts"][number],
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

function rewriteFactForJd(
  fact: string,
  jdText: string,
  context?: {
    talentHeadline?: string;
    selectedCareerDirectionLabel?: string;
    sourceKind?: SuggestionSeedInput["facts"][number]["sourceKind"];
  }
) {
  const focus = deriveRewriteFocus(jdText);
  const relevance = scoreFactRelevance(fact, jdText);
  const hasTalentProfile = Boolean(context?.talentHeadline);
  const directionLabel = context?.selectedCareerDirectionLabel;
  const cleanedFact = fact.trim().replace(/[。．\.！!？?]+$/u, "");
  const rewriteLead = getRewriteLead(cleanedFact, relevance < 2 ? 52 : 96);
  const focusCopy = `围绕${focus}`;

  if (relevance < 2) {
    return `这段经历与目标 JD 相关性较弱，建议仅保留时间、机构和岗位信息，并用一句话点出可迁移能力：${rewriteLead}。`;
  }

  if (context?.sourceKind === "master_fact") {
    return `${focusCopy}，${rewriteLead}，保留原有事实基础并突出可迁移能力。`;
  }
  if (hasTalentProfile && directionLabel) {
    return `${focusCopy}，${rewriteLead}，并将这段经历连接到 ${directionLabel} 的岗位叙事。`;
  }
  if (hasTalentProfile) {
    return `${focusCopy}，${rewriteLead}，让真实经历中的优势、动作和结果更容易被识别。`;
  }
  return `${focusCopy}，${rewriteLead}，强化这段经历与目标岗位职责之间的对应关系。`;
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

function buildSuggestionCandidates(input: SuggestionSeedInput) {
  return input.facts
    .filter((fact) => fact.sourceKind !== "target_role_fit")
    .flatMap((fact) => splitFactIntoSuggestionCandidates(fact))
    .filter((fact) => isSubstantiveFactText(fact.text));
}

function splitFactIntoSuggestionCandidates(fact: SuggestionSeedInput["facts"][number]) {
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

  return blocks.filter((block) => block.section !== "education" && block.section !== "profile").slice(0, 5);
}

function classifyResumeHeading(line: string) {
  const normalized = line.replace(/\s+/g, "");

  if (/^(个人概述|个人总结|自我评价|个人优势|简介)$/u.test(normalized)) {
    return { title: "个人优势", section: "summary" };
  }

  if (/^(工作经历|实习经历|职业经历|任职经历)$/u.test(normalized)) {
    return { title: "工作经历", section: "experience" };
  }

  if (/^(项目经历|项目经验|作品集|代表项目)$/u.test(normalized)) {
    return { title: "项目经历", section: "project" };
  }

  if (/^(教育经历|教育背景|学历背景)$/u.test(normalized)) {
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
