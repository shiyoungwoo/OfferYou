import { callModelJSON } from "@/lib/ai/model-gateway";
import {
  excerptTalentEvidence,
  listTalentAnswerEntries,
  type TalentProfile,
  type TalentProfileGenerationResult,
  type TalentPromptAnswers
} from "@/lib/services/talent/talent-profile";

type ModelTalentProfileOutput = {
  headline: string;
  summary: string;
  signals: Array<{
    key: string;
    label: string;
    description: string;
    evidence: string[];
  }>;
  workStyle: string[];
  suitableDirections: string[];
  cautionNotes: string[];
  confidenceNote: string;
  talentManual?: string;
};

export const talentExcavationSystemPrompt = [
  "你是「深度天赋挖掘机」。你结合盖洛普优势理论、心流理论与荣格心理学做职业咨询。",
  "",
  "核心信念：",
  "- 天赋不是具体技能，而是可迁移的底层能力。",
  "- 天赋不会过期，任务是帮助候选人找到底层天赋。",
  "- 真正的天赋往往体现在无意识胜任、能量回血、早期未被规训的倾向，以及嫉妒背后的被压抑方向。",
  "",
  "严格规则：",
  "- 只能基于候选人的真实回答生成判断，不编造经历、成就、公司、学历或指标。",
  "- 保持温暖、专业、共情，但不要空泛鼓励。",
  "- 输出要有证据，避免给用户贴死标签。",
  "- 如果信息不足，要明确说可信度仍早期。",
  "- 输出合法 JSON，不要 Markdown。"
].join("\n");

export async function buildTalentProfileWithModel(
  answers: TalentPromptAnswers
): Promise<TalentProfileGenerationResult> {
  const answerEntries = listTalentAnswerEntries(answers);

  const systemPrompt = [
    talentExcavationSystemPrompt,
    "",
    "生成结构化 TalentProfile：",
    "- 识别 3 到 5 条个人优势信号，每条需有证据。",
    "- 每条信号用一个英文 key 标识（如 clarity_builder、ownership_runner）。",
    "- talentManual 输出一份中文《个人天赋使用说明书》，需要包含底层天赋假设、证据、适合环境、不适合环境、职业方向建议和使用提醒。"
  ].join("\n");

  const userPrompt = [
    "候选人回答：",
    ...answerEntries.map((entry, i) => `${i + 1}. ${entry}`),
    "",
    `请输出 JSON：{ "headline": string, "summary": string, "signals": Array<{ "key": string, "label": string, "description": string, "evidence": string[] }>, "workStyle": string[], "suitableDirections": string[], "cautionNotes": string[], "confidenceNote": string, "talentManual": string }`
  ].join("\n");

  const result = await callModelJSON<ModelTalentProfileOutput>({
    systemPrompt,
    userPrompt,
    task: "talent"
  });

  if (!result.data?.headline || !result.data.signals?.length) {
    throw new Error("Model returned empty talent profile.");
  }

  const profile: TalentProfile = {
    headline: result.data.headline,
    summary: result.data.summary ?? "",
    signals: result.data.signals.slice(0, 5).map((signal) => ({
      key: signal.key,
      label: signal.label,
      description: signal.description ?? "",
      evidence: (signal.evidence ?? []).map(excerptTalentEvidence)
    })),
    workStyle: result.data.workStyle ?? [],
    suitableDirections: result.data.suitableDirections ?? [],
    cautionNotes: result.data.cautionNotes ?? [],
    confidenceNote: result.data.confidenceNote ?? "",
    talentManual: result.data.talentManual
  };

  return {
    profile,
    generationMode: result.generationMode as TalentProfileGenerationResult["generationMode"],
    riskNotes: result.fallbackReason ? [result.fallbackReason] : undefined,
    modelProvider: result.provider
  };
}
