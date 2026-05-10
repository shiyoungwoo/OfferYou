import type { ResumeDocument } from "@/lib/document/resume-document";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import {
  createAgentStepResult,
  type JobApplyNextAction,
  type JobApplyRun,
  type JobApplyRunMode,
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

  const stage = resolveRunStage(draft, finalResumeDraft);
  const nextAction = resolveNextAction(draft, finalResumeDraft, stage);

  const now = new Date().toISOString();
  return {
    id: `job-apply-run-${draft.id}`,
    draftId: draft.id,
    company: draft.company,
    jobTitle: draft.jobTitle,
    runMode: resolveRunMode(draft),
    stage,
    steps,
    calibratedResume: draft.calibratedResume,
    jdInsight: draft.jdInsight,
    rewriteStrategy: draft.rewriteStrategy,
    suggestions: draft.suggestions,
    finalResumeDraft: finalResumeDraft ?? undefined,
    nextAction: nextAction.action,
    blockingReason: nextAction.blockingReason,
    needsHumanConfirmation: nextAction.needsHumanConfirmation,
    createdAt: now,
    updatedAt: now
  };
}

function resolveRunMode(draft: PersistedWorkspaceDraft): JobApplyRunMode {
  if (hasTalentContext(draft)) {
    return "talent_driven_agent";
  }

  if (hasModelBackedSignals(draft)) {
    return "job_tailoring";
  }

  return "manual_editor";
}

function hasTalentContext(draft: PersistedWorkspaceDraft) {
  return Boolean(
    draft.talentProfileUsed ||
      draft.careerDirectionUsed ||
      draft.analysis?.optimizationMode === "talent_amplified"
  );
}

function hasModelBackedSignals(draft: PersistedWorkspaceDraft) {
  if (draft.jdInsight?.generationMode === "model" || draft.jdInsight?.generationMode === "model_repaired") {
    return true;
  }

  return draft.suggestions.some(
    (suggestion) => suggestion.generationMode === "model" || suggestion.generationMode === "model_repaired"
  );
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

function resolveNextAction(
  draft: PersistedWorkspaceDraft,
  finalResumeDraft: ResumeDocument | null | undefined,
  stage: JobApplyRunStage
): { action: JobApplyNextAction; blockingReason?: string; needsHumanConfirmation?: boolean } {
  const hasFailSuggestions = draft.suggestions.some((s) => s.verification?.status === "fail");
  const hasPendingSuggestions = draft.suggestions.some((s) => s.status === "pending");
  const hasAcceptedSuggestions = draft.suggestions.some((s) => s.status === "accepted");
  const allDeterministic = draft.suggestions.length > 0 && draft.suggestions.every((s) => s.generationMode === "deterministic_fallback");

  if (stage === "input_received" || stage === "resume_calibrated") {
    return { action: "confirm_resume_calibration", needsHumanConfirmation: true };
  }

  if (hasPendingSuggestions && allDeterministic) {
    return {
      action: "check_model_config",
      blockingReason: "当前所有建议均来自规则兜底，不是 AI 改写；建议检查模型配置后再继续。",
      needsHumanConfirmation: true
    };
  }

  if (hasPendingSuggestions) {
    return {
      action: "review_suggestions",
      blockingReason: hasFailSuggestions ? "存在未通过事实校验的建议，需要人工确认。" : undefined,
      needsHumanConfirmation: true
    };
  }

  if (hasAcceptedSuggestions && !finalResumeDraft) {
    return { action: "sync_snapshot" };
  }

  if (stage === "snapshot_ready" && !finalResumeDraft) {
    return { action: "export_pdf" };
  }

  if (stage === "snapshot_ready" && finalResumeDraft) {
    return { action: "prepare_interview" };
  }

  if (stage === "interview_ready" || stage === "export_ready") {
    return { action: "done" };
  }

  if (stage === "failed_needs_human") {
    return { action: "check_model_config", blockingReason: "流程中断，需要人工介入。", needsHumanConfirmation: true };
  }

  return { action: "review_suggestions", needsHumanConfirmation: true };
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
