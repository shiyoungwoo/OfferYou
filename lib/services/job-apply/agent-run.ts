import type { ModelProviderKey } from "@/lib/ai/model-provider-config";
import type { ModelTaskKey } from "@/lib/ai/model-task-config";
import type { ResumeDocument } from "@/lib/document/resume-document";
import type { CalibratedResumeProfile } from "@/lib/services/calibration/resume-calibration-types";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";

export type GenerationMode = "model" | "model_repaired" | "deterministic_fallback";

export type JobApplyRunStage =
  | "input_received"
  | "resume_calibrated"
  | "jd_analyzed"
  | "strategy_planned"
  | "suggestions_ready"
  | "user_reviewing"
  | "snapshot_ready"
  | "interview_ready"
  | "export_ready"
  | "failed_needs_human";

export type ModelProviderTrace = {
  provider: ModelProviderKey;
  model?: string;
  task?: ModelTaskKey;
  generationMode: GenerationMode;
  latencyMs: number;
  fallbackReason?: string;
};

export type AgentStepResult<T> = {
  stage: JobApplyRunStage;
  data: T | null;
  providerTrace?: ModelProviderTrace;
  confidence: "high" | "medium" | "low";
  riskNotes: string[];
  fallbackReason?: string;
  createdAt: string;
};

export type JDInsight = {
  company?: string;
  jobTitle?: string;
  hardRequirements: string[];
  coreAbilities: string[];
  bonusItems: string[];
  avoidItems: string[];
};

export type RewriteStrategy = {
  priorities: string[];
  sectionOrder: Array<"summary" | "experience" | "project" | "education">;
  lowRelevancePolicy: "compress_keep_timeline";
  distortionGuards: string[];
};

export type RewriteVerificationStatus = "pass" | "warn" | "fail";

export type RewriteVerification = {
  status: RewriteVerificationStatus;
  issues: string[];
};

export type JobApplyRun = {
  id: string;
  draftId: string;
  company?: string;
  jobTitle?: string;
  stage: JobApplyRunStage;
  steps: Array<AgentStepResult<unknown>>;
  calibratedResume?: CalibratedResumeProfile;
  jdInsight?: JDInsight;
  rewriteStrategy?: RewriteStrategy;
  suggestions?: PersistedWorkspaceDraft["suggestions"];
  finalResumeDraft?: ResumeDocument;
  createdAt: string;
  updatedAt: string;
};

export function createAgentStepResult<T>(
  input: Omit<AgentStepResult<T>, "createdAt">
): AgentStepResult<T> {
  return {
    ...input,
    createdAt: new Date().toISOString()
  };
}
