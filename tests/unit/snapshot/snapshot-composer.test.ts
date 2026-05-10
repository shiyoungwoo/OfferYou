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
      subheading: "全球价值链（应用经济学） ｜ 硕士",
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

  it("cleans markdown residue and placeholder lines before rendering resume sections", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-clean-layout",
      userId: "default-user",
      company: "图灵文化",
      jobTitle: "AI 就业指导产品经理",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "要求 AI 工作流设计、流程梳理和跨团队协作。",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: [
        "吴世阳",
        "个人优势",
        "> **AI 产品实践者：** 正在独立设计 AI 求职辅助产品 OfferYou。",
        "教育背景",
        "对外经济贸易大学 硕士 2020 - 2022",
        "湖南工业大学 本科 2013 - 2017",
        "---",
        "---"
      ].join("\n"),
      analysis: {
        fitScore: 66,
        optimizationMode: "baseline_jd_match",
        strengths: [],
        gaps: [],
        riskNotes: []
      },
      suggestions: [
        {
          id: "summary-clean",
          section: "summary",
          title: "个人优势改写",
          beforeText: "AI 产品实践者",
          afterText: "> **AI 产品实践者：** 正在独立设计 AI 求职辅助产品 OfferYou，对应「工作流设计、流程梳理和跨团队协作」。",
          reasonText: "匹配 JD。",
          status: "accepted",
          sourceKind: "target_role_fit",
          sourceLabel: "AI 改写建议",
          revisionRound: 0
        },
        {
          id: "work-clean",
          section: "experience",
          title: "- 通过数据反馈驱动方案迭代优化，成功将核心指标达标稳定化，体现从需求分析到方案优化的产品化思维",
          beforeText: "陕西怡阳医疗科技有限公司 数据工程师 2025.09 - 2025.11",
          afterText: "- 通过数据反馈驱动方案迭代优化，成功将核心指标达标稳定化，体现从需求分析到方案优化的产品化思维。",
          reasonText: "匹配 JD。",
          status: "accepted",
          sourceKind: "resume_baseline",
          sourceLabel: "AI 改写建议",
          revisionRound: 0
        }
      ],
      factSubmissions: [],
      masterFactsUsed: []
    });

    const snapshotText = JSON.stringify(document);
    expect(snapshotText).not.toContain("**");
    expect(snapshotText).not.toContain(">");
    expect(snapshotText).not.toContain("\\\"---\\\"");
    expect(snapshotText).toContain("AI 产品实践者");

    const workItems = document.sections.find((section) => section.id === "work-experience")?.items ?? [];
    expect(JSON.stringify(workItems[0])).not.toContain("通过数据反馈驱动方案迭代优化，成功将核心指标达标稳定化，体现从需求分析到方案优化的产品化思维\",\"meta");
    expect(JSON.stringify(workItems[0])).toContain("陕西怡阳医疗科技有限公司");
    expect(workItems[0]).toMatchObject({
      type: "entry",
      summary: undefined,
      bullets: expect.arrayContaining([
        "通过数据反馈驱动方案迭代优化，成功将核心指标达标稳定化，体现从需求分析到方案优化的产品化思维。"
      ])
    });

    const educationText = JSON.stringify(document.sections.find((section) => section.id === "education")?.items);
    expect(educationText).toContain("对外经济贸易大学");
    expect(educationText).toContain("湖南工业大学");
    expect(educationText).not.toContain("---");
  });

  it("repairs dirty calibrated project and education fragments before rendering the PDF document", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-dirty-calibration",
      userId: "default-user",
      company: "图灵文化",
      jobTitle: "AI 就业指导产品经理",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "要求 AI 工作流设计、流程梳理和跨团队协作。",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: "baseline",
      calibratedResume: {
        status: "needs_review",
        personalInfo: {
          name: "吴世阳",
          phone: "18513449520",
          email: "434995517@qq.com"
        },
        entries: [
          {
            id: "project-1",
            section: "project",
            title: "OfferYou AI 岗位定制简历助手 （个人产品项目）",
            dateRange: "2026.03 - 至今",
            bullets: ["独立完成产品定义与 MVP 范围收敛。"],
            sourceText: "OfferYou AI 岗位定制简历助手 （个人产品项目） 2026.03 - 至今",
            confidence: "high",
            issues: []
          },
          {
            id: "project-body-1",
            section: "project",
            title: "输出完整的产品输入输出协议文档、OpenAPI 3.1 接口草案、前端四页面状态机设计",
            bullets: ["定义「绝对防失真」原则，用户逐条确认。"],
            sourceText: "输出完整的产品输入输出协议文档、OpenAPI 3.1 接口草案、前端四页面状态机设计",
            confidence: "medium",
            issues: []
          },
          {
            id: "project-2",
            section: "project",
            title: "AI 工具自媒体内容运营 （个人项目）",
            dateRange: "2026.03 - 至今",
            bullets: ["策划并发布 AI 工具类深度图文系列。"],
            sourceText: "AI 工具自媒体内容运营 （个人项目） 2026.03 - 至今",
            confidence: "high",
            issues: []
          },
          {
            id: "education-1",
            section: "education",
            title: "对外经济贸易大学 | 硕士 | 全球价值链（应用经济学）",
            bullets: [],
            sourceText: "对外经济贸易大学 | 硕士 | 全球价值链（应用经济学）",
            confidence: "high",
            issues: []
          },
          {
            id: "education-date-1",
            section: "education",
            title: "2020 - 2022",
            bullets: [],
            sourceText: "2020 - 2022",
            confidence: "medium",
            issues: []
          },
          {
            id: "education-2",
            section: "education",
            title: "湖南工业大学 | 本科 | 数学与应用数学（金融统计）",
            bullets: [],
            sourceText: "湖南工业大学 | 本科 | 数学与应用数学（金融统计）",
            confidence: "high",
            issues: []
          },
          {
            id: "education-date-2",
            section: "education",
            title: "2013 - 2017",
            bullets: [],
            sourceText: "2013 - 2017",
            confidence: "medium",
            issues: []
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "deterministic_fallback",
        updatedAt: "2026-05-06T00:00:00.000Z"
      },
      analysis: {
        fitScore: 60,
        optimizationMode: "baseline_jd_match",
        strengths: [],
        gaps: [],
        riskNotes: []
      },
      suggestions: [],
      factSubmissions: [],
      masterFactsUsed: []
    });

    const projectItems = document.sections.find((section) => section.id === "project-experience")?.items ?? [];
    const projectText = JSON.stringify(projectItems);
    expect(projectItems).toHaveLength(2);
    expect(projectText).toContain("OfferYou AI 岗位定制简历助手");
    expect(projectText).toContain("OpenAPI 3.1");
    expect(projectText.match(/OpenAPI 3.1/g)?.length).toBe(1);
    expect(projectText).toContain("AI 工具自媒体内容运营");
    expect(projectText.match(/2026.03 - 至今/g)?.length).toBe(2);

    const educationItems = document.sections.find((section) => section.id === "education")?.items ?? [];
    const educationText = JSON.stringify(educationItems);
    expect(educationItems).toHaveLength(2);
    expect(educationText).toContain("对外经济贸易大学");
    expect(educationText).toContain("湖南工业大学");
    expect(educationText).toContain("全球价值链（应用经济学）");
    expect(educationText).toContain("数学与应用数学（金融统计）");
    expect(educationText).toContain("2020-2022");
    expect(educationText).toContain("2013-2017");
    expect(educationText).not.toContain("\"heading\":\"2020");
  });

  it("keeps unaccepted calibrated projects and removes internal advice from resume body", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-accepted-plus-baseline",
      userId: "default-user",
      company: "魔镜洞察",
      jobTitle: "AI 产品经理 Vibe Coding",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "要求 Vibe Coding、AI Agent、Claude Code、数据分析与产品落地。",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: "baseline",
      calibratedResume: {
        status: "confirmed",
        personalInfo: {
          name: "吴世阳",
          phone: "18513449520",
          email: "434995517@qq.com"
        },
        entries: [
          {
            id: "project-offeryou",
            section: "project",
            title: "OfferYou AI 岗位定制简历助手（个人产品项目）",
            dateRange: "2026.03 - 至今",
            bullets: ["独立完成产品定义与 MVP 范围收敛，设计岗位定制与快照导出链路。"],
            sourceText: "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
            confidence: "high",
            issues: []
          },
          {
            id: "project-content",
            section: "project",
            title: "AI 工具自媒体内容运营（个人项目）",
            dateRange: "2026.03 - 至今",
            bullets: ["策划并发布 AI 工具类深度图文系列。"],
            sourceText: "AI 工具自媒体内容运营 2026.03 - 至今",
            confidence: "high",
            issues: []
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "openai_compatible",
        updatedAt: "2026-05-07T00:00:00.000Z"
      },
      analysis: {
        fitScore: 82,
        optimizationMode: "baseline_jd_match",
        strengths: [],
        gaps: [],
        riskNotes: []
      },
      suggestions: [
        {
          id: "summary-ai",
          section: "summary",
          title: "个人优势",
          beforeText: "AI 产品实践者",
          afterText: [
            "AI 产品实践者：独立推进 OfferYou MVP，完成核心流程定义与接口草案。",
            "【JD 缺失能力提醒】：JD 强调 Claude Code，建议在总结中补充具体实践。"
          ].join("\n"),
          reasonText: "匹配 JD。",
          status: "accepted",
          sourceKind: "resume_baseline",
          sourceLabel: "AI 改写建议",
          revisionRound: 0
        },
        {
          id: "project-ai-content",
          candidateId: "project-content",
          section: "project",
          title: "AI 工具自媒体内容运营（个人项目）",
          beforeText: "策划并发布 AI 工具类深度图文系列。",
          afterText: "AI 工具自媒体内容运营（个人项目）\n2026.03 - 至今\n- 围绕 AI 工具和 Vibe Coding 主题策划深度图文，验证内容在目标用户群中的传播力。",
          reasonText: "对应 JD 中 AI 工具和 Vibe Coding 要求。",
          status: "accepted",
          sourceKind: "resume_baseline",
          sourceLabel: "AI 改写建议",
          revisionRound: 0
        }
      ],
      factSubmissions: [],
      masterFactsUsed: []
    });

    const resumeText = JSON.stringify(document);
    expect(resumeText).toContain("OfferYou AI 岗位定制简历助手");
    expect(resumeText).toContain("AI 工具自媒体内容运营");
    expect(resumeText).not.toContain("JD 缺失能力提醒");
    expect(resumeText).not.toContain("建议在总结中补充");
  });

  it("does not render education or credential text as work experience even when accepted suggestion is mislabeled", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-guard",
      userId: "user-1",
      company: "测试公司",
      jobTitle: "AI 产品经理",
      language: "zh-CN",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "需要 AI 产品经理",
      resumeExtractedText: "",
      calibratedResume: {
        status: "confirmed",
        personalInfo: {
          name: "吴世阳",
          phone: "18513449520",
          email: "434995517@qq.com"
        },
        entries: [
          {
            id: "edu-1",
            candidateId: "edu-1",
            section: "education",
            sectionType: "education",
            title: "对外经济贸易大学",
            dateRange: "2020 - 2022",
            bullets: ["硕士"],
            sourceText: "对外经济贸易大学\n2020 - 2022\n硕士",
            rawText: "对外经济贸易大学\n2020 - 2022\n硕士",
            confidence: "high",
            issues: []
          },
          {
            id: "work-1",
            candidateId: "work-1",
            section: "work",
            sectionType: "work",
            title: "广发银行北京分行 | 综合柜员岗",
            dateRange: "2022.08 - 2025.08",
            bullets: ["负责运营数据统计与客户服务。"],
            sourceText: "广发银行北京分行 | 综合柜员岗\n2022.08 - 2025.08\n负责运营数据统计与客户服务。",
            rawText: "广发银行北京分行 | 综合柜员岗\n2022.08 - 2025.08\n负责运营数据统计与客户服务。",
            confidence: "high",
            issues: []
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "openai_compatible",
        updatedAt: new Date().toISOString()
      },
      suggestions: [
        {
          id: "bad-1",
          candidateId: "edu-1",
          section: "experience",
          title: "学历：对外经济贸易大学 | 硕士英语：CET-6",
          beforeText: "学历：对外经济贸易大学 | 硕士\n英语：CET-6",
          afterText: "学历：对外经济贸易大学 | 硕士\n英语：CET-6",
          reasonText: "错误建议",
          status: "accepted",
          revisionRound: 0,
          sourceKind: "resume_baseline",
          sourceLabel: "测试"
        }
      ],
      analysis: {
        fitScore: 60,
        optimizationMode: "baseline_jd_match",
        strengths: [],
        gaps: [],
        riskNotes: []
      },
      factSubmissions: [],
      masterFactsUsed: []
    } as any);

    const workText = JSON.stringify(document.sections.find((section) => section.id === "work-experience")?.items ?? []);
    const educationText = JSON.stringify(document.sections.find((section) => section.id === "education")?.items ?? []);

    expect(workText).toContain("广发银行北京分行");
    expect(workText).not.toContain("CET-6");
    expect(workText).not.toContain("对外经济贸易大学");
    expect(educationText).toContain("对外经济贸易大学");
  });

  it("does not include a standalone supplement section in the final resume document", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-no-supplement",
      userId: "user-1",
      company: "测试公司",
      jobTitle: "AI 产品经理",
      language: "zh-CN",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "需要 AI 产品经理",
      resumeExtractedText: "",
      calibratedResume: {
        status: "confirmed",
        personalInfo: {
          name: "吴世阳",
          phone: "18513449520",
          email: "434995517@qq.com"
        },
        entries: [
          {
            id: "cred-1",
            candidateId: "cred-1",
            section: "credential",
            sectionType: "credential",
            title: "技能与证书",
            bullets: ["英语：CET-6", "基金从业资格证"],
            sourceText: "技能与证书\n英语：CET-6\n基金从业资格证",
            rawText: "技能与证书\n英语：CET-6\n基金从业资格证",
            confidence: "high",
            issues: []
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "deterministic_fallback",
        updatedAt: new Date().toISOString()
      },
      suggestions: [],
      analysis: {
        fitScore: 50,
        optimizationMode: "baseline_jd_match",
        strengths: [],
        gaps: [],
        riskNotes: []
      },
      factSubmissions: [],
      masterFactsUsed: []
    } as any);

    expect(document.sections.some((section) => section.id === "supplement" || section.title === "补充信息")).toBe(false);
  });

  it("does not render education or credential text as project experience when the body is mismatched", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-project-guard",
      userId: "user-1",
      company: "测试公司",
      jobTitle: "AI 产品经理",
      language: "zh-CN",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "需要 AI 产品经理",
      resumeExtractedText: "",
      calibratedResume: {
        status: "confirmed",
        personalInfo: {
          name: "吴世阳"
        },
        entries: [
          {
            id: "project-1",
            candidateId: "project-1",
            section: "project",
            sectionType: "project",
            title: "OfferYou AI 岗位定制简历助手",
            dateRange: "2026.03 - 至今",
            bullets: ["独立完成产品定义与 MVP 范围收敛。"],
            sourceText: "OfferYou AI 岗位定制简历助手\n2026.03 - 至今\n独立完成产品定义与 MVP 范围收敛。",
            rawText: "OfferYou AI 岗位定制简历助手\n2026.03 - 至今\n独立完成产品定义与 MVP 范围收敛。",
            confidence: "high",
            issues: []
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "openai_compatible",
        updatedAt: new Date().toISOString()
      },
      suggestions: [
        {
          id: "bad-project-1",
          candidateId: "project-1",
          section: "project",
          title: "岗位相关项目",
          beforeText: "OfferYou AI 岗位定制简历助手",
          afterText: "岗位相关项目\n学历：对外经济贸易大学｜硕士\n英语：CET-6",
          reasonText: "错误建议",
          status: "accepted",
          revisionRound: 0,
          sourceKind: "resume_baseline",
          sourceLabel: "测试"
        }
      ],
      analysis: {
        fitScore: 60,
        optimizationMode: "baseline_jd_match",
        strengths: [],
        gaps: [],
        riskNotes: []
      },
      factSubmissions: [],
      masterFactsUsed: []
    } as any);

    const projectText = JSON.stringify(document.sections.find((section) => section.id === "project-experience")?.items ?? []);

    expect(projectText).toContain("OfferYou AI 岗位定制简历助手");
    expect(projectText).not.toContain("CET-6");
    expect(projectText).not.toContain("对外经济贸易大学");
  });

  it("merges broken project bullet fragments like 一 + 键导出与投递记录 before rendering", async () => {
    const document = await composeSnapshotDocument({
      id: "draft-project-bullet-merge",
      userId: "user-1",
      company: "测试公司",
      jobTitle: "AI 产品经理",
      language: "zh-CN",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "需要 AI 产品经理",
      resumeExtractedText: "",
      calibratedResume: {
        status: "confirmed",
        personalInfo: {
          name: "吴世阳"
        },
        entries: [
          {
            id: "project-1",
            candidateId: "project-1",
            section: "project",
            sectionType: "project",
            title: "OfferYou AI 岗位定制简历助手（个人产品项目）",
            dateRange: "2026.03 - 至今",
            bullets: [
              "独立完成产品定义与 MVP 范围收敛，设计「输入即解构 → 导师式优化 → 快照派生」三阶段核心流程。",
              "核心模块：简历多格式解析（PDF/Word/图片 OCR）、JD 智能对齐分析（匹配度评分+差距分析）、一",
              "键导出与投递记录"
            ],
            sourceText:
              "OfferYou AI 岗位定制简历助手（个人产品项目）\n2026.03 - 至今\n独立完成产品定义与 MVP 范围收敛，设计「输入即解构 → 导师式优化 → 快照派生」三阶段核心流程。\n核心模块：简历多格式解析（PDF/Word/图片 OCR）、JD 智能对齐分析（匹配度评分+差距分析）、一\n键导出与投递记录",
            rawText:
              "OfferYou AI 岗位定制简历助手（个人产品项目）\n2026.03 - 至今\n独立完成产品定义与 MVP 范围收敛，设计「输入即解构 → 导师式优化 → 快照派生」三阶段核心流程。\n核心模块：简历多格式解析（PDF/Word/图片 OCR）、JD 智能对齐分析（匹配度评分+差距分析）、一\n键导出与投递记录",
            confidence: "high",
            issues: []
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "openai_compatible",
        updatedAt: new Date().toISOString()
      },
      suggestions: [],
      analysis: {
        fitScore: 80,
        optimizationMode: "baseline_jd_match",
        strengths: [],
        gaps: [],
        riskNotes: []
      },
      factSubmissions: [],
      masterFactsUsed: []
    } as any);

    const projectItems = document.sections.find((section) => section.id === "project-experience")?.items ?? [];
    const projectText = JSON.stringify(projectItems);

    expect(projectItems).toHaveLength(1);
    expect(projectText).toContain("一键导出与投递记录");
    expect(projectText).not.toContain("\"text\":\"键导出与投递记录\"");
    expect(projectText).not.toContain("\"bullets\":[\"键导出与投递记录\"");
  });
});
