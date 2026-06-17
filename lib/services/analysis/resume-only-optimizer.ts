import { callModelJSON } from "@/lib/ai/model-gateway";
import { getDefaultModelProvider, type ModelProviderKey } from "@/lib/ai/model-provider-config";
import { cleanGeneratedResumeText, normalizeOcrResumeText } from "@/lib/services/analysis/text-cleaner";
import type { CalibratedResumeEntry, CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";
import type { GenerationMode } from "@/lib/services/job-apply/agent-run";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";

type ResumeOnlyOptimizationInput = {
  profile: CalibratedResumeProfile;
  targetTitle?: string;
  talentHeadline?: string;
  modelProvider?: ModelProviderKey;
};

type ResumeOnlyOptimizationResult = {
  suggestions: PersistedWorkspaceDraft["suggestions"];
  generationMode: GenerationMode | "none";
  modelProvider: ModelProviderKey;
  fallbackReason?: string;
};

type ResumeOnlyModelResponse = {
  suggestions: Array<{
    candidateId?: string;
    title?: string;
    after?: string;
    reason?: string;
    factAnchors?: string[];
  }>;
};

type ResumeOnlyCandidate = {
  id: string;
  section: "summary" | "experience" | "project";
  title: string;
  text: string;
};

export async function generateResumeOnlyOptimizationSuggestions(
  input: ResumeOnlyOptimizationInput
): Promise<ResumeOnlyOptimizationResult> {
  const provider = input.modelProvider ?? getDefaultModelProvider("rewrite");
  if (provider === "deterministic_fallback") {
    return {
      suggestions: [],
      generationMode: "none",
      modelProvider: "deterministic_fallback",
      fallbackReason: "当前模型不可用，已进入基础编辑模式；不会生成伪 AI 优化建议。"
    };
  }

  const candidates = buildResumeOnlyCandidates(input.profile);
  if (candidates.length === 0) {
    return {
      suggestions: [],
      generationMode: "none",
      modelProvider: provider,
      fallbackReason: "简历中没有可优化的个人优势、工作经历或项目经历。"
    };
  }

  const userPrompt = `请优化一份已有简历。目标不是投递某家公司，也不是按 JD 定制，而是在不新增事实的前提下，把表达改成更清晰、更有结果导向、更适合后续求职使用的版本。

候选目标岗位：${input.targetTitle || "未指定"}
${input.talentHeadline ? `已确认优势画像：${input.talentHeadline}` : ""}

可优化候选块：
${candidates.map((candidate, index) => `[${index + 1}] candidateId=${candidate.id} section=${candidate.section} title=${candidate.title}\n${candidate.text}`).join("\n\n")}

输出规则：
1. 只能优化 summary、experience、project 这三类候选块。
2. 必须保留原事实，不得新增公司、学历、时间、指标、项目成果。
3. after 必须是可直接放入简历的中文正文，不要写「建议」或解释。
4. after 不允许出现省略号。
5. 如果原文事实不足，只做结构和语言清理，不要强行包装。
6. 每条建议必须带 candidateId。

JSON 格式：
{
  "suggestions": [
    {
      "candidateId": "候选块 ID",
      "title": "简短标题",
      "after": "优化后的简历正文",
      "reason": "为什么这样优化",
      "factAnchors": ["来自原文的事实锚点"]
    }
  ]
}`;

  const result = await callModelJSON<ResumeOnlyModelResponse>({
    task: "rewrite",
    provider,
    systemPrompt: "你是克制、事实优先的中文简历编辑。只优化表达和结构，不编造事实。",
    userPrompt,
    fallbackFactory: () => null
  });

  if (!result.data?.suggestions?.length || result.provider === "deterministic_fallback") {
    return {
      suggestions: [],
      generationMode: "none",
      modelProvider: result.provider,
      fallbackReason: result.fallbackReason ?? "模型没有返回可用的简历优化建议，已进入基础编辑模式。"
    };
  }

  const suggestions = result.data.suggestions
    .flatMap((suggestion, index) => {
      const candidate = resolveCandidate(suggestion.candidateId, candidates, index);
      if (!candidate) return [];
      const afterText = normalizeResumeOnlyAfterText(suggestion.after ?? "");
      if (!afterText) return [];

      return [{
        id: `resume-ai-${index + 1}`,
        candidateId: candidate.id,
        section: candidate.section,
        title: suggestion.title?.trim() || candidate.title,
        beforeText: candidate.text,
        afterText,
        reasonText: suggestion.reason?.trim() || "在不改变事实的前提下，提升简历表达的清晰度和结果导向。",
        status: "pending" as const,
        sourceKind: "resume_baseline" as const,
        sourceLabel: getResumeOnlySourceLabel(result.provider),
        generationMode: result.generationMode ?? "model",
        modelProvider: result.provider,
        jdAbility: "通用简历表达优化",
        factAnchors: Array.isArray(suggestion.factAnchors) && suggestion.factAnchors.length
          ? suggestion.factAnchors.map((anchor) => cleanGeneratedResumeText(anchor)).filter(Boolean).slice(0, 3)
          : deriveFactAnchors(candidate.text),
        revisionRound: 0
      }];
    })
    .slice(0, 6);

  return {
    suggestions,
    generationMode: result.generationMode ?? "model",
    modelProvider: result.provider
  };
}

function buildResumeOnlyCandidates(profile: CalibratedResumeProfile): ResumeOnlyCandidate[] {
  return profile.entries
    .filter((entry) => entry.section === "summary" || entry.section === "work" || entry.section === "project")
    .map((entry) => {
      const section = mapResumeOnlySection(entry);
      const text = entryToText(entry);
      return section && text
        ? {
            id: entry.id,
            section,
            title: entry.title || getSectionTitle(section),
            text
          }
        : null;
    })
    .filter((candidate): candidate is ResumeOnlyCandidate => Boolean(candidate));
}

function mapResumeOnlySection(entry: CalibratedResumeEntry): ResumeOnlyCandidate["section"] | null {
  if (entry.section === "summary") return "summary";
  if (entry.section === "work") return "experience";
  if (entry.section === "project") return "project";
  return null;
}

function entryToText(entry: CalibratedResumeEntry) {
  return normalizeOcrResumeText(
    [
      [entry.title, entry.role, entry.dateRange].filter(Boolean).join(" | "),
      ...(entry.bullets ?? [])
    ].filter(Boolean).join("\n")
  );
}

function resolveCandidate(candidateId: string | undefined, candidates: ResumeOnlyCandidate[], index: number) {
  if (candidateId) {
    const explicit = candidates.find((candidate) => candidate.id === candidateId);
    if (explicit) return explicit;
  }

  return candidates[index];
}

function normalizeResumeOnlyAfterText(text: string) {
  return cleanGeneratedResumeText(text)
    .replace(/(?:\.{3}|…)+/gu, "")
    .replace(/^建议(?:改为|写成|调整为)?[:：]?\s*/u, "")
    .trim();
}

function deriveFactAnchors(text: string) {
  return text
    .split(/[\n。；;]+/u)
    .map((line) => cleanGeneratedResumeText(line).trim())
    .filter((line) => line.length >= 6)
    .slice(0, 3);
}

function getSectionTitle(section: ResumeOnlyCandidate["section"]) {
  if (section === "summary") return "个人优势";
  if (section === "experience") return "工作经历";
  return "项目经历";
}

function getResumeOnlySourceLabel(provider: ModelProviderKey) {
  if (provider === "openai_compatible") return "AI 简历优化建议";
  if (provider === "gemini") return "Gemini 简历优化建议";
  return "简历优化建议";
}
