import { describe, expect, it } from "vitest";
import {
  getDefaultModelProviderForTask,
  getModelTaskConfig,
  listModelTaskConfigs
} from "@/lib/ai/model-task-config";

describe("model-task-config", () => {
  it("lists all task configs with gemini defaults", () => {
    const configs = listModelTaskConfigs();

    expect(configs.map((config) => config.task)).toEqual([
      "gap_analysis",
      "rewrite",
      "talent",
      "interview",
      "self_intro"
    ]);
    expect(configs.every((config) => config.defaultProvider === "gemini")).toBe(true);
  });

  it("returns a default provider for each task", () => {
    expect(getModelTaskConfig("gap_analysis").defaultProvider).toBe("gemini");
    expect(getModelTaskConfig("interview").defaultProvider).toBe("gemini");
    expect(getDefaultModelProviderForTask("self_intro")).toBe("gemini");
  });
});
