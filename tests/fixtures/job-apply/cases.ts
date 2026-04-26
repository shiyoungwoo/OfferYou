import path from "node:path";

const fixtureRoot = path.join(process.cwd(), "tests", "fixtures", "job-apply");

export type JobApplyCase = {
  slug: string;
  company: string;
  jobTitle: string;
  resumePath: string;
  jdPath: string;
  expectedKeywords: string[];
  expectedRiskKeywords: string[];
  withTalentContext?: boolean;
};

export const jobApplyCases: JobApplyCase[] = [
  {
    slug: "aipm",
    company: "星桥智能",
    jobTitle: "AI 产品经理",
    resumePath: path.join(fixtureRoot, "aipm", "resume.md"),
    jdPath: path.join(fixtureRoot, "aipm", "jd.md"),
    expectedKeywords: ["AI 产品经理", "工作流", "跨团队"],
    expectedRiskKeywords: ["模型降级原因", "真实事实", "事实"],
    withTalentContext: true
  },
  {
    slug: "product-ops",
    company: "云海数据",
    jobTitle: "产品运营 / 业务分析",
    resumePath: path.join(fixtureRoot, "product-ops", "resume.md"),
    jdPath: path.join(fixtureRoot, "product-ops", "jd.md"),
    expectedKeywords: ["产品运营", "数据分析", "复盘"],
    expectedRiskKeywords: ["模型降级原因", "事实", "可量化"],
    withTalentContext: false
  },
  {
    slug: "ai-content",
    company: "灵犀内容",
    jobTitle: "AI 内容应用专员",
    resumePath: path.join(fixtureRoot, "ai-content", "resume.md"),
    jdPath: path.join(fixtureRoot, "ai-content", "jd.md"),
    expectedKeywords: ["AI 内容", "流程", "模板"],
    expectedRiskKeywords: ["模型降级原因", "事实", "输出质量"],
    withTalentContext: false
  }
];
