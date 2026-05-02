import type { JDInsight, RewriteStrategy } from "@/lib/services/job-apply/agent-run";

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
  const keywords = dedupe([
    ...hardRequirements,
    ...(input.keywordsToBridge ?? []).map((item) => item.trim()).filter(Boolean)
  ]);

  return {
    company: input.company,
    jobTitle: input.jobTitle,
    hardRequirements: hardRequirements.length > 0 ? hardRequirements : keywords.slice(0, 3),
    coreAbilities: keywords.slice(0, 6),
    bonusItems,
    avoidItems: [
      "不改写公司、学历、时间和可核验事实",
      "不把弱相关经历包装成直接经验",
      "不输出省略号、占位符或建议性空话"
    ]
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
  const abilities = input.jdInsight?.coreAbilities ?? [];
  const source = input.text;
  const matched = abilities.find((ability) => {
    const tokens = ability.split(/[ /、｜|]+/u).map((token) => token.trim()).filter((token) => token.length >= 2);
    return tokens.some((token) => source.includes(token));
  });

  return matched ?? abilities[0] ?? input.fallback ?? "岗位能力待确认";
}

function pickJDSignals(source: string, patterns: Array<[string, RegExp]>) {
  return patterns.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
}

function dedupe(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
