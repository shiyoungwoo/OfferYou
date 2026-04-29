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
      "self_intro",
      "resume_calibration"
    ]);
    expect(
      configs
        .filter((config) => config.task !== "resume_calibration")
        .every((config) => config.defaultProvider === "gemini")
    ).toBe(true);
    expect(configs.find((config) => config.task === "resume_calibration")?.defaultProvider).toBe("openai_compatible");
  });

  it("returns a default provider for each task", () => {
    expect(getModelTaskConfig("gap_analysis").defaultProvider).toBe("gemini");
    expect(getModelTaskConfig("interview").defaultProvider).toBe("gemini");
    expect(getDefaultModelProviderForTask("self_intro")).toBe("gemini");
    expect(getDefaultModelProviderForTask("resume_calibration")).toBe("openai_compatible");
  });
});
