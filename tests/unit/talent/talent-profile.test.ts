import { describe, expect, it } from "vitest";
import { buildTalentProfile } from "@/lib/services/talent/talent-profile";

describe("buildTalentProfile", () => {
  it("derives strength signals and role directions from lived-experience answers", () => {
    const profile = buildTalentProfile({
      proudMoment:
        "I led a messy client onboarding, clarified the workflow, and organized the team around a plan the customer trusted.",
      trustedProblem:
        "People rely on me when cross-team work is confusing because I can listen, coordinate, and turn ambiguity into clear next steps.",
      energyPattern:
        "I gain energy from solving complex problems with people and owning the path forward."
    });

    expect(profile.signals.map((signal) => signal.key)).toEqual(
      expect.arrayContaining(["clarity_builder", "relationship_driver", "cross_functional_translator", "ownership_runner"])
    );
    expect(profile.suitableDirections).toEqual(
      expect.arrayContaining(["客户成功、客户关系与服务推进类方向", "运营、项目推进与交付类方向"])
    );
    expect(profile.confidenceNote).toMatch(/中等/);
  });

  it("stays cautious when the evidence base is thin", () => {
    const profile = buildTalentProfile({
      proudMoment: "I did okay.",
      trustedProblem: "People ask me for help.",
      energyPattern: "Quiet work."
    });

    expect(profile.signals).toHaveLength(0);
    expect(profile.cautionNotes.join(" ")).toMatch(/证据还不够多/);
    expect(profile.confidenceNote).toMatch(/早期/);
  });
});
