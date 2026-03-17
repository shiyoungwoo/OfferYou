import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";

export type WorkspaceSummary = {
  fitScore: number;
  strengths: string[];
  gaps: string[];
  riskNotes: string[];
};

export type WorkspaceSuggestion = {
  id: string;
  section: string;
  title: string;
  beforeText: string;
  afterText: string;
  reasonText: string;
  status: "pending" | "accepted" | "rejected";
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
  suggestions: WorkspaceSuggestion[];
  snapshot: WorkspaceSnapshotOutline;
};

export async function getAnalysisWorkspaceData(draftId: string): Promise<WorkspaceData> {
  const persisted = await readWorkspaceDraft(draftId);

  if (persisted) {
    return {
      company: persisted.company,
      jobTitle: persisted.jobTitle,
      stage: persisted.stage,
      summary: persisted.analysis,
      suggestions: persisted.suggestions,
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
    company: "OfferYou",
    jobTitle: "AI Product Manager",
    stage: "analysis_ready",
    summary: {
      fitScore: 74,
      strengths: [
        "Strong workflow design and ambiguity reduction fit the JD core shape.",
        "Direct product building evidence through OfferYou creates credible category alignment."
      ],
      gaps: [
        "Outcome metrics need sharper framing for AI product hiring standards.",
        "The current narrative needs clearer user-facing impact in each top block."
      ],
      riskNotes: [
        "Do not overstate platform ownership if the work was primarily design and orchestration.",
        "Keep talent claims grounded in evidence instead of identity labels."
      ]
    },
    suggestions: [
      {
        id: `${draftId}-s1`,
        section: "project",
        title: "OfferYou founder block",
        beforeText: "Designed an AI job-seeking product and completed the MVP protocol and API draft.",
        afterText:
          "Independently designed OfferYou, an AI-assisted resume tailoring workflow with deconstruct, mentor, and snapshot stages, translating a job-seeking pain point into a full MVP protocol and execution model.",
        reasonText: "This frames the work as product system design rather than a loose side project note.",
        status: "pending"
      },
      {
        id: `${draftId}-s2`,
        section: "experience",
        title: "Workflow packaging evidence",
        beforeText: "Built AI-assisted publishing workflows across several social platforms.",
        afterText:
          "Packaged multi-step AI publishing workflows across Xiaohongshu, WeChat, and Weibo, turning repeated cross-platform operations into reusable release systems.",
        reasonText: "This sharpens system-building evidence and keeps the claim tied to reusable workflow outcomes.",
        status: "pending"
      }
    ],
    snapshot: {
      pageEstimate: 2,
      sections: [
        {
          title: "Summary",
          itemCount: 1,
          items: ["AI PM with strong workflow abstraction and operator-style product instincts."]
        },
        {
          title: "Projects",
          itemCount: 2,
          items: ["OfferYou", "Cross-platform AI workflow packaging"]
        },
        {
          title: "Skills",
          itemCount: 3,
          items: ["AI product definition", "Workflow design", "Prompt systems"]
        }
      ]
    }
  };
}
