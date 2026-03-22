import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDraft } from "@/lib/services/ingestion/create-draft";
import { createMasterFact } from "@/lib/services/master/master-service";
import { confirmCareerNavigation, confirmTalentProfile } from "@/lib/services/talent/talent-profile-service";
import { createDraftInputSchema } from "@/lib/validation/drafts";

let tempDir: string;
let previousCwd: string;

describe("createDraftInputSchema", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-create-draft-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires company, jobTitle, and jd content", () => {
    const result = createDraftInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("reuses confirmed master facts in new draft analysis seeds", async () => {
    await createMasterFact({
      userId: "default-user",
      title: "Workflow instrumentation rollout",
      summary: "Led the post-launch instrumentation rollout for workflow analytics.",
      blockType: "project",
      integrityNoticeConfirmedAt: new Date().toISOString()
    });

    const draft = await createDraft({
      company: "OfferYou",
      jobTitle: "AI Product Manager",
      language: "en",
      masterResumeId: "default-master",
      jdContent: "Need AI product workflow design and user impact.",
      resumeAssetRef: "manual://resume"
    });

    expect(draft.analysis.fitScore).toBeGreaterThan(0);
    expect(draft.suggestions.some((suggestion) => suggestion.title === "Workflow instrumentation rollout")).toBe(true);
    expect(draft.suggestions.some((suggestion) => suggestion.sourceKind === "master_fact")).toBe(true);
  });

  it("injects confirmed talent profile and selected career direction into the draft context", async () => {
    const talentProfile = await confirmTalentProfile({
      userId: "default-user",
      answers: {
        proudMoment: "I turned a messy customer onboarding into a clear plan and restored trust.",
        trustedProblem: "People rely on me to organize ambiguous work because I can listen and coordinate teams.",
        energyPattern: "I gain energy from solving complex problems with people and owning the path forward."
      }
    });

    const navigation = await confirmCareerNavigation({
      userId: "default-user",
      talentProfileId: talentProfile.id
    });
    const lane = navigation.navigation.directions[0]?.slug;

    const draft = await createDraft({
      company: "OfferYou",
      jobTitle: "Customer Success Lead",
      language: "en",
      masterResumeId: "default-master",
      careerDirectionSlug: lane,
      jdContent: "Need customer guidance, coordination, and workflow clarity.",
      resumeAssetRef: "manual://resume"
    });

    expect(draft.talentProfileUsed?.id).toBe(talentProfile.id);
    expect(draft.careerDirectionUsed?.id).toBe(navigation.id);
    expect(draft.careerDirectionUsed?.slug).toBe(lane);
    expect(draft.analysis.optimizationMode).toBe("talent_amplified");
  });
});
