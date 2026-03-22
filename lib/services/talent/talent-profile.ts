export type TalentPromptAnswers = {
  discoveryMode?: "radar" | "deep";
  proudMoment?: string;
  trustedProblem?: string;
  energyPattern?: string;
  unconsciousCompetence?: string;
  energyAudit?: string;
  jealousySignal?: string;
  preConditioningMemory?: string;
  adultUnconsciousCompetence?: string;
  energyRecharge?: string;
  jealousyDecode?: string;
  followUpNotes?: string;
};

export type TalentSignal = {
  key: string;
  label: string;
  description: string;
  evidence: string[];
};

export type TalentProfile = {
  headline: string;
  summary: string;
  signals: TalentSignal[];
  workStyle: string[];
  suitableDirections: string[];
  cautionNotes: string[];
  confidenceNote: string;
};

const signalCatalog = [
  {
    key: "clarity_builder",
    label: "梳理混乱的人",
    description: "能把混乱、模糊或卡住的事情梳理成清晰结构和下一步。",
    keywords: [
      "clarify",
      "clarified",
      "structure",
      "structured",
      "organize",
      "organized",
      "messy",
      "ambigu",
      "workflow",
      "process",
      "plan",
      "梳理",
      "清晰",
      "理顺",
      "混乱",
      "流程",
      "计划",
      "卡住",
      "结构"
    ]
  },
  {
    key: "relationship_driver",
    label: "建立信任的人",
    description: "能快速建立信任，让客户、同事或合作方更愿意跟着你推进。",
    keywords: [
      "trust",
      "client",
      "customer",
      "partner",
      "relationship",
      "stakeholder",
      "support",
      "retain",
      "retention",
      "listen",
      "信任",
      "客户",
      "用户",
      "关系",
      "合作",
      "倾听",
      "支持",
      "陪伴"
    ]
  },
  {
    key: "ownership_runner",
    label: "主动推进的人",
    description: "不会等所有条件完美才行动，能主动把事情往前推。",
    keywords: [
      "own",
      "owner",
      "lead",
      "led",
      "drive",
      "drove",
      "launch",
      "launched",
      "execute",
      "execution",
      "initiative",
      "负责",
      "主导",
      "推进",
      "落地",
      "执行",
      "发起",
      "主动"
    ]
  },
  {
    key: "insight_synthesizer",
    label: "洞察提炼的人",
    description: "能从信息、数据和现象里提炼规律，并转成判断。",
    keywords: [
      "analy",
      "insight",
      "research",
      "data",
      "pattern",
      "synthesize",
      "summary",
      "metric",
      "diagnose",
      "分析",
      "洞察",
      "研究",
      "数据",
      "规律",
      "总结",
      "判断",
      "诊断"
    ]
  },
  {
    key: "cross_functional_translator",
    label: "跨团队协同的人",
    description: "能连接不同角色的诉求，让大家重新对齐并继续协作。",
    keywords: [
      "cross",
      "team",
      "teams",
      "coordinate",
      "coordinated",
      "alignment",
      "align",
      "handoff",
      "bridge",
      "translate",
      "跨团队",
      "协同",
      "协调",
      "对齐",
      "沟通",
      "桥梁",
      "协作"
    ]
  }
] as const;

const directionCatalog = [
  {
    label: "客户成功、客户关系与服务推进类方向",
    requiredSignals: ["relationship_driver", "clarity_builder"]
  },
  {
    label: "运营、项目推进与交付类方向",
    requiredSignals: ["ownership_runner", "clarity_builder"]
  },
  {
    label: "研究、策略与分析类方向",
    requiredSignals: ["insight_synthesizer", "clarity_builder"]
  },
  {
    label: "合作、赋能与跨团队协同类方向",
    requiredSignals: ["cross_functional_translator", "relationship_driver"]
  }
] as const;

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function excerpt(text: string) {
  const cleaned = text.trim();
  if (!cleaned) {
    return "";
  }

  return cleaned.length > 140 ? `${cleaned.slice(0, 137)}...` : cleaned;
}

function collectSignalEvidence(answers: TalentPromptAnswers) {
  const entries = listAnswerEntries(answers);

  return signalCatalog
    .map((signal) => {
      const evidence = entries.filter((entry) => {
        const content = normalize(entry);
        return signal.keywords.some((keyword) => content.includes(keyword));
      });

      return {
        key: signal.key,
        label: signal.label,
        description: signal.description,
        evidence: evidence.map(excerpt)
      };
    })
    .filter((signal) => signal.evidence.length > 0);
}

function inferWorkStyle(answers: TalentPromptAnswers) {
  const energy = normalize(
    [
      answers.energyPattern,
      answers.energyAudit,
      answers.energyRecharge,
      answers.followUpNotes
    ]
      .filter(Boolean)
      .join(" ")
  );
  const workStyle: string[] = [];

  if (energy.includes("people") || energy.includes("customer") || energy.includes("team")) {
    workStyle.push("更适合有人协作、沟通频繁、能看到彼此配合的工作环境。");
  }

  if (
    energy.includes("autonomy") ||
    energy.includes("independent") ||
    energy.includes("own") ||
    energy.includes("自主") ||
    energy.includes("独立") ||
    energy.includes("主导")
  ) {
    workStyle.push("需要一定的自主空间，才能把事情真正带起来。");
  }

  if (
    energy.includes("problem") ||
    energy.includes("complex") ||
    energy.includes("ambigu") ||
    energy.includes("问题") ||
    energy.includes("复杂") ||
    energy.includes("模糊")
  ) {
    workStyle.push("遇到复杂、模糊、需要逐步拆解的问题时，反而更容易进入状态。");
  }

  if (
    energy.includes("focus") ||
    energy.includes("deep work") ||
    energy.includes("quiet") ||
    energy.includes("专注") ||
    energy.includes("安静") ||
    energy.includes("深度工作")
  ) {
    workStyle.push("在输出建议前，需要一段相对安静、连续的思考时间。");
  }

  if (workStyle.length === 0) {
    workStyle.push("目前关于工作状态的线索还不够，后续补充更具体的经历后会更准确。");
  }

  return workStyle;
}

function inferSuitableDirections(signals: TalentSignal[]) {
  const activeKeys = new Set(signals.map((signal) => signal.key));

  const matches = directionCatalog
    .filter((direction) => direction.requiredSignals.every((key) => activeKeys.has(key)))
    .map((direction) => direction.label);

  if (matches.length > 0) {
    return matches;
  }

  if (activeKeys.has("relationship_driver")) {
    return ["需要建立信任、持续跟进并把事情讲清楚的客户型岗位方向。"];
  }

  if (activeKeys.has("insight_synthesizer")) {
    return ["重视结构化思考、规律提炼和辅助判断的分析型岗位方向。"];
  }

  return ["再补充一些第一手经历后，更清晰的方向会逐渐浮现出来。"];
}

function inferCautions(answers: TalentPromptAnswers, signals: TalentSignal[]) {
  const cautions: string[] = [];
  const coreStory = firstAvailable(
    answers.preConditioningMemory,
    answers.proudMoment,
    answers.unconsciousCompetence,
    answers.adultUnconsciousCompetence
  );
  const trustAnswer = firstAvailable(
    answers.trustedProblem,
    answers.unconsciousCompetence,
    answers.adultUnconsciousCompetence,
    answers.followUpNotes
  );
  const energyAnswer = firstAvailable(
    answers.energyPattern,
    answers.energyAudit,
    answers.energyRecharge,
    answers.followUpNotes
  );

  if (signals.length < 2) {
    cautions.push("当前重复出现的证据还不够多，现阶段更适合探索，而不是太早定死方向。");
  }

  if (coreStory.trim().length < 60) {
    cautions.push("最好补一段更完整的成功经历，写清楚你做了什么、带来了什么结果。");
  }

  if (!normalize(trustAnswer).includes("because") && !normalize(trustAnswer).includes("因为")) {
    cautions.push("除了别人会找你做什么，也尽量写清楚他们为什么会信任你。");
  }

  if (
    normalize(energyAnswer).includes("drain") ||
    normalize(energyAnswer).includes("tired") ||
    normalize(energyAnswer).includes("消耗") ||
    normalize(energyAnswer).includes("疲惫")
  ) {
    cautions.push("有些岗位表面上看起来匹配，但长期做下去可能会很消耗你。");
  }

  if (cautions.length === 0) {
    cautions.push("先把这份结果当作方向参考，再拿 2 到 3 个真实岗位去验证，会更稳。");
  }

  return cautions;
}

export function buildTalentProfile(answers: TalentPromptAnswers): TalentProfile {
  const signals = collectSignalEvidence(answers);
  const workStyle = inferWorkStyle(answers);
  const suitableDirections = inferSuitableDirections(signals);
  const cautionNotes = inferCautions(answers, signals);
  const supportingSignal = signals[1]?.label.toLowerCase();

  const headline =
    signals.length > 0
      ? supportingSignal
        ? `你最容易发光的状态，是作为“${signals[0].label}”，并且同时带有“${signals[1]?.label}”的辅助特征。`
        : `你最容易发光的状态，是作为“${signals[0].label}”。`
      : "你的优势轮廓还在浮现，但已经有一些值得继续验证的早期信号。";

  const summary =
    signals.length > 0
      ? "这张卡片会把你真实经历里反复出现的模式，整理成一版谨慎的优势判断。它是帮助你继续探索的起点，不是给你贴死标签。"
      : "目前这张卡片会保持谨慎，因为现在的回答里，重复出现的证据还不够多。";

  const confidenceNote =
    signals.length >= 3
      ? "当前可信度为中等：你的回答里已经出现了多组重复信号，可以先拿来指导下一步探索。"
      : "当前可信度仍在早期：线索还偏少，最好再补几段经历来验证。";

  return {
    headline,
    summary,
    signals,
    workStyle,
    suitableDirections,
    cautionNotes,
    confidenceNote
  };
}

function listAnswerEntries(answers: TalentPromptAnswers) {
  return [
    answers.proudMoment,
    answers.trustedProblem,
    answers.energyPattern,
    answers.unconsciousCompetence,
    answers.energyAudit,
    answers.jealousySignal,
    answers.preConditioningMemory,
    answers.adultUnconsciousCompetence,
    answers.energyRecharge,
    answers.jealousyDecode,
    answers.followUpNotes
  ].filter((value): value is string => Boolean(value?.trim()));
}

function firstAvailable(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim()) ?? "";
}
