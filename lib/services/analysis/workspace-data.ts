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
    company: "Northstar Careers",
    jobTitle: "Customer Success Lead",
    stage: "analysis_ready",
    summary: {
      fitScore: 74,
      optimizationMode: "baseline_jd_match",
      strengths: [
        "The profile shows repeated strength in guiding people through complexity and reducing ambiguity.",
        "There is credible evidence of structured problem-solving and trust-building work that can transfer into this role."
      ],
      gaps: [
        "The current story still needs stronger evidence of measurable customer or business outcomes.",
        "Several experiences need to be reframed more clearly around role-relevant responsibility."
      ],
      riskNotes: [
        "Do not overstate readiness if the strongest evidence is still indirect or highly transferable.",
        "Keep all strength claims anchored to concrete experiences rather than broad identity labels."
      ]
    },
    talentProfileUsed: undefined,
    careerDirectionUsed: undefined,
    masterFactsUsed: [],
    suggestions: [
      {
        id: `${draftId}-s1`,
        section: "project",
        title: "Guidance and clarity evidence",
        beforeText: "Helped people move through unclear processes and turned messy information into actionable next steps.",
        afterText:
          "Guided people through ambiguity by turning scattered information into clear next steps, showing strong fit for customer-facing workflow and support roles.",
        reasonText: "This reframes the evidence around user guidance, clarity, and trusted execution.",
        status: "pending",
        revisionRound: 0,
        sourceKind: "resume_baseline",
        sourceLabel: "Resume baseline"
      },
      {
        id: `${draftId}-s2`,
        section: "experience",
        title: "Cross-functional delivery evidence",
        beforeText: "Coordinated multiple moving parts and kept work progressing across ambiguous requirements.",
        afterText:
          "Worked across shifting requirements to keep delivery moving, showing transferable strength in coordination, follow-through, and customer-facing execution.",
        reasonText: "This sharpens transferable strengths instead of forcing the profile into a narrow function-specific frame.",
        status: "pending",
        revisionRound: 0,
        sourceKind: "target_role_fit",
        sourceLabel: "Role-fit framing"
      }
    ],
    factSubmissionCount: 0,
    snapshot: {
      pageEstimate: 2,
      sections: [
        {
          title: "Summary",
          itemCount: 1,
          items: ["Candidate with strong guidance, structure, and ambiguity-handling strengths."]
        },
        {
          title: "Projects",
          itemCount: 2,
          items: ["Guidance and workflow support", "Cross-functional execution evidence"]
        },
        {
          title: "Skills",
          itemCount: 3,
          items: ["Customer guidance", "Workflow clarity", "Structured execution"]
        }
      ]
    }
  };
}
