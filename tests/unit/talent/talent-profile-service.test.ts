import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildCareerNavigation } from "@/lib/services/talent/career-navigation";
import {
  confirmCareerNavigation,
  confirmTalentProfile,
  getLatestConfirmedCareerNavigationForTalentProfile,
  getLatestConfirmedTalentProfile
} from "@/lib/services/talent/talent-profile-service";

let tempDir: string;
let previousCwd: string;

describe("talent-profile-service", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-talent-service-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves and retrieves the latest confirmed talent profile", async () => {
    const record = await confirmTalentProfile({
      userId: "default-user",
      answers: {
        proudMoment: "I led a messy workflow recovery and restored customer confidence through clearer structure.",
        trustedProblem:
          "People rely on me to clarify ambiguous work because I can organize the moving parts and explain the next step.",
        energyPattern: "I gain energy from solving complex problems with people and taking ownership of the path forward."
      }
    });

    const latest = await getLatestConfirmedTalentProfile("default-user");

    expect(latest?.id).toBe(record.id);
    expect(latest?.profile.headline).toContain("你最容易发光的状态");
  });

  it("builds and confirms career navigation against a confirmed talent profile", async () => {
    const talent = await confirmTalentProfile({
      userId: "default-user",
      answers: {
        proudMoment: "I clarified a client process and helped two teams align on the plan.",
        trustedProblem:
          "People rely on me when work is confusing because I can coordinate teams and build trust fast.",
        energyPattern: "I gain energy from solving ambiguous problems with people and owning delivery."
      }
    });

    const preview = buildCareerNavigation(talent.profile);
    const record = await confirmCareerNavigation({
      userId: "default-user",
      talentProfileId: talent.id
    });
    const latest = await getLatestConfirmedCareerNavigationForTalentProfile("default-user", talent.id);

    expect(preview.directions.length).toBeGreaterThan(0);
    expect(record.navigation.directions[0]?.slug).toBeTruthy();
    expect(latest?.id).toBe(record.id);
  });
});
