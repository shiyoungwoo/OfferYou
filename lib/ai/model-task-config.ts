import type { ModelProviderKey } from "@/lib/ai/model-provider-config";

export type ModelTaskKey = "gap_analysis" | "jd_analysis" | "rewrite" | "talent" | "interview" | "self_intro" | "resume_calibration";

export type ModelTaskConfig = {
  task: ModelTaskKey;
  label: string;
  defaultProvider: ModelProviderKey;
};

const TASK_CONFIGS: Record<ModelTaskKey, ModelTaskConfig> = {
  gap_analysis: {
    task: "gap_analysis",
    label: "Gap Analysis",
    defaultProvider: "openai_compatible"
  },
  jd_analysis: {
    task: "jd_analysis",
    label: "JD Analysis",
    defaultProvider: "openai_compatible"
  },
  rewrite: {
    task: "rewrite",
    label: "Rewrite",
    defaultProvider: "openai_compatible"
  },
  talent: {
    task: "talent",
    label: "Talent Discovery",
    defaultProvider: "openai_compatible"
  },
  interview: {
    task: "interview",
    label: "Interview Prep",
    defaultProvider: "openai_compatible"
  },
  self_intro: {
    task: "self_intro",
    label: "Self Intro",
    defaultProvider: "openai_compatible"
  },
  resume_calibration: {
    task: "resume_calibration",
    label: "Resume Calibration",
    defaultProvider: "openai_compatible"
  }
};

export function getModelTaskConfig(task: ModelTaskKey): ModelTaskConfig {
  return TASK_CONFIGS[task];
}

export function getDefaultModelProviderForTask(task?: ModelTaskKey): ModelProviderKey {
  return task ? TASK_CONFIGS[task].defaultProvider : "deterministic_fallback";
}

export function listModelTaskConfigs(): ModelTaskConfig[] {
  return Object.values(TASK_CONFIGS);
}
