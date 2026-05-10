import { callModelJSON } from "@/lib/ai/model-gateway";
import { getDefaultModelProvider, type ModelProviderKey } from "@/lib/ai/model-provider-config";
import type { JDInsight, RewriteStrategy } from "@/lib/services/job-apply/agent-run";

type JDInsightInput = {
  jdText: string;
  company?: string;
  jobTitle?: string;
  gaps?: string[];
  keywordsToBridge?: string[];
};

type ModelJDInsightResponse = {
  company?: string;
  jobTitle?: string;
  hardRequirements?: string[];
  coreAbilities?: string[];
  bonusItems?: string[];
  avoidItems?: string[];
  sourceKeywords?: string[];
};

type JDInsightBuildResult = {
  insight: JDInsight;
  provider: ModelProviderKey;
  generationMode: JDInsight["generationMode"];
  fallbackReason?: string;
  riskNotes: string[];
};

export function buildJDInsight(input: {
  jdText: string;
  company?: string;
  jobTitle?: string;
  gaps?: string[];
  keywordsToBridge?: string[];
}): JDInsight {
  const source = [input.jdText, ...(input.gaps ?? []), ...(input.keywordsToBridge ?? [])].join("\n");
  const hardRequirements = pickJDSignals(source, [
    ["AI 工具 / Prompt 应用", /AI|AIGC|Prompt|提示词|大模型|LLM|智能体|Agent/iu],
    ["产品需求拆解", /产品|需求|PRD|原型|MVP|用户|迭代|功能设计/iu],
    ["工作流设计", /工作流|流程|SOP|自动化|流程优化|流程梳理/iu],
    ["数据分析与结果表达", /数据|指标|分析|复盘|Excel|Tableau|SQL|R|Stata|增长/iu],
    ["内容运营与传播", /内容|新媒体|小红书|公众号|微博|社媒|运营|传播/iu],
    ["B 端沟通与方案表达", /B\s*端|客户|方案|沟通|协作|交付|售前|客户成功/iu]
  ]);
  const bonusItems = pickJDSignals(source, [
    ["自驱学习与落地", /学习|落地|自驱|好奇|新技术|探索/iu],
    ["跨部门协作", /跨部门|协同|协作|资源|推进/iu],
    ["作品集或账号案例", /作品集|账号|案例|内容案例|项目经验/iu]
  ]);
  const sourceKeywords = extractSourceKeywords(source);
  const keywords = dedupe([
    ...hardRequirements,
    ...(input.keywordsToBridge ?? []).map((item) => item.trim()).filter(Boolean)
  ]);
  const coreAbilities = keywords.length > 0 ? keywords.slice(0, 6) : sourceKeywords.slice(0, 6);

  return {
    company: input.company,
    jobTitle: input.jobTitle,
    hardRequirements: hardRequirements.length > 0 ? hardRequirements : coreAbilities.slice(0, 3),
    coreAbilities,
    bonusItems,
    sourceKeywords,
    generationMode: "deterministic_fallback",
    modelProvider: "deterministic_fallback",
    avoidItems: [
      "不改写公司、学历、时间和可核验事实",
      "不把弱相关经历包装成直接经验",
      "不输出省略号、占位符或建议性空话"
    ]
  };
}

export async function buildJDInsightWithModel(input: JDInsightInput): Promise<JDInsightBuildResult> {
  const provider = getDefaultModelProvider("jd_analysis");
  const fallbackInsight = buildJDInsight(input);

  const result = await callModelJSON<ModelJDInsightResponse>({
    provider,
    task: "jd_analysis",
    systemPrompt: [
      "你是岗位 JD 分析专家。请从 JD 原文中提取岗位理解结果。",
      "只输出合法 JSON，不要 Markdown。",
      "所有能力标签必须来自 JD 原文的具体要求或可直接归纳的短语。",
      "禁止输出空泛标签，例如「目标岗位要求的动作」「结果和协作方式」「岗位能力待确认」。"
    ].join("\n"),
    userPrompt: [
      `公司：${input.company ?? "未填写"}`,
      `岗位：${input.jobTitle ?? "未填写"}`,
      "",
      "JD 原文：",
      input.jdText,
      "",
      input.gaps?.length ? `已有差距分析：${input.gaps.join("；")}` : "",
      input.keywordsToBridge?.length ? `待桥接关键词：${input.keywordsToBridge.join("、")}` : "",
      "",
      "请输出 JSON：",
      "{",
      '  "company": "公司名或空字符串",',
      '  "jobTitle": "岗位名或空字符串",',
      '  "hardRequirements": ["硬性要求，来自 JD 原文"],',
      '  "coreAbilities": ["核心能力，必须是 JD 中具体能力短语"],',
      '  "bonusItems": ["加分项，来自 JD 原文"],',
      '  "avoidItems": ["改写时需要避免的风险"],',
      '  "sourceKeywords": ["JD 原文关键词或短语"]',
      "}"
    ].filter(Boolean).join("\n"),
    fallbackFactory: () => fallbackInsight
  });

  const insight = normalizeJDInsightFromModel(result.data, input, fallbackInsight, {
    provider: result.provider,
    generationMode: result.generationMode ?? "deterministic_fallback",
    fallbackReason: result.fallbackReason
  });

  return {
    insight,
    provider: result.provider,
    generationMode: result.generationMode ?? "deterministic_fallback",
    fallbackReason: result.fallbackReason,
    riskNotes: result.fallbackReason ? [`JD 理解模型降级原因：${result.fallbackReason}`] : []
  };
}

export function buildRewriteStrategy(jdInsight: JDInsight): RewriteStrategy {
  const priorities = dedupe([
    ...jdInsight.coreAbilities,
    ...jdInsight.hardRequirements,
    ...jdInsight.bonusItems
  ]).slice(0, 6);

  return {
    priorities,
    sectionOrder: ["summary", "project", "experience", "education"],
    lowRelevancePolicy: "compress_keep_timeline",
    distortionGuards: jdInsight.avoidItems
  };
}

export function selectJDAbilityLabel(input: {
  text: string;
  jdInsight?: JDInsight;
  fallback?: string;
}) {
  const abilities = [
    ...(input.jdInsight?.coreAbilities ?? []),
    ...(input.jdInsight?.sourceKeywords ?? [])
  ].filter((ability) => !isGenericAbilityLabel(ability));
  const source = input.text;
  const matched = abilities.find((ability) => {
    const tokens = ability.split(/[ /、｜|]+/u).map((token) => token.trim()).filter((token) => token.length >= 2);
    return tokens.some((token) => source.includes(token));
  });

  return matched ?? abilities[0] ?? sanitizeAbilityLabel(input.fallback) ?? "岗位能力待确认";
}

function pickJDSignals(source: string, patterns: Array<[string, RegExp]>) {
  return patterns.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
}

function dedupe(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function normalizeJDInsightFromModel(
  data: ModelJDInsightResponse | JDInsight | null,
  input: JDInsightInput,
  fallback: JDInsight,
  trace: {
    provider: ModelProviderKey;
    generationMode: JDInsight["generationMode"];
    fallbackReason?: string;
  }
): JDInsight {
  const sourceKeywords = dedupe([
    ...toStringList(data?.sourceKeywords),
    ...extractSourceKeywords([input.jdText, ...(input.keywordsToBridge ?? [])].join("\n"))
  ]).slice(0, 10);
  const coreAbilities = dedupe([
    ...sanitizeAbilityList(data?.coreAbilities),
    ...fallback.coreAbilities
  ]).filter((item) => !isGenericAbilityLabel(item)).slice(0, 8);
  const hardRequirements = dedupe([
    ...sanitizeAbilityList(data?.hardRequirements),
    ...fallback.hardRequirements
  ]).filter((item) => !isGenericAbilityLabel(item)).slice(0, 6);
  const bonusItems = dedupe([
    ...sanitizeAbilityList(data?.bonusItems),
    ...fallback.bonusItems
  ]).filter((item) => !isGenericAbilityLabel(item)).slice(0, 6);

  return {
    company: data?.company?.trim() || input.company || fallback.company,
    jobTitle: data?.jobTitle?.trim() || input.jobTitle || fallback.jobTitle,
    hardRequirements: hardRequirements.length ? hardRequirements : sourceKeywords.slice(0, 3),
    coreAbilities: coreAbilities.length ? coreAbilities : sourceKeywords.slice(0, 6),
    bonusItems,
    avoidItems: dedupe([
      ...toStringList(data?.avoidItems),
      ...fallback.avoidItems
    ]).slice(0, 6),
    sourceKeywords,
    generationMode: trace.generationMode,
    modelProvider: trace.provider,
    fallbackReason: trace.fallbackReason
  };
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function extractSourceKeywords(source: string) {
  const phrases = source
    .split(/[\n。；;，,、]/u)
    .map((line) => line.replace(/^[\-•\d.、\s]+/u, "").trim())
    .filter((line) => line.length >= 2 && line.length <= 28)
    .filter((line) => !/^(岗位职责|任职要求|职位描述|加分项|职责|要求)$/u.test(line));

  const tokens = source
    .split(/[\s,，;；、/()（）【】\[\]{}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && token.length <= 18)
    .filter((token) => /AI|AIGC|Prompt|LLM|Agent|产品|需求|PRD|原型|数据|分析|内容|运营|工作流|流程|协作|客户|方案|交付|学习|落地/iu.test(token));

  return dedupe([...phrases, ...tokens]).slice(0, 12);
}

function sanitizeAbilityLabel(label?: string) {
  const normalized = label?.trim();
  if (!normalized || isGenericAbilityLabel(normalized)) {
    return undefined;
  }

  return normalized.length > 28 ? normalized.slice(0, 28) : normalized;
}

function sanitizeAbilityList(value: unknown) {
  return toStringList(value)
    .map((item) => sanitizeAbilityLabel(item))
    .filter((item): item is string => Boolean(item));
}

function isGenericAbilityLabel(label: string) {
  return /目标岗位要求|结果和协作方式|岗位能力待确认|动作、结果|能力待确认/u.test(label);
}
