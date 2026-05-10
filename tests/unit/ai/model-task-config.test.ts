import { describe, expect, it } from "vitest";
import {
  getDefaultModelProviderForTask,
  getModelTaskConfig,
  listModelTaskConfigs
} from "@/lib/ai/model-task-config";

describe("model-task-config", () => {
  it("lists all task configs with OpenAI-compatible text defaults", () => {
    const configs = listModelTaskConfigs();

    expect(configs.map((config) => config.task)).toEqual([
      "gap_analysis",
      "jd_analysis",
      "rewrite",
      "talent",
      "interview",
      "self_intro",
      "resume_calibration"
    ]);
    expect(
      configs
        .filter((config) => config.task !== "resume_calibration")
        .every((config) => config.defaultProvider === "openai_compatible")
    ).toBe(true);
    expect(configs.find((config) => config.task === "resume_calibration")?.defaultProvider).toBe("openai_compatible");
  });

  it("returns a default provider for each task", () => {
    expect(getModelTaskConfig("gap_analysis").defaultProvider).toBe("openai_compatible");
    expect(getModelTaskConfig("interview").defaultProvider).toBe("openai_compatible");
    expect(getDefaultModelProviderForTask("self_intro")).toBe("openai_compatible");
    expect(getDefaultModelProviderForTask("resume_calibration")).toBe("openai_compatible");
  });
});
