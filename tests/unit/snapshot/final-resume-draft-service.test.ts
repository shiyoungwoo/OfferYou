import { describe, expect, it } from "vitest";
import { generateFinalResumeDraft } from "@/lib/services/snapshot/final-resume-draft-service";

describe("generateFinalResumeDraft", () => {
  it("uses calibrated resume entries to build a final document", async () => {
    const document = await generateFinalResumeDraft({
      calibratedResume: {
        status: "confirmed",
        personalInfo: {
          name: "吴世阳",
          phone: "18513449520",
          email: "434995517@qq.com"
        },
        entries: [
          {
            id: "summary-1",
            section: "summary",
            title: "独立完成产品定义与 MVP 范围收敛。",
            bullets: ["设计输入即解析、导师式优化、快照派生三阶段流程。"],
            sourceText: "独立完成产品定义与 MVP 范围收敛。",
            confidence: "high",
            issues: []
          },
          {
            id: "project-1",
            section: "project",
            title: "OfferYou AI 岗位定制简历助手",
            dateRange: "2026.03 - 至今",
            bullets: ["独立完成产品定义与 MVP 范围收敛。"],
            sourceText: "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
            confidence: "high",
            issues: []
          },
          {
            id: "education-1",
            section: "education",
            title: "对外经济贸易大学 硕士",
            dateRange: "2017.09 - 2021.06",
            bullets: ["信息管理与信息系统"],
            sourceText: "对外经济贸易大学 硕士 2017.09 - 2021.06",
            confidence: "high",
            issues: []
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "deterministic_fallback",
        updatedAt: "2026-04-28T00:00:00.000Z"
      },
      jdText: "AI 产品经理负责岗位定制、工作流设计与结果表达。",
      acceptedSuggestions: [
        {
          id: "s1",
          section: "project",
          title: "Accepted",
          beforeText: "Before",
          afterText: "Built AI product workflow",
          reasonText: "Reason",
          status: "accepted",
          sourceKind: "master_fact",
          sourceLabel: "Master fact",
          revisionRound: 0
        }
      ],
      company: "OfferYou",
      jobTitle: "AI 产品经理"
    });

    expect(document.header.name).toBe("吴世阳");
    expect(document.header.title).toBe("AI 产品经理");
    expect(JSON.stringify(document)).toContain("Built AI product workflow");
    expect(JSON.stringify(document.sections.find((section) => section.id === "education")?.items)).toContain(
      "对外经济贸易大学"
    );
  });

  it("keeps accepted AI rewrites aligned with preview while removing supplement and duplicate raw entries", async () => {
    const document = await generateFinalResumeDraft({
      calibratedResume: {
        status: "confirmed",
        personalInfo: {
          name: "吴世阳",
          phone: "18513449520",
          email: "434995517@qq.com"
        },
        entries: [
          {
            id: "summary-1",
            section: "summary",
            title: "AI 产品实践者：正在独立设计 AI 求职辅助产品 OfferYou，已完成 MVP 产品协议设计。",
            bullets: [],
            sourceText: "AI 产品实践者：正在独立设计 AI 求职辅助产品 OfferYou，已完成 MVP 产品协议设计。",
            confidence: "high",
            issues: []
          },
          {
            id: "summary-2",
            section: "summary",
            title: "数据驱动思维：数学本科 + 经济学硕士背景，熟练使用 Excel、Tableau、R、Stata。",
            bullets: [],
            sourceText: "数据驱动思维：数学本科 + 经济学硕士背景，熟练使用 Excel、Tableau、R、Stata。",
            confidence: "high",
            issues: []
          },
          {
            id: "work-1",
            section: "work",
            title: "广发银行北京分行",
            organization: "广发银行北京分行",
            role: "综合柜员岗",
            dateRange: "2022.08 - 2025.08",
            bullets: ["流程优化与数据分析：协助网点负责人进行运营数据统计与分析。"],
            sourceText: "广发银行北京分行｜综合柜员岗｜2022.08 - 2025.08\n流程优化与数据分析：协助网点负责人进行运营数据统计与分析。",
            confidence: "high",
            issues: []
          },
          {
            id: "project-1",
            section: "project",
            title: "OfferYou AI 岗位定制简历助手",
            dateRange: "2026.03 - 至今",
            bullets: ["独立完成产品定义与 MVP 范围收敛。"],
            sourceText: "OfferYou AI 岗位定制简历助手 2026.03 - 至今\n独立完成产品定义与 MVP 范围收敛。",
            confidence: "high",
            issues: []
          },
          {
            id: "education-1",
            section: "education",
            title: "对外经济贸易大学 | 硕士 | 全球价值链（应用经济学） 2020 - 2022 湖南工业大学 | 本科 | 数学与应用数学（金融统计） 2013 - 2017",
            bullets: [],
            sourceText: "对外经济贸易大学 | 硕士 | 全球价值链（应用经济学） 2020 - 2022 湖南工业大学 | 本科 | 数学与应用数学（金融统计） 2013 - 2017",
            confidence: "medium",
            issues: []
          },
          {
            id: "supplement-1",
            section: "supplement",
            title: "技能与证书",
            bullets: ["英语六级 / Excel / Tableau / R / Stata"],
            sourceText: "技能与证书\n英语六级 / Excel / Tableau / R / Stata",
            confidence: "medium",
            issues: []
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "openai_compatible",
        updatedAt: "2026-04-30T00:00:00.000Z"
      },
      jdText: "AI 产品经理岗位要求 AI 工具应用、Prompt Engineering、产品流程设计、数据分析与结果表达。",
      acceptedSuggestions: [
        {
          id: "summary-ai",
          section: "summary",
          title: "个人优势",
          beforeText: "AI 产品实践者\n数据驱动思维",
          afterText: [
            "AI 产品设计与落地：独立设计并推进 AI 求职辅助产品 OfferYou，完成 MVP 协议、RESTful API 草案及前端状态机设计。",
            "数据驱动决策：数学与经济学背景，熟练运用 Excel、Tableau、R、Stata 进行数据清洗、建模与分析。",
            "AI 内容运营与传播：独立运营 AI 工具类自媒体，单篇阅读量 8000+、点赞收藏 700+。"
          ].join("\n"),
          reasonText: "贴合 JD 对 AI 工具、Prompt 和数据表达的要求。",
          status: "accepted",
          sourceKind: "target_role_fit",
          sourceLabel: "小米 MiMo 改写建议",
          revisionRound: 0
        },
        {
          id: "work-ai",
          section: "experience",
          title: "广发银行经历",
          beforeText: "广发银行北京分行｜综合柜员岗｜2022.08 - 2025.08",
          afterText: [
            "广发银行北京分行｜综合柜员岗｜2022.08 - 2025.08",
            "流程优化与数据分析：协助网点负责人统计运营数据，识别业务量波动并为排班与窗口调整提供依据。",
            "B 端客户服务：面向中铁、中国物流集团等 B 端客户提供产品讲解与方案推介，积累客户沟通经验。"
          ].join("\n"),
          reasonText: "贴合 JD 对数据分析和方案表达的要求。",
          status: "accepted",
          sourceKind: "target_role_fit",
          sourceLabel: "小米 MiMo 改写建议",
          revisionRound: 0
        },
        {
          id: "project-ai",
          section: "project",
          title: "OfferYou 项目",
          beforeText: "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
          afterText: [
            "OfferYou AI 岗位定制简历助手 2026.03 - 至今",
            "独立完成产品定义与 MVP 范围收敛，设计「输入即解析 → 导师式优化 → 快照派生」三阶段核心 AI 工作流。",
            "输出完整的产品输入输出协议文档、OpenAPI 3.1 接口草案及前端状态机设计。"
          ].join("\n"),
          reasonText: "贴合 JD 对 AI 产品流程和 Prompt 应用的要求。",
          status: "accepted",
          sourceKind: "target_role_fit",
          sourceLabel: "小米 MiMo 改写建议",
          revisionRound: 0
        }
      ],
      company: "图灵文化",
      jobTitle: "AI 产品经理"
    });

    const sectionTitles = document.sections.map((section) => section.title);
    expect(sectionTitles).toEqual(["个人信息", "个人优势", "工作经历", "项目经历", "教育背景"]);

    const personalInfoText = JSON.stringify(document.sections.find((section) => section.id === "personal-info")?.items);
    expect(personalInfoText).toContain("英语：六级");
    expect(JSON.stringify(document.sections)).not.toContain("技能与证书");

    const strengthText = JSON.stringify(document.sections.find((section) => section.id === "personal-strengths")?.items);
    expect(strengthText).toContain("AI 产品设计与落地");
    expect(strengthText).toContain("AI 内容运营与传播");
    expect(strengthText).not.toContain("正在独立设计 AI 求职辅助产品");

    const workText = JSON.stringify(document.sections.find((section) => section.id === "work-experience")?.items);
    expect(workText).toContain("排班与窗口调整");
    expect(workText.match(/广发银行北京分行/g)?.length).toBe(1);

    const projectText = JSON.stringify(document.sections.find((section) => section.id === "project-experience")?.items);
    expect(projectText).toContain("输入即解析");
    expect(projectText.match(/OfferYou AI 岗位定制简历助手/g)?.length).toBe(1);

    const educationText = JSON.stringify(document.sections.find((section) => section.id === "education")?.items);
    expect(educationText).toContain("对外经济贸易大学");
    expect(educationText).toContain("湖南工业大学");
  });
});
