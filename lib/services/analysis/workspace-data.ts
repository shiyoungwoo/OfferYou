import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { cleanGeneratedResumeText, normalizeOcrResumeText } from "@/lib/services/analysis/text-cleaner";
import { rewriteFactForJd } from "@/lib/services/analysis/suggestion-generator";
import type { CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";

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
  candidateId?: string;
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
  calibratedResume?: CalibratedResumeProfile;
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
      calibratedResume: persisted.calibratedResume,
      masterFactsUsed: persisted.masterFactsUsed ?? [],
      suggestions: persisted.suggestions.map(s => {
        const cleanedBefore = normalizeOcrResumeText(s.beforeText);
        
        // Detect stale generic fallback text and repair it on the fly
        if (s.afterText.includes("相关性较弱") && s.afterText.includes("仅保留时间及岗位")) {
          // Trigger a lightweight re-generation for this specific item
          const jdContext = persisted.jdPreview || (persisted.analysis.gaps.join(" ") + " " + persisted.jobTitle);
          const { after, reason } = rewriteFactForJd(cleanedBefore, jdContext);
          return {
            ...s,
            beforeText: cleanedBefore,
            afterText: after,
            reasonText: reason
          };
        }

        return {
          ...s,
          beforeText: cleanedBefore,
          afterText: cleanGeneratedResumeText(s.afterText)
        };
      }),
      factSubmissionCount: persisted.factSubmissions?.length ?? 0,
      snapshot: {
        pageEstimate: 1,
        sections: [
          {
            title: "个人优势",
            itemCount: persisted.suggestions.filter(s => s.section === "summary" && s.status === "accepted").length || 1,
            items: persisted.suggestions.filter(s => s.section === "summary" && s.status === "accepted").map(s => s.title).slice(0, 3)
          },
          {
            title: "核心工作经历",
            itemCount: persisted.suggestions.filter(s => s.section === "experience" && s.status === "accepted").length,
            items: persisted.suggestions.filter(s => s.section === "experience" && s.status === "accepted").map(s => s.title).slice(0, 3)
          },
          {
            title: "重点项目",
            itemCount: persisted.suggestions.filter(s => s.section === "project" && s.status === "accepted").length,
            items: persisted.suggestions.filter(s => s.section === "project" && s.status === "accepted").map(s => s.title).slice(0, 3)
          }
        ]
      }
    };
  }

  // Fallback for missing draft
  return {
    company: "未知岗位",
    jobTitle: "未知职位",
    stage: "analysis_ready",
    summary: { fitScore: 0, optimizationMode: "baseline_jd_match", strengths: [], gaps: [], riskNotes: [] },
    masterFactsUsed: [],
    suggestions: [],
    snapshot: { pageEstimate: 1, sections: [] }
  };
}
