import { callModelJSON } from "@/lib/ai/model-gateway";
import {
  buildTalentProfileWithModel,
  talentExcavationSystemPrompt
} from "@/lib/services/talent/talent-profile-model";
import { buildTalentProfile, normalizeTalentExcavationTurns } from "@/lib/services/talent/talent-profile";
import type {
  TalentExcavationTurn,
  TalentProfile,
  TalentProfileGenerationResult,
  TalentPromptAnswers
} from "@/lib/services/talent/talent-profile";

export type TalentExcavationAnchor =
  | "early_memory"
  | "unconscious_competence"
  | "energy_audit"
  | "jealousy_signal"
  | "follow_up";

export type TalentExcavationNextQuestion = {
  type: "question";
  question: string;
  reflection: string;
  requiredAnchor: TalentExcavationAnchor;
  progress: {
    current: number;
    max: number;
    canFinalize: boolean;
  };
  generationMode: TalentProfileGenerationResult["generationMode"];
  modelProvider?: string;
  riskNotes?: string[];
};

export type TalentExcavationFinalResult = {
  type: "final";
  profile: TalentProfile;
  talentManual: string;
  generationMode: TalentProfileGenerationResult["generationMode"];
  modelProvider?: string;
  riskNotes?: string[];
};

type ModelNextQuestionOutput = {
  reflection: string;
  question: string;
  requiredAnchor: TalentExcavationAnchor;
  canFinalize: boolean;
};

const maxDeepQuestionCount = 10;

const requiredAnchors: TalentExcavationAnchor[] = [
  "early_memory",
  "unconscious_competence",
  "energy_audit",
  "jealousy_signal"
];

const fallbackQuestions: Record<TalentExcavationAnchor, string> = {
  early_memory: "16 岁以前，在没人要求你的情况下，有哪些事情会反复去做？或者从小到大常被说成缺点的固执习惯是什么？",
  unconscious_competence: "成年后的工作或生活中，哪件事让你觉得「这不是显而易见的吗」，但别人其实觉得很难？",
  energy_audit: "哪件事做完后虽然身体累，但精神反而更兴奋、更像回血？",
  jealousy_signal: "你真正会被哪种人或哪种生活状态刺到？具体是什么让你心里冒出「我也想这样」？",
  follow_up: "如果继续追问，你最想搞清楚自己的哪个问题？"
};

export async function generateTalentExcavationQuestion(input: {
  turns: TalentExcavationTurn[];
}): Promise<TalentExcavationNextQuestion> {
  const turns = normalizeTalentExcavationTurns(input.turns);
  const nextAnchor = pickNextAnchor(turns);

  const result = await callModelJSON<ModelNextQuestionOutput>({
    systemPrompt: [
      talentExcavationSystemPrompt,
      "",
      "现在执行多轮追问。",
      "- 必须采用「你问 -> 用户答 -> 简短反馈 -> 再问下一题」的模式。",
      "- 每次只问一个问题。",
      "- 必须覆盖早期线索、无意识胜任区、能量审计、嫉妒信号四类问题。",
      "- 已覆盖的问题不要机械重复，可以根据用户答案追问新的具体场景。",
      "- 覆盖四类问题后即可收口，不要让用户误以为必须做满 10 轮。",
      "- 通常 6 到 8 轮可以得到更稳的判断，最多不超过 10 个问题。",
      "- 当信息已经足够生成天赋说明书时，canFinalize 返回 true。",
      "- 返回 JSON，不要 Markdown。"
    ].join("\n"),
    userPrompt: [
      "已完成的对话：",
      formatTurns(turns),
      "",
      `本轮优先覆盖的锚点：${nextAnchor}`,
      "",
      `请输出 JSON：{ "reflection": string, "question": string, "requiredAnchor": "${nextAnchor}", "canFinalize": boolean }`
    ].join("\n"),
    task: "talent"
  });

  if (!result.data?.question || result.generationMode === "deterministic_fallback") {
    const fallbackReason = result.fallbackReason ?? "模型暂不可用，无法继续深度追问。";
    const fallback = buildFallbackDeepQuestion(turns);

    return {
      ...fallback,
      modelProvider: result.provider,
      riskNotes: [
        fallbackReason,
        "当前 AI 追问暂时没有返回可用问题，先用基础追问继续。"
      ]
    };
  }

  const canFinalize = hasRequiredAnchors(turns) || Boolean(result.data.canFinalize);

  return {
    type: "question",
    question: result.data.question,
    reflection: result.data.reflection ?? "",
    requiredAnchor: result.data.requiredAnchor ?? nextAnchor,
    progress: buildProgress(turns, canFinalize),
    generationMode: result.generationMode ?? "model",
    modelProvider: result.provider,
    riskNotes: result.fallbackReason ? [result.fallbackReason] : undefined
  };
}

export async function finalizeTalentExcavation(input: {
  turns: TalentExcavationTurn[];
}): Promise<TalentExcavationFinalResult> {
  const turns = normalizeTalentExcavationTurns(input.turns);
  const answers: TalentPromptAnswers = {
    discoveryMode: "deep",
    excavationTranscript: turns
  };
  let result: TalentProfileGenerationResult;
  try {
    result = await buildTalentProfileWithModel(answers);
  } catch (error) {
    const profile = buildTalentProfile(answers);
    const fallbackReason = error instanceof Error ? error.message : "模型调用失败。";
    result = {
      profile: {
        ...profile,
        talentManual: buildDeterministicTalentManual(profile, turns)
      },
      generationMode: "deterministic_fallback",
      riskNotes: [
        "模型生成暂时失败，已先根据当前深度回答生成本地版天赋说明书。",
        fallbackReason
      ]
    };
  }
  const talentManual =
    result.profile.talentManual ??
    [
      "模型未返回完整《个人天赋使用说明书》。当前只保存结构化优势档案。",
      result.profile.summary
    ].filter(Boolean).join("\n\n");

  return {
    type: "final",
    profile: result.profile,
    talentManual,
    generationMode: result.generationMode,
    modelProvider: result.modelProvider,
    riskNotes: result.riskNotes
  };
}

export function buildFallbackDeepQuestion(turns: TalentExcavationTurn[]): TalentExcavationNextQuestion {
  const normalizedTurns = normalizeTalentExcavationTurns(turns);
  const nextAnchor = pickNextAnchor(normalizedTurns);
  return {
    type: "question",
    question: fallbackQuestions[nextAnchor],
    reflection: "",
    requiredAnchor: nextAnchor,
    progress: buildProgress(normalizedTurns, hasRequiredAnchors(normalizedTurns)),
    generationMode: "deterministic_fallback",
    riskNotes: ["当前为基础填写模式，不是 AI 深度追问。"]
  };
}

function pickNextAnchor(turns: TalentExcavationTurn[]): TalentExcavationAnchor {
  const covered = new Set(turns.map((turn) => turn.requiredAnchor).filter(Boolean));
  return requiredAnchors.find((anchor) => !covered.has(anchor)) ?? "follow_up";
}

function hasRequiredAnchors(turns: TalentExcavationTurn[]) {
  const covered = new Set(turns.map((turn) => turn.requiredAnchor).filter(Boolean));
  return requiredAnchors.every((anchor) => covered.has(anchor));
}

function buildProgress(turns: TalentExcavationTurn[], canFinalize: boolean) {
  return {
    current: Math.min(turns.length + 1, maxDeepQuestionCount),
    max: maxDeepQuestionCount,
    canFinalize: canFinalize || turns.length >= requiredAnchors.length
  };
}

function formatTurns(turns: TalentExcavationTurn[]) {
  if (turns.length === 0) {
    return "还没有回答。请从第一题开始。";
  }

  return turns
    .map((turn, index) => [
      `${index + 1}. 问题：${turn.question}`,
      `回答：${turn.answer}`,
      turn.reflection ? `上一轮反馈：${turn.reflection}` : "",
      turn.requiredAnchor ? `锚点：${turn.requiredAnchor}` : ""
    ].filter(Boolean).join("\n"))
    .join("\n\n");
}

function buildDeterministicTalentManual(profile: TalentProfile, turns: TalentExcavationTurn[]) {
  const coreSignal = profile.signals[0];
  const supportingSignals = profile.signals.slice(1, 4);
  const evidence = profile.signals.flatMap((signal) => signal.evidence).slice(0, 5);
  const latestAnswers = turns.slice(-3).map((turn) => turn.answer).filter(Boolean);

  return [
    "《个人天赋使用说明书》",
    "",
    "## 底层天赋假设",
    coreSignal
      ? `你当前最稳定的优势信号，是「${coreSignal.label}」：${coreSignal.description}`
      : profile.headline,
    supportingSignals.length > 0
      ? `辅助信号包括：${supportingSignals.map((signal) => `「${signal.label}」`).join("、")}。`
      : "目前辅助信号还需要继续用真实经历验证。",
    "",
    "## 关键证据",
    ...(evidence.length > 0
      ? evidence.map((item) => `- ${item}`)
      : latestAnswers.map((item) => `- ${excerptManualEvidence(item)}`)),
    "",
    "## 适合的工作环境",
    ...profile.workStyle.map((item) => `- ${item}`),
    "",
    "## 不适合的工作环境",
    ...profile.cautionNotes.map((item) => `- ${item}`),
    "",
    "## 职业方向建议",
    ...profile.suitableDirections.map((item) => `- ${item}`),
    "",
    "## 使用提醒",
    "- 这版说明书基于当前深度回答生成，可先用于简历优化、面试准备和岗位筛选。",
    "- 后续如果补充更多真实经历，可以重新生成更稳定的版本。"
  ].join("\n");
}

function excerptManualEvidence(value: string) {
  const cleaned = value.trim();
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}
