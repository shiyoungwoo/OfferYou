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
      jdPreview: "preview",
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
          revisionRound: 0
        }
      ],
      factSubmissions: []
    });

    expect(JSON.stringify(document)).toContain("Built AI product workflow");
    expect(JSON.stringify(document)).not.toContain("Ignored text");
    expect(document.sections.map((section) => section.title)).toEqual([
      "个人优势",
      "工作经历",
      "实习经历",
      "项目经历",
      "教育经历",
      "证书 / 技能"
    ]);
    expect(document.header.title).toBe("AI Product Manager");
    expect(document.header.photo?.label).toBe("照片");
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
      jdPreview: "preview",
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
      jdPreview: "preview",
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
      masterFactsUsed: [],
      suggestions: [],
      factSubmissions: []
    });

    expect(document.sections.find((section) => section.id === "work-experience")?.items[0]).toMatchObject({
      type: "entry",
      heading: "某科技有限公司",
      subheading: "运营经理",
      meta: "2021.03-2023.08"
    });
    expect(document.sections.find((section) => section.id === "internship-experience")?.items[0]).toMatchObject({
      type: "entry",
      heading: "某咨询公司",
      subheading: "实习生",
      meta: "2019.06-2019.09"
    });
    expect(document.sections.find((section) => section.id === "internship-experience")?.items[0]).toMatchObject({
      bullets: ["输出竞品分析摘要并支持交付汇报"]
    });
    expect(document.sections.find((section) => section.id === "education")?.items[0]).toMatchObject({
      type: "entry",
      heading: "复旦大学",
      subheading: "市场营销 ｜ 本科",
      meta: "2016-2020"
    });
    expect(JSON.stringify(document.sections.find((section) => section.id === "certificates-skills")?.items)).toContain("Excel");
  });
});
