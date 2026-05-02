import type { ResumeDocument } from "@/lib/document/resume-document";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import {
  createAgentStepResult,
  type JobApplyRun,
  type JobApplyRunStage
} from "@/lib/services/job-apply/agent-run";

export function buildJobApplyRunFromDraft(
  draft: PersistedWorkspaceDraft,
  finalResumeDraft?: ResumeDocument | null
): JobApplyRun {
  const steps: JobApplyRun["steps"] = [
    createAgentStepResult({
      stage: "input_received",
      data: {
        company: draft.company,
        jobTitle: draft.jobTitle,
        jdPreview: draft.jdPreview
      },
      confidence: "high",
      riskNotes: []
    })
  ];

  if (draft.calibratedResume) {
    steps.push(createAgentStepResult({
      stage: "resume_calibrated",
      data: draft.calibratedResume,
      confidence: draft.calibratedResume.status === "confirmed" ? "high" : "medium",
      riskNotes: draft.calibratedResume.parseWarnings ?? []
    }));
  }

  if (draft.analysis) {
    steps.push(createAgentStepResult({
      stage: "jd_analyzed",
      data: draft.analysis,
      confidence: draft.analysis.riskNotes.length > 0 ? "medium" : "high",
      riskNotes: draft.analysis.riskNotes
    }));
  }

  if (draft.jdInsight || draft.rewriteStrategy) {
    steps.push(createAgentStepResult({
      stage: "strategy_planned",
      data: {
        jdInsight: draft.jdInsight,
        rewriteStrategy: draft.rewriteStrategy
      },
      confidence: draft.jdInsight?.coreAbilities.length ? "high" : "medium",
      riskNotes: []
    }));
  }

  if (draft.suggestions.length > 0) {
    steps.push(createAgentStepResult({
      stage: "suggestions_ready",
      data: draft.suggestions,
      confidence: draft.suggestions.some((suggestion) => suggestion.generationMode === "model" || suggestion.generationMode === "model_repaired")
        ? "high"
        : "medium",
      riskNotes: collectSuggestionRisks(draft)
    }));
  }

  const pendingCount = draft.suggestions.filter((suggestion) => suggestion.status === "pending").length;
  if (pendingCount > 0) {
    steps.push(createAgentStepResult({
      stage: "user_reviewing",
      data: {
        pendingCount
      },
      confidence: "high",
      riskNotes: []
    }));
  }

  if (finalResumeDraft || draft.suggestions.some((suggestion) => suggestion.status === "accepted")) {
    steps.push(createAgentStepResult({
      stage: "snapshot_ready",
      data: finalResumeDraft ?? null,
      confidence: finalResumeDraft ? "high" : "medium",
      riskNotes: finalResumeDraft ? [] : ["已有确认建议，但尚未生成最终简历草稿。"]
    }));
  }

  const now = new Date().toISOString();
  return {
    id: `job-apply-run-${draft.id}`,
    draftId: draft.id,
    company: draft.company,
    jobTitle: draft.jobTitle,
    stage: resolveRunStage(draft, finalResumeDraft),
    steps,
    calibratedResume: draft.calibratedResume,
    jdInsight: draft.jdInsight,
    rewriteStrategy: draft.rewriteStrategy,
    suggestions: draft.suggestions,
    finalResumeDraft: finalResumeDraft ?? undefined,
    createdAt: now,
    updatedAt: now
  };
}

function resolveRunStage(
  draft: PersistedWorkspaceDraft,
  finalResumeDraft?: ResumeDocument | null
): JobApplyRunStage {
  if (finalResumeDraft || draft.suggestions.some((suggestion) => suggestion.status === "accepted")) {
    return "snapshot_ready";
  }

  if (draft.suggestions.some((suggestion) => suggestion.status === "pending")) {
    return "user_reviewing";
  }

  if (draft.suggestions.length > 0) {
    return "suggestions_ready";
  }

  if (draft.jdInsight || draft.rewriteStrategy) {
    return "strategy_planned";
  }

  if (draft.analysis) {
    return "jd_analyzed";
  }

  if (draft.calibratedResume) {
    return "resume_calibrated";
  }

  return "input_received";
}

function collectSuggestionRisks(draft: PersistedWorkspaceDraft) {
  const risks: string[] = [];

  for (const suggestion of draft.suggestions) {
    if (suggestion.modelFallbackReason) {
      risks.push(suggestion.modelFallbackReason);
    }

    if (suggestion.verification?.issues.length) {
      risks.push(...suggestion.verification.issues);
    }
  }

  return [...new Set(risks)];
}
