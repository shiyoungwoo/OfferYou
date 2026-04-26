import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";

export type WorkspaceSummary = {
  fitScore: number;
  optimizationMode: "baseline_jd_match" | "talent_amplified";
  strengths: string[];
  gaps: string[];
  riskNotes: string[];
};

export type WorkspaceMasterFactReference = {
  id: string;
  title: string;
  summary: string;
  blockType: "summary" | "experience" | "project" | "education" | "skill" | "certificate" | "other";
};

export type WorkspaceSuggestion = {
  id: string;
  section: string;
  title: string;
  beforeText: string;
  afterText: string;
  reasonText: string;
  status: "pending" | "accepted" | "rejected";
  sourceKind: "resume_baseline" | "master_fact" | "target_role_fit" | "revision";
  sourceLabel: string;
  revisionRound?: number;
  parentSuggestionId?: string;
  userFeedbackType?: string;
  userFeedbackText?: string;
};

export type WorkspaceSnapshotOutline = {
  pageEstimate: number;
  sections: Array<{
    title: string;
    itemCount: number;
    items: string[];
  }>;
};

export type WorkspaceData = {
  company: string;
  jobTitle: string;
  stage: "analysis_ready";
  summary: WorkspaceSummary;
  talentProfileUsed?: {
    id: string;
    headline: string;
    confidenceNote: string;
  };
  careerDirectionUsed?: {
    id: string;
    slug: string;
    label: string;
    rationale: string;
    watchOut: string;
  };
  masterFactsUsed: WorkspaceMasterFactReference[];
  suggestions: WorkspaceSuggestion[];
  snapshot: WorkspaceSnapshotOutline;
  factSubmissionCount?: number;
};

export async function getAnalysisWorkspaceData(draftId: string): Promise<WorkspaceData> {
  const persisted = await readWorkspaceDraft(draftId);

  if (persisted) {
    return {
      company: persisted.company,
      jobTitle: persisted.jobTitle,
      stage: persisted.stage,
      summary: persisted.analysis,
      talentProfileUsed: persisted.talentProfileUsed,
      careerDirectionUsed: persisted.careerDirectionUsed,
      masterFactsUsed: persisted.masterFactsUsed ?? [],
      suggestions: persisted.suggestions,
      factSubmissionCount: persisted.factSubmissions.length,
      snapshot: {
        pageEstimate: 2,
        sections: [
          {
            title: "Summary",
            itemCount: 1,
            items: [`Tailored for ${persisted.jobTitle} at ${persisted.company}.`]
          },
          {
            title: "Accepted Evidence",
            itemCount: persisted.suggestions.length,
            items: persisted.suggestions.map((suggestion) => suggestion.title)
          },
          {
            title: "Source Material",
            itemCount: 1,
            items: [persisted.resumeSourceRef ?? "Manual resume source"]
          }
        ]
      }
    };
  }

  return {
    company: "星北科技",
    jobTitle: "客户成功负责人",
    stage: "analysis_ready",
    summary: {
      fitScore: 74,
      optimizationMode: "baseline_jd_match",
      strengths: [
        "过往经历多次展现出在复杂环境中引导他人、降低项目不确定性的强项。",
        "有充分证据表明其具备结构化解决问题和建立信任的能力，且高度可迁移至该岗位。"
      ],
      gaps: [
        "当前的表述仍需要更强有力的、可量化的客户或业务成果作为支撑。",
        "部分经历需要围绕目标岗位的核心职责进行更清晰的重构。"
      ],
      riskNotes: [
        "如果最强的证据仍是间接或通用能力，建议不要过度夸大直接胜任度。",
        "确保所有关于优势的描述都锚定在具体经历上，避免使用空泛的自我评估标签。"
      ]
    },
    talentProfileUsed: undefined,
    careerDirectionUsed: undefined,
    masterFactsUsed: [],
    suggestions: [
      {
        id: `${draftId}-s1`,
        section: "project",
        title: "体现引导与梳理能力",
        beforeText: "帮助团队梳理不清晰的流程，把杂乱的信息转化为可执行的下一步。",
        afterText:
          "在充满不确定性的环境中引导团队，将零散信息转化为清晰的执行步骤，展现出极强的抗压梳理能力和面向客户的工作流支持能力。",
        reasonText: "这样重构能更好地突出你在用户引导、梳理复杂信息和建立信任方面的优势。",
        status: "pending",
        revisionRound: 0,
        sourceKind: "resume_baseline",
        sourceLabel: "简历原文"
      },
      {
        id: `${draftId}-s2`,
        section: "experience",
        title: "跨部门协作交付",
        beforeText: "协调各部门推进工作，在需求不明确的情况下保持项目进展。",
        afterText:
          "在不断变化的需求中跨团队协调推进交付，展现出在复杂协作、持续跟进执行和面向客户交付维度的可迁移优势。",
        reasonText: "跳出特定职能框架，重点强化你能平移到新岗位的底层通用能力。",
        status: "pending",
        revisionRound: 0,
        sourceKind: "target_role_fit",
        sourceLabel: "岗位适配分析"
      }
    ],
    factSubmissionCount: 0,
    snapshot: {
      pageEstimate: 2,
      sections: [
        {
          title: "核心优势",
          itemCount: 1,
          items: ["具备出色的引导力、结构化梳理能力以及应对复杂模糊环境的优势。"]
        },
        {
          title: "项目经历",
          itemCount: 2,
          items: ["工作流搭建与团队支持", "跨部门协作执行案例"]
        },
        {
          title: "专业技能",
          itemCount: 3,
          items: ["客户需求引导", "业务流梳理", "结构化执行落地"]
        }
      ]
    }
  };
}
