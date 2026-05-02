import { callModelJSON } from "@/lib/ai/model-gateway";
import { getDefaultModelProvider } from "@/lib/ai/model-provider-config";
import { buildJDInsight, buildRewriteStrategy } from "@/lib/services/analysis/jd-insight";
import { generateSeedSuggestions, generateAISuggestions } from "@/lib/services/analysis/suggestion-generator";
import type { CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";
import type { JDInsight, RewriteStrategy } from "@/lib/services/job-apply/agent-run";
import fs from "node:fs";
import path from "node:path";

export type AnalysisInput = {
  company?: string;
  jobTitle?: string;
  jdText: string;
  talentProfile?: {
    headline: string;
    confidenceNote: string;
  };
  careerDirection?: {
    label: string;
    rationale: string;
  };
  facts: Array<{
    text: string;
    section?: string;
    title?: string;
    sourceKind?: "resume_baseline" | "master_fact" | "target_role_fit";
    sourceLabel?: string;
  }>;
  calibratedResume?: CalibratedResumeProfile;
};

export type AnalysisResult = {
  fitScore: number;
  optimizationMode: "baseline_jd_match" | "talent_amplified";
  strengths: string[];
  gaps: string[];
  riskNotes: string[];
  jdInsight: JDInsight;
  rewriteStrategy: RewriteStrategy;
  suggestions: ReturnType<typeof generateSeedSuggestions>;
};

// Gemini JSON response shape
type GeminiAnalysisResponse = {
  fitScore: number;
  strengths: string[];
  gaps: string[];
  keywordsToBridge: string[];
  riskNotes: string[];
};

function loadSystemPrompt(): string {
  const promptPath = path.join(process.cwd(), "prompts", "gap_analysis.md");
  try {
    return fs.readFileSync(promptPath, "utf-8");
  } catch {
    return `You are a Senior Technical Recruiter. Compare the candidate's background against the Job Description.
Return JSON: { "fitScore": 0-100, "strengths": ["..."], "gaps": ["..."], "keywordsToBridge": ["..."], "riskNotes": ["..."] }`;
  }
}

function buildUserPrompt(input: AnalysisInput): string {
  const factBlocks = input.facts
    .map((f, i) => `[Fact ${i + 1}] ${f.title || f.section || "Block"}: ${f.text}`)
    .join("\n");

  let prompt = `## Job Description\n${input.jdText}\n\n## Candidate Facts\n${factBlocks}`;

  if (input.talentProfile) {
    prompt += `\n\n## Talent Profile\nHeadline: ${input.talentProfile.headline}\nNote: ${input.talentProfile.confidenceNote}`;
  }

  if (input.careerDirection) {
    prompt += `\n\n## Career Direction\nTarget: ${input.careerDirection.label}\nRationale: ${input.careerDirection.rationale}`;
  }

  prompt += `\n\n## Required Output Format (JSON)
{
  "fitScore": <number 0-100>,
  "strengths": ["<3-5 evidence-based strength statements in Chinese>"],
  "gaps": ["<3-5 specific gap statements referencing JD requirements in Chinese>"],
  "keywordsToBridge": ["<5-10 terms from JD missing in resume wording in Chinese or English as appropriate>"],
  "riskNotes": ["<any distortion risks or evidence gaps in Chinese>"]
}

CRITICAL INSTRUCTION: All text values in the JSON output (strengths, gaps, riskNotes) MUST be written in Chinese (中文).`;

  return prompt;
}

/**
 * AI-powered analysis using Gemini API.
 * Falls back to deterministic analysis if Gemini is unavailable or fails.
 */
export async function analyzeDraft(input: AnalysisInput): Promise<AnalysisResult> {
  const hasTalentProfile = Boolean(input.talentProfile);
  const optimizationMode = hasTalentProfile ? "talent_amplified" : "baseline_jd_match";
  const provider = getDefaultModelProvider();
  const systemPrompt = loadSystemPrompt();
  const userPrompt = buildUserPrompt(input);

  const response = await callModelJSON<GeminiAnalysisResponse>({
    systemPrompt,
    userPrompt,
    provider,
    fallbackFactory: () => buildDeterministicAnalysisResponse(input, optimizationMode)
  });

  if (!response.data) {
    return analyzeDraftDeterministic(input, optimizationMode, response.fallbackReason);
  }

  const normalizedResponse = normalizeGeminiAnalysisResponse(response.data);
  const riskNotes = mergeRiskNotes(normalizedResponse.riskNotes, response.fallbackReason);
  const jdInsight = buildJDInsight({
    jdText: input.jdText,
    company: input.company,
    jobTitle: input.jobTitle,
    gaps: normalizedResponse.gaps,
    keywordsToBridge: normalizedResponse.keywordsToBridge
  });
  const rewriteStrategy = buildRewriteStrategy(jdInsight);
  const suggestions =
    response.provider !== "deterministic_fallback"
      ? await generateAISuggestions(
          {
            jdText: input.jdText,
            company: input.company,
            jobTitle: input.jobTitle,
            talentHeadline: input.talentProfile?.headline,
            selectedCareerDirectionLabel: input.careerDirection?.label,
            facts: input.facts,
            calibratedResume: input.calibratedResume,
            gaps: normalizedResponse.gaps,
            keywordsToBridge: normalizedResponse.keywordsToBridge,
            jdInsight,
            rewriteStrategy
          },
          { modelProvider: response.provider }
        )
      : generateSeedSuggestions(input);

  return {
    fitScore: normalizedResponse.fitScore,
    optimizationMode,
    strengths: normalizedResponse.strengths,
    gaps: normalizedResponse.gaps,
    riskNotes,
    jdInsight,
    rewriteStrategy,
    suggestions
  };
}

// ─── Original deterministic logic (kept as fallback) ───

const positiveSignals = [
  "ai", "product", "workflow", "system", "user", "prompt", "automation", "design"
];

function analyzeDraftDeterministic(
  input: AnalysisInput,
  optimizationMode: "baseline_jd_match" | "talent_amplified",
  fallbackReason?: string
): AnalysisResult {
  const deterministic = buildDeterministicAnalysisResponse(input, optimizationMode);
  const jdInsight = buildJDInsight({
    jdText: input.jdText,
    company: input.company,
    jobTitle: input.jobTitle,
    gaps: deterministic.gaps,
    keywordsToBridge: deterministic.keywordsToBridge
  });
  const rewriteStrategy = buildRewriteStrategy(jdInsight);
    const suggestions = generateSeedSuggestions({
      jdText: input.jdText,
      company: input.company,
      jobTitle: input.jobTitle,
      talentHeadline: input.talentProfile?.headline,
      selectedCareerDirectionLabel: input.careerDirection?.label,
      facts: input.facts,
      calibratedResume: input.calibratedResume,
    });

  return {
    fitScore: deterministic.fitScore,
    optimizationMode,
    strengths: deterministic.strengths,
    gaps: deterministic.gaps,
    riskNotes: mergeRiskNotes(deterministic.riskNotes, fallbackReason),
    jdInsight,
    rewriteStrategy,
    suggestions
  };
}

function buildDeterministicAnalysisResponse(
  input: AnalysisInput,
  optimizationMode: "baseline_jd_match" | "talent_amplified"
): GeminiAnalysisResponse {
  const normalizedJd = input.jdText.toLowerCase();
  const normalizedFacts = input.facts.map((f) => f.text.toLowerCase()).join(" ");
  const matchedSignals = positiveSignals.filter(
    (s) => normalizedJd.includes(s) && normalizedFacts.includes(s)
  );
  const hasTalentProfile = optimizationMode === "talent_amplified";
  const talentBonus = hasTalentProfile ? 6 : 0;
  const directionBonus = input.careerDirection ? 4 : 0;

  const fitScore = Math.min(
    94,
    48 + matchedSignals.length * 7 + Math.min(input.facts.length, 4) * 3 + talentBonus + directionBonus
  );

  const strengths = [
    matchedSignals.length > 0
      ? `在这些关键词上具有高匹配度: ${matchedSignals.slice(0, 4).join(", ")}。`
      : "当前的经历包含了相关信号，但需要更紧密地向 JD 靠拢。",
    hasTalentProfile
      ? "已确认的优势档案改变了优化目标：我们将重点突出那些能让你发挥天然优势的工作内容。"
      : "当前提供的信息已经初步具备结构化思维和体系化设计的特征。",
    ...(input.careerDirection
      ? [`你选择的职业方向（${input.careerDirection.label}）为简历提供了更清晰的叙事主轴。`]
      : [])
  ];

  const gaps = [
    hasTalentProfile
      ? "简历还需要增加一到两个能明确体现你的核心优势的经历要点。"
      : normalizedJd.includes("metrics")
        ? "简历缺乏明确的、可量化的结果和指标数据支撑。"
        : "简历仍需要增加一到两项更清晰的结果描述。",
    hasTalentProfile
      ? "不要让关于优势的描述显得太空泛，必须有事实做支撑。"
      : normalizedJd.includes("manager")
        ? "需要更明确地体现你的领导力和跨部门协作影响力。"
        : "需要强化职位匹配度，让最前面的经历更贴近目标岗位的核心职责。"
  ];

  const riskNotes = [
    "AI 分析暂不可用，当前结果来自确定性规则，仅供参考。",
    "不要为了迎合职位要求而过度包装，避免虚假陈述。",
    "每一条改写建议都必须有原始事实作为依据。",
  ];

  return {
    fitScore,
    strengths,
    gaps,
    keywordsToBridge: extractKeywordsToBridge(input.jdText, input.facts),
    riskNotes
  };
}

function normalizeGeminiAnalysisResponse(response: GeminiAnalysisResponse): GeminiAnalysisResponse {
  return {
    fitScore: clamp(response.fitScore, 0, 100),
    strengths: Array.isArray(response.strengths) ? response.strengths : [],
    gaps: Array.isArray(response.gaps) ? response.gaps : [],
    keywordsToBridge: Array.isArray(response.keywordsToBridge) ? response.keywordsToBridge : [],
    riskNotes: Array.isArray(response.riskNotes) ? response.riskNotes : [
      "这是 AI 生成的初步分析，请结合实际经历核实验证所有信息。",
    ]
  };
}

function extractKeywordsToBridge(jdText: string, facts: AnalysisInput["facts"]) {
  const normalizedJd = jdText.toLowerCase();
  const factText = facts.map((fact) => fact.text.toLowerCase()).join(" ");
  return positiveSignals.filter((signal) => normalizedJd.includes(signal) && !factText.includes(signal)).slice(0, 6);
}

function mergeRiskNotes(riskNotes: string[], fallbackReason?: string) {
  if (!fallbackReason) {
    return riskNotes;
  }

  const normalizedReason = `模型降级原因：${fallbackReason}`;
  if (riskNotes.includes(normalizedReason)) {
    return riskNotes;
  }

  return [...riskNotes, normalizedReason];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
