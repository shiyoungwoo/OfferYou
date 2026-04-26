import type { ModelProviderKey } from "@/lib/ai/model-provider-config";

export type ModelTaskKey = "gap_analysis" | "rewrite" | "talent" | "interview" | "self_intro";

export type ModelTaskConfig = {
  task: ModelTaskKey;
  label: string;
  defaultProvider: ModelProviderKey;
};

const TASK_CONFIGS: Record<ModelTaskKey, ModelTaskConfig> = {
  gap_analysis: {
    task: "gap_analysis",
    label: "Gap Analysis",
    defaultProvider: "gemini"
  },
  rewrite: {
    task: "rewrite",
    label: "Rewrite",
    defaultProvider: "gemini"
  },
  talent: {
    task: "talent",
    label: "Talent Discovery",
    defaultProvider: "gemini"
  },
  interview: {
    task: "interview",
    label: "Interview Prep",
    defaultProvider: "gemini"
  },
  self_intro: {
    task: "self_intro",
    label: "Self Intro",
    defaultProvider: "gemini"
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
