import { describe, expect, it } from "vitest";
import { composeSnapshotDocument } from "@/lib/services/snapshot/snapshot-composer";

describe("composeSnapshotDocument", () => {
  it("includes accepted suggestions but excludes rejected suggestions", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-1",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI Product Manager",
      language: "en",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "Prompt 编写与迭代，开发用于模型训练的高质量数据生成 Prompt，协同产品、研发、设计及数据团队推动 AI 对话产品迭代。",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: "baseline",
      analysis: {
        fitScore: 81,
        optimizationMode: "baseline_jd_match",
        strengths: ["workflow fit"],
        gaps: ["metrics"],
        riskNotes: ["stay factual"]
      },
      suggestions: [
        {
          id: "s1",
          section: "project",
          title: "Accepted",
          beforeText: "Before",
          afterText: "Built AI product workflow",
          reasonText: "Reason",
          status: "accepted",
          sourceKind: "master_fact",
          sourceLabel: "Master fact: Role-fit framing",
          revisionRound: 0
        },
        {
          id: "s2",
          section: "project",
          title: "Rejected",
          beforeText: "Before",
          afterText: "Ignored text",
          reasonText: "Reason",
          status: "rejected",
          sourceKind: "master_fact",
          sourceLabel: "Master fact: Role-fit framing",
          revisionRound: 0
        }
      ],
      factSubmissions: [],
      masterFactsUsed: []
    });

    expect(JSON.stringify(document)).toContain("Built AI product workflow");
    expect(JSON.stringify(document)).not.toContain("Ignored text");
    expect(document.sections.map((section) => section.title)).toEqual([
      "个人信息",
      "个人优势",
      "工作经历",
      "项目经历",
      "教育背景"
    ]);
    expect(document.header.title).toBe("AI Product Manager");
  });

  it("uses confirmed talent signals to shape the preview resume content", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-2",
      userId: "default-user",
      company: "Northstar Careers",
      jobTitle: "客户成功经理",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "客户成功经理负责客户 onboarding、客户关系维护、跨团队交付推进和续约增长。",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: "王小明\n负责客户 onboarding 与项目推进",
      analysis: {
        fitScore: 86,
        optimizationMode: "talent_amplified",
        strengths: ["擅长把复杂信息整理成清晰行动路径", "能够在跨团队协作里建立信任"],
        gaps: ["行业案例还需要继续补强"],
        riskNotes: ["不要夸大直接管理职责"]
      },
      talentProfileUsed: {
        id: "tp-1",
        headline: "天然擅长在复杂情境下建立信任并推动事情落地",
        confidenceNote: "这个判断主要来自你反复提到的协调、解释和稳定推进经历。"
      },
      careerDirectionUsed: {
        id: "cn-1",
        slug: "customer-success-and-relationship-led-roles",
        label: "客户成功与关系推进",
        rationale: "这类方向更能承接你在解释复杂问题、稳定关系和推进协作上的优势。",
        watchOut: "不要把自己说成泛执行者，要突出你建立信任和推进结果的能力。"
      },
      masterFactsUsed: [],
      suggestions: [
        {
          id: "s1",
          section: "experience",
          title: "客户协同亮点",
          beforeText: "负责项目推进",
          afterText: "在客户 onboarding 过程中把分散需求整理成清晰计划，稳定客户预期并推动团队按节奏交付。",
          reasonText: "这版改写不会改变事实本身，但会更主动地把你底层的优势和自然工作方式写出来。",
          status: "accepted",
          sourceKind: "target_role_fit",
          sourceLabel: "Role-fit framing",
          revisionRound: 0
        }
      ],
      factSubmissions: []
    });

    expect(document.header.name).toBe("王小明");
    expect(JSON.stringify(document)).toContain("天然擅长在复杂情境下建立信任并推动事情落地");
    expect(JSON.stringify(document)).toContain("稳定客户预期并推动团队按节奏交付");
    expect(JSON.stringify(document.sections.find((section) => section.id === "personal-info")?.items)).toContain(
      "求职意向：客户成功经理"
    );
    expect(document.sections.some((section) => section.id === "certificates-skills")).toBe(false);
    expect(document.sections.find((section) => section.id === "education")?.items[0]).toEqual({
      type: "text",
      text: "请补充教育背景、专业、毕业时间或代表性课程。"
    });
  });

  it("separates work, internship, education, and skills from the original resume text when possible", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-3",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "运营经理",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "Prompt 编写与迭代，开发用于模型训练的高质量数据生成 Prompt，协同产品、研发、设计及数据团队推动 AI 对话产品迭代。",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: `李四
13800000000
工作经历
      2021.03-2023.08 某科技有限公司 运营经理 负责搭建 SOP 并推进跨团队项目落地
      实习经历
      2019.06-2019.09 某咨询公司 实习生 协助完成用户访谈和竞品研究
      • 输出竞品分析摘要并支持交付汇报
教育经历
2016-2020 复旦大学 市场营销 本科
项目经历
从0到1搭建用户增长项目并完成首轮验证
技能证书
英语六级 / Excel / SQL`,
      analysis: {
        fitScore: 79,
        optimizationMode: "baseline_jd_match",
        strengths: ["擅长推进复杂项目落地"],
        gaps: ["需要更强量化结果"],
        riskNotes: ["不要夸大管理范围"]
      },
      suggestions: [],
      factSubmissions: [],
      masterFactsUsed: []
    });

    expect(document.sections.find((section) => section.id === "work-experience")?.items[0]).toMatchObject({
      type: "entry",
      heading: "某科技有限公司",
      subheading: "运营经理",
      meta: "2021.03-2023.08"
    });
    expect(document.sections.some((section) => section.id === "internship-experience")).toBe(false);
    expect(document.sections.find((section) => section.id === "education")?.items[0]).toMatchObject({
      type: "entry",
      heading: "复旦大学",
      subheading: "市场营销 ｜ 本科",
      meta: "2016-2020"
    });
    expect(JSON.stringify(document.sections.find((section) => section.id === "personal-info")?.items)).toContain(
      "手机：13800000000"
    );
    expect(JSON.stringify(document.sections.find((section) => section.id === "personal-info")?.items)).toContain(
      "学历：复旦大学 · 本科"
    );
    expect(document.sections.find((section) => section.id === "project-experience")?.items[0]).toMatchObject({
      type: "entry",
      heading: "从0到1搭建用户增长项目并完成首轮验证"
    });
  });

  it("extracts the candidate name and sections from a markdown resume with frontmatter", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-4",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI 产品经理",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "preview",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: `---
title: 简历助手重制
type: resume-snapshot
---
# 吴世阳

18513449520 | wsyoung@example.com
GitHub：github.com/shiyoungwoo/OfferYou
作品集：OfferYou 项目案例 / AIPM Notebook

## 项目经历
### OfferYou - AI 岗位定制简历助手
- 独立完成产品定义与 MVP 范围收敛
- 输出完整的输入输出协议与 API 草案

## 技能与证书
Prompt Engineering / Obsidian / AI Agent`,
      analysis: {
        fitScore: 90,
        optimizationMode: "baseline_jd_match",
        strengths: ["善于把复杂问题拆解成可执行步骤"],
        gaps: ["需要更强的岗位表达"],
        riskNotes: ["保持事实准确"]
      },
      suggestions: [],
      factSubmissions: [],
      masterFactsUsed: []
    });

    expect(document.header.name).toBe("吴世阳");
    expect(document.header.contacts).toEqual([
      "wsyoung@example.com",
      "18513449520",
      "github.com/shiyoungwoo/OfferYou",
      "OfferYou 项目案例 / AIPM Notebook"
    ]);
    expect(JSON.stringify(document.sections.find((section) => section.id === "project-experience")?.items)).toContain("OfferYou");
  });

  it("keeps OCR PDF resume sections and accepted Chinese-section suggestions in the snapshot", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-5",
      userId: "default-user",
      company: "OfferYou 示例岗位",
      jobTitle: "客户成功经理",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "Prompt 编写与迭代，开发用于模型训练的高质量数据生成 Prompt，协同产品、研发、设计及数据团队推动 AI 对话产品迭代。",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: `2026/3/11 00:26吴世阳 - AI产品经理简历
第1/2⻚file:///tmp/resume-ai-pm.html
吴 世 阳
男 | 31岁 | 共产党员 | 18513449520 | 434995517@qq.com
求职意向：AI 产品经理 / 大数据产品经理
个 人 优 势
AI 产品实践者：正在独立设计 AI 求职辅助产品$O&erYou$，已完成 MVP 产品协议设计。
项 目 经 历
O"erYou ) AI 岗位定制简历助手 （个人产品项目）2026.03 - 至今
独立完成产品定义与 MVP 范围收敛
输出完整的产品输入输出协议文档
工 作 经 历
陕西怡阳医疗科技有限公司 % 数据工程师2025.09 - 2025.11
基于需求分析设计多变量控制实验方案
广发银行北京分行 % 综合柜员岗2022.08 - 2025.08
B 端客户服务：面向中铁、中国物流集团等 B 端客户提供上门产品讲解与方案推介
教 育 经 历
对外经济贸易大学 | 硕士 | 全球价值链（应用经济学）
2020 - 2022`,
      analysis: {
        fitScore: 88,
        optimizationMode: "baseline_jd_match",
        strengths: ["具备客户服务与 AI 产品实践交叉经验"],
        gaps: ["需要把客户成功相关经历前置"],
        riskNotes: ["不要夸大直接产品职责"]
      },
      suggestions: [
        {
          id: "ai-1",
          section: "项目经历",
          title: "项目改写",
          beforeText: "独立完成产品定义与 MVP 范围收敛",
          afterText: "围绕客户成功经理岗位，突出 OfferYou 项目中的需求拆解、Prompt 迭代和用户反馈整理。",
          reasonText: "匹配 JD 对 Prompt 编写与客户反馈的要求。",
          status: "accepted",
          sourceKind: "target_role_fit",
          sourceLabel: "Role-fit framing",
          revisionRound: 0
        },
        {
          id: "ai-2",
          section: "个人优势",
          title: "优势改写",
          beforeText: "AI 产品实践者",
          afterText: "AI 产品与客户反馈理解能力并重，能把复杂需求整理为可执行方案。",
          reasonText: "匹配客户成功岗位的沟通和方案能力。",
          status: "accepted",
          sourceKind: "target_role_fit",
          sourceLabel: "Role-fit framing",
          revisionRound: 0
        },
        {
          id: "ai-3",
          section: "工作经历",
          title: "工作改写",
          beforeText: "B 端客户服务",
          afterText: "面向 B 端客户进行产品讲解与方案推介，处理客户异议并维护服务体验。",
          reasonText: "匹配客户成功岗位。",
          status: "accepted",
          sourceKind: "target_role_fit",
          sourceLabel: "Role-fit framing",
          revisionRound: 0
        }
      ],
      factSubmissions: [],
      masterFactsUsed: []
    });

    expect(document.header.name).toBe("吴世阳");
    expect(document.header.title).toBe("AI Prompt 产品专员");
    expect(JSON.stringify(document.sections.find((section) => section.id === "personal-strengths")?.items)).toContain(
      "AI 产品与客户反馈理解能力并重"
    );
    expect(JSON.stringify(document.sections.find((section) => section.id === "work-experience")?.items)).toContain("广发银行北京分行");
    expect(JSON.stringify(document.sections.find((section) => section.id === "work-experience")?.items)).toContain("B 端客户");
    expect(JSON.stringify(document.sections)).not.toContain("file:///tmp/resume-ai-pm.html");
    expect(JSON.stringify(document.sections)).not.toContain("2026/3/11");
    expect(JSON.stringify(document.sections.find((section) => section.id === "project-experience")?.items)).toContain("OfferYou");
    expect(JSON.stringify(document.sections.find((section) => section.id === "project-experience")?.items)).toContain("Prompt 迭代");
    expect(document.sections.find((section) => section.id === "education")?.items[0]).toMatchObject({
      type: "entry",
      heading: "对外经济贸易大学",
      meta: "2020-2022"
    });
  });

  it("prefers accepted work suggestions over the same raw parsed work entry", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-6",
      userId: "default-user",
      company: "图灵文化",
      jobTitle: "AI 产品经理",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "要求 AI 工作流优化、新媒体 AI 化运营、Prompt Engineering、学习落地能力。",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: [
        "工作经历",
        "广发银行北京分行 综合柜员岗 2022.08 - 2025.08",
        "流程优化与数据分析：协助网点负责人进行运营数据统计与分析",
        "培训体系搭建：担任业务导师，带教新员工掌握核心操作系统"
      ].join("\n"),
      analysis: {
        fitScore: 70,
        optimizationMode: "baseline_jd_match",
        strengths: [],
        gaps: [],
        riskNotes: []
      },
      suggestions: [
        {
          id: "s-work",
          section: "experience",
          title: "广发银行经历改写",
          beforeText: "广发银行北京分行 综合柜员岗 2022.08 - 2025.08",
          afterText: [
            "广发银行北京分行｜综合柜员岗｜2022.08 - 2025.08",
            "- 结合网点运营数据进行统计与分析，识别业务量波动并为排班和窗口调整提供依据。",
            "- 梳理高频业务流程和操作要点，带教新员工掌握核心系统，沉淀可复用的培训材料。"
          ].join("\n"),
          reasonText: "贴合 JD 对流程优化、数据分析和学习落地能力的要求。",
          status: "accepted",
          sourceKind: "resume_baseline",
          sourceLabel: "AI 改写建议",
          revisionRound: 0
        }
      ],
      factSubmissions: [],
      masterFactsUsed: []
    });

    const workText = JSON.stringify(document.sections.find((section) => section.id === "work-experience")?.items);
    expect(workText).toContain("排班");
    expect(workText.match(/广发银行北京分行/g)?.length).toBe(1);
  });
});
