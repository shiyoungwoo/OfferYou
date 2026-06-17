import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON: vi.fn()
}));

import { callModelJSON } from "@/lib/ai/model-gateway";
import {
  calibrateResumeStructure,
  calibrateResumeStructureDeterministic
} from "@/lib/services/calibration/resume-calibration-service";

describe("calibrateResumeStructureDeterministic", () => {
  it("keeps education in education section and suspicious OCR text in warnings", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "示例候选人",
        "手机：13800000000 邮箱：candidate@example.com",
        "项目经历",
        "O\"erYou ) AI 岗位定制简历助手 2026.03 - 至今",
        "独立完成产品定义与 MVP 范围收敛。",
        "教育背景",
        "对外经济贸易大学 硕士 2017.09 - 2021.06"
      ].join("\n")
    });

    expect(result.personalInfo.name).toBe("示例候选人");
    expect(result.personalInfo.phone).toBe("13800000000");
    const educationEntry = result.entries.find(
      (entry) => entry.section === "education" && entry.title.includes("对外经济贸易大学")
    );

    expect(educationEntry).toBeTruthy();
    expect(educationEntry?.candidateId).toBe(educationEntry?.id);
    expect(educationEntry?.sectionType).toBe("education");
    expect(educationEntry?.rawText).toContain("对外经济贸易大学");
    expect(result.entries.some((entry) => entry.title.includes("OfferYou"))).toBe(true);
    expect(result.status).toBe("confirmed");
  });

  it("recognizes markdown headings and spaced Chinese names from PDF extraction", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "# 李 明 轩",
        "男 | 31岁 | 共产党员 | 13800000000 | candidate@example.com",
        "## 项 目 经 历",
        "O\"erYou ) AI 岗位定制简历助手 （个人产品项目） 2026.03 - 至今",
        "独立完成产品定义与 MVP 范围收敛。",
        "## 工 作 经 历",
        "陕西怡阳医疗科技有限公司 % 数据工程师 2025.09 - 2025.11"
      ].join("\n")
    });

    expect(result.personalInfo.name).toBe("李明轩");
    expect(result.entries.some((entry) => entry.section === "project" && entry.title.includes("OfferYou"))).toBe(true);
    expect(result.entries.some((entry) => entry.section === "work" && entry.title.includes("陕西怡阳"))).toBe(true);
    expect(JSON.stringify(result.entries)).not.toContain("陕西正大");
  });

  it("recognizes widely spaced Chinese names from PDF text and does not create an other entry for the name", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "李     明     轩",
        "13800000000 | candidate@example.com",
        "个人优势",
        "产品 0→1 落地经验：具备 AI 产品落地经验。",
        "教育背景",
        "对外经济贸易大学 | 硕士 | 全球价值链（应用经济学） 2020 - 2022"
      ].join("\n")
    });

    expect(result.personalInfo.name).toBe("李明轩");
    expect(result.entries.some((entry) => entry.section === "other_needs_review" && entry.title.includes("李"))).toBe(false);
  });

  it("classifies language and certificates as credential instead of work", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "示例候选人",
        "技能与证书",
        "英语：CET-6",
        "基金从业资格证",
        "工作经历",
        "广发银行北京分行 | 综合柜员岗 2022.08 - 2025.08",
        "负责运营数据统计与客户服务。"
      ].join("\n")
    });

    expect(result.entries.some((entry) => entry.section === "credential" && entry.rawText?.includes("CET-6"))).toBe(true);
    expect(result.entries.some((entry) => entry.section === "work" && entry.rawText?.includes("CET-6"))).toBe(false);
    expect(result.entries.some((entry) => entry.section === "work" && entry.rawText?.includes("广发银行"))).toBe(true);
  });

  it("keeps unknown blocks in other_needs_review and does not promote them to work", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "其他信息",
        "2026/3/11 00:26 示例候选人 - AI 产品经理简历",
        "file:///tmp/resume-ai-pm.html"
      ].join("\n")
    });

    expect(result.entries.some((entry) => entry.section === "other_needs_review")).toBe(true);
    expect(result.entries.some((entry) => entry.section === "work")).toBe(false);
  });

  it("keeps project body lines under their project instead of promoting them to fake projects", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "示例候选人",
        "手机：13800000000 邮箱：candidate@example.com",
        "项目经历",
        "OfferYou AI 岗位定制简历助手 （个人产品项目） 2026.03 - 至今",
        "独立完成产品定义与 MVP 范围收敛，设计「输入即解构 → 导师式优化 → 快照派生」三阶段核心流程。",
        "输出完整的产品输入输出协议文档、OpenAPI 3.1 接口草案、前端四页面状态机设计。",
        "定义「绝对防失真」原则，AI 仅提供带理由的局部改写建议，用户逐条确认。",
        "AI 工具自媒体内容运营 （个人项目） 2026.03 - 至今",
        "策划并发布 AI 工具类深度图文系列，覆盖小红书、微信公众号、微博三平台。",
        "「Codex + Obsidian 智能工作流」单篇阅读量 8000+，点赞收藏 700+。"
      ].join("\n")
    });

    const projects = result.entries.filter((entry) => entry.section === "project");

    expect(projects).toHaveLength(2);
    expect(projects[0]?.title).toContain("OfferYou");
    expect(projects[0]?.dateRange).toBe("2026.03 - 至今");
    expect(projects[0]?.bullets.join(" ")).toContain("独立完成产品定义");
    expect(projects[0]?.bullets.join(" ")).toContain("OpenAPI 3.1");
    expect(projects[0]?.bullets.join(" ")).toContain("绝对防失真");
    expect(projects[0]?.candidateId).toBe(projects[0]?.id);
    expect(projects[0]?.sectionType).toBe("project");
    expect(projects[0]?.rawText).toContain("独立完成产品定义");
    expect(projects[1]?.title).toContain("AI 工具自媒体内容运营");
    expect(projects[1]?.bullets.join(" ")).toContain("Codex + Obsidian");
  });

  it("attaches standalone education date lines to the previous school entry", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "示例候选人",
        "手机：13800000000 邮箱：candidate@example.com",
        "教育背景",
        "对外经济贸易大学 | 硕士 | 全球价值链（应用经济学）",
        "2020 - 2022",
        "湖南工业大学 | 本科 | 数学与应用数学（金融统计）",
        "2013 - 2017"
      ].join("\n")
    });

    const education = result.entries.filter((entry) => entry.section === "education");

    expect(education).toHaveLength(2);
    expect(education[0]?.title).toContain("对外经济贸易大学");
    expect(education[0]?.dateRange).toBe("2020 - 2022");
    expect(education[0]?.candidateId).toBe(education[0]?.id);
    expect(education[0]?.sectionType).toBe("education");
    expect(education[0]?.rawText).toContain("对外经济贸易大学");
    expect(education[1]?.title).toContain("湖南工业大学");
    expect(education[1]?.dateRange).toBe("2013 - 2017");
    expect(education.some((entry) => /^\d{4}\s*-\s*\d{4}$/.test(entry.title))).toBe(false);
  });

  it("normalizes wrapped real resume sections without losing summary, role, or major fields", () => {
    const result = calibrateResumeStructureDeterministic({
      resumeText: [
        "李 明 轩",
        "13800000000 | ✉ candidate@example.com | 硕士 | 对外经济贸易大学",
        "CET-6 | 基金从业资格 | 银行从业资格 | GitHub：github.com/shiyoungwoo",
        "求职意向：AI 产品经理（金融科技 / AI Agent 方向）",
        "个人优势",
        "产品 0→1 落地经验：具备 AI 金融智能客服从需求洞察、POC 验证到上线运营、评测及优化的完整闭环经验，推动智能客服 AI 承接率较 1.0 版本提",
        "升 30%，平均响应缩短 12 秒，人工成本节约 40%。",
        "AI Agent 解决方案能力：参与金融智能客服、业务数据分析的 AI Agent 方案设计与落地，深度协同算法团队推进 RAG 检索增强、Prompt 优化、",
        "模型微调等技术能力产品化。",
        "工作经历",
        "广发银行股份有限公司北京分行 2022.08 - 2026.03",
        "AI 场景经理（2025.04 - 2026.03）",
        "项目一：员工业务智能助手（对内）",
        "负责面向银行内部员工的智能助手产品设计，帮助一线员工快速查询运营知识、业务操作规范与合规要点，降低新员工上手门槛",
        "综合运营岗（管培生）（2022.08 - 2025.03）",
        "协助网点负责人进行运营数据统计分析，监控业务量波动并定位异常。",
        "教育背景",
        "对外经济贸易大学 | 硕士 | 全球价值链（应用经济学） 2020 - 2022",
        "湖南工业大学 | 本科 | 数学与应用数学（金融统计） 2013 - 2017"
      ].join("\n")
    });

    const summary = result.entries.find((entry) => entry.section === "summary");
    expect(summary?.title).toBe("个人优势");
    expect(summary?.bullets.join("\n")).toContain("提升 30%");
    expect(summary?.bullets.join("\n")).toContain("模型微调");

    const work = result.entries.filter((entry) => entry.section === "work");
    expect(work.some((entry) => entry.organization === "广发银行股份有限公司北京分行" && entry.role === "AI 场景经理")).toBe(true);
    expect(work.some((entry) => entry.organization === "广发银行股份有限公司北京分行" && entry.role === "综合运营岗（管培生）")).toBe(true);
    expect(work.some((entry) => entry.title === "AI 场景经理" && !entry.organization)).toBe(false);
    expect(work.find((entry) => entry.role === "AI 场景经理")?.bullets.join("\n")).not.toContain("项目一");

    const projects = result.entries.filter((entry) => entry.section === "project");
    expect(projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "员工业务智能助手（对内）",
          organization: "广发银行股份有限公司北京分行",
          role: "AI 场景经理"
        })
      ])
    );
    expect(projects.find((entry) => entry.title === "员工业务智能助手（对内）")?.bullets).toEqual(
      expect.arrayContaining([
        "负责面向银行内部员工的智能助手产品设计，帮助一线员工快速查询运营知识、业务操作规范与合规要点，降低新员工上手门槛"
      ])
    );

    const education = result.entries.filter((entry) => entry.section === "education");
    expect(education).toHaveLength(2);
    expect(education).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "对外经济贸易大学",
          role: "硕士",
          organization: "全球价值链（应用经济学）"
        }),
        expect.objectContaining({
          title: "湖南工业大学",
          role: "本科",
          organization: "数学与应用数学（金融统计）"
        })
      ])
    );
  });
});

describe("calibrateResumeStructure", () => {
  it("falls back to deterministic calibration when the model is unavailable", async () => {
    vi.mocked(callModelJSON).mockResolvedValue({
      provider: "deterministic_fallback",
      data: null,
      fallbackReason: "未检测到模型"
    });

    const result = await calibrateResumeStructure({
      resumeText: [
        "示例候选人",
        "手机：13800000000 邮箱：candidate@example.com",
        "项目经历",
        "O\"erYou ) AI 岗位定制简历助手 2026.03 - 至今"
      ].join("\n")
    });

    expect(result.modelProvider).toBe("deterministic_fallback");
    expect(result.modelNotes.join(" ")).toContain("未检测到模型");
  });

  it("falls back when the model returns an invalid structure", async () => {
    vi.mocked(callModelJSON).mockResolvedValue({
      provider: "gemini",
      data: {
        status: "confirmed",
        personalInfo: { name: "示例候选人" },
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: [],
        modelProvider: "gemini"
      }
    });

    const result = await calibrateResumeStructure({
      resumeText: [
        "示例候选人",
        "手机：13800000000 邮箱：candidate@example.com",
        "项目经历",
        "O\"erYou ) AI 岗位定制简历助手 2026.03 - 至今"
      ].join("\n")
    });

    expect(result.modelProvider).toBe("deterministic_fallback");
    expect(result.modelNotes.join(" ")).toContain("模型返回结构无法通过校验");
    expect(result.status).toBe("needs_review");
  });

  it("normalizes MiMo sections format with type/dates aliases", async () => {
    vi.mocked(callModelJSON).mockResolvedValue({
      provider: "openai_compatible",
      data: {
        sections: [
          {
            type: "personal_info",
            content: {
              name: "张三",
              phone: "13800138000",
              email: "zhangsan@example.com",
              location: "北京"
            },
            confidence: "high",
            issues: []
          },
          {
            type: "summary",
            title: "个人优势",
            bullets: ["8年互联网产品经验，3年AI产品经验。"],
            confidence: "high",
            issues: []
          },
          {
            type: "work",
            title: "字节跳动",
            organization: "字节跳动",
            role: "AI产品经理",
            dates: "2021-至今",
            bullets: ["负责飞书AI助手产品规划"],
            confidence: "high",
            issues: []
          },
          {
            type: "education",
            title: "北京大学",
            role: "硕士",
            organization: "计算机科学与技术",
            dates: "2016-2018",
            bullets: [],
            confidence: "high",
            issues: []
          }
        ]
      }
    });

    const result = await calibrateResumeStructure({
      resumeText: "张三\n手机：13800138000\n个人优势\n8年互联网产品经验。\n工作经历\n字节跳动 | AI产品经理 | 2021-至今\n教育背景\n北京大学 | 硕士 | 2016-2018"
    });

    expect(result.modelProvider).toBe("openai_compatible");
    expect(result.status).toBe("needs_review");
    expect(result.personalInfo.name).toBe("张三");
    expect(result.personalInfo.phone).toBe("13800138000");
    expect(result.personalInfo.email).toBe("zhangsan@example.com");

    expect(result.entries).toHaveLength(3); // personal_info excluded, 3 others kept

    const summary = result.entries.find((e) => e.section === "summary");
    expect(summary?.title).toBe("个人优势");
    expect(summary?.bullets).toEqual(["8年互联网产品经验，3年AI产品经验。"]);

    const work = result.entries.find((e) => e.section === "work");
    expect(work?.title).toBe("字节跳动");
    expect(work?.role).toBe("AI产品经理");
    expect(work?.dateRange).toBe("2021-至今");
    expect(work?.organization).toBe("字节跳动");

    const education = result.entries.find((e) => e.section === "education");
    expect(education?.title).toBe("北京大学");
    expect(education?.role).toBe("硕士");
    expect(education?.dateRange).toBe("2016-2018");
    expect(education?.organization).toBe("计算机科学与技术");

    expect(result.personalInfo.educationSummary).toContain("北京大学");
    expect(result.personalInfo.educationSummary).toContain("2016-2018");
  });

  it("normalizes MiMo flat-keys format (personal_info/work/education at top level)", async () => {
    vi.mocked(callModelJSON).mockResolvedValue({
      provider: "openai_compatible",
      data: {
        personal_info: {
          name: "张三",
          phone: "13800138000",
          email: "zhangsan@example.com",
          location: "北京"
        },
        summary: "8年互联网产品经验。",
        work: [
          {
            company: "字节跳动",
            position: "AI产品经理",
            duration: "2021-至今",
            description: "负责飞书AI助手产品规划"
          }
        ],
        education: [
          {
            institution: "北京大学",
            degree: "硕士",
            major: "计算机科学与技术",
            duration: "2016-2018"
          }
        ]
      }
    });

    const result = await calibrateResumeStructure({
      resumeText: "张三\n手机：13800138000\n个人优势\n8年互联网产品经验。\n工作经历\n字节跳动 | AI产品经理 | 2021-至今\n教育背景\n北京大学 | 硕士 | 2016-2018"
    });

    expect(result.modelProvider).toBe("openai_compatible");
    expect(result.status).toBe("needs_review");
    expect(result.personalInfo.name).toBe("张三");
    expect(result.personalInfo.phone).toBe("13800138000");
    expect(result.personalInfo.email).toBe("zhangsan@example.com");
    expect(result.personalInfo.location).toBe("北京");

    expect(result.entries).toHaveLength(3); // summary + work + education

    const summary = result.entries.find((e) => e.section === "summary");
    expect(summary?.title).toBe("个人优势");
    expect(summary?.bullets).toEqual(["8年互联网产品经验。"]);

    const work = result.entries.find((e) => e.section === "work");
    expect(work?.title).toBe("字节跳动");
    expect(work?.role).toBe("AI产品经理");
    expect(work?.dateRange).toBe("2021-至今");
    expect(work?.bullets).toEqual(["负责飞书AI助手产品规划"]);

    const education = result.entries.find((e) => e.section === "education");
    expect(education?.title).toBe("北京大学");
    expect(education?.role).toBe("硕士");
    expect(education?.organization).toBe("计算机科学与技术");
    expect(education?.dateRange).toBe("2016-2018");

    expect(result.personalInfo.educationSummary).toContain("北京大学");
    expect(result.personalInfo.educationSummary).toContain("2016");
  });

  it("normalizes usable model entries that omit mechanical fields", async () => {
    vi.mocked(callModelJSON).mockResolvedValue({
      provider: "openai_compatible",
      data: {
        status: "confirmed",
        personalInfo: { name: "示例候选人", phone: "13800000000" },
        entries: [
          {
            section: "project",
            title: "OfferYou AI 岗位定制简历助手",
            dateRange: "2026.03 - 至今",
            bullets: "完成 MVP 产品协议设计；设计 JD 智能对齐分析",
            confidence: "high"
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: ["模型校准完成"]
      }
    });

    const result = await calibrateResumeStructure({
      resumeText: "OfferYou AI 岗位定制简历助手 2026.03 - 至今"
    });

    expect(result.modelProvider).toBe("openai_compatible");
    expect(result.entries[0]?.id).toBeTruthy();
    expect(result.entries[0]?.candidateId).toBe(result.entries[0]?.id);
    expect(result.entries[0]?.sectionType).toBe("project");
    expect(result.entries[0]?.sourceText).toContain("OfferYou AI 岗位定制简历助手");
    expect(result.entries[0]?.rawText).toContain("OfferYou AI 岗位定制简历助手");
    expect(result.entries[0]?.bullets).toEqual(["完成 MVP 产品协议设计", "设计 JD 智能对齐分析"]);
  });

  it("uses deterministic recovery when model calibration drops summary, dates, and work entries", async () => {
    vi.mocked(callModelJSON).mockResolvedValue({
      provider: "openai_compatible",
      data: {
        status: "confirmed",
        personalInfo: {
          name: "示例候选人",
          phone: "13800000000",
          email: "candidate@example.com"
        },
        entries: [
          {
            id: "work-1",
            section: "work",
            title: "广发银行股份有限公司北京分行",
            organization: "广发银行股份有限公司北京分行",
            role: "AI 产品经理",
            bullets: [],
            sourceText: "广发银行股份有限公司北京分行 AI 产品经理",
            confidence: "high",
            issues: []
          },
          {
            id: "project-1",
            section: "project",
            title: "员工业务智能助手（对内）",
            role: "AI 产品经理",
            bullets: [
              "成果：业务知识查询效率提升 60%，合规培训覆盖率显著提高，新员工独立上岗周期缩短综合运营岗（管培生）（2022.08 - 2025.03）",
              "协助运营数据统计分析。"
            ],
            sourceText: "员工业务智能助手（对内）",
            confidence: "high",
            issues: []
          }
        ],
        unclassifiedText: [],
        parseWarnings: [],
        modelNotes: []
      }
    });

    const result = await calibrateResumeStructure({
      resumeText: [
        "李 明 轩",
        "13800000000 | candidate@example.com",
        "求职意向：AI 产品经理（金融科技 / AI Agent 方向）",
        "个人优势",
        "产品 0→1 落地经验：具备 AI 金融智能客服从需求洞察、POC 验证到上线运营的经验。",
        "工作经历",
        "广发银行股份有限公司北京分行 2022.08 - 2026.03",
        "AI 场景经理（2025.04 - 2026.03）",
        "项目一：员工业务智能助手（对内）",
        "负责面向银行内部员工的智能助手产品设计。",
        "综合运营岗（管培生）（2022.08 - 2025.03）",
        "协助网点负责人进行运营数据统计分析。",
        "北京金山云网络技术有限公司 — 财务分析 / 财务 BP（实习） 2021.06 - 2022.06",
        "运用 Excel 和 Tableau 搭建自动化预算分析模板。",
        "信阳鹰博户外拓展训练有限公司 — 培训策划专员 / 数学辅导教师 2017.09 - 2019.12",
        "参与公司创新创业项目策划。",
        "教育背景",
        "对外经济贸易大学 | 硕士 | 全球价值链（应用经济学） 2020 - 2022"
      ].join("\n")
    });

    expect(result.modelProvider).toBe("deterministic_fallback");
    expect(result.modelNotes.join(" ")).toContain("模型校准结果缺少关键模块");
    expect(result.entries.some((entry) => entry.section === "summary")).toBe(true);
    expect(result.entries.filter((entry) => entry.section === "work")).toHaveLength(4);
    expect(result.entries.filter((entry) => Boolean(entry.dateRange)).length).toBeGreaterThanOrEqual(5);
  });
});
