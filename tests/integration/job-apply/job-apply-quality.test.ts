import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMasterFact } from "@/lib/services/master/master-service";
import { createDraft } from "@/lib/services/ingestion/create-draft";
import { generateSnapshotForDraft, readSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import { listMasterFacts } from "@/lib/services/master/master-service";
import { confirmCareerNavigation, confirmTalentProfile } from "@/lib/services/talent/talent-profile-service";
import { jobApplyCases } from "@/tests/fixtures/job-apply/cases";
import { scoreSuggestionQuality } from "@/lib/services/quality/suggestion-quality";

let tempDir: string;
let previousCwd: string;

describe("job-apply quality fixtures", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-job-apply-quality-"));
    process.chdir(tempDir);
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;

    await createMasterFact({
      userId: "default-user",
      title: "Workflow instrumentation rollout",
      summary: "Led the post-launch instrumentation rollout for workflow analytics.",
      blockType: "project",
      integrityNoticeConfirmedAt: new Date().toISOString()
    });
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  for (const sample of jobApplyCases) {
    it(`builds a draft, suggestions, and a snapshot for ${sample.slug}`, async () => {
      const resumeContent = await readFile(sample.resumePath, "utf-8");
      const jdContent = await readFile(sample.jdPath, "utf-8");
      const masterFactsBefore = await listMasterFacts("default-user");

      let careerDirectionSlug: string | undefined;
      if (sample.withTalentContext) {
        const talentProfile = await confirmTalentProfile({
          userId: "default-user",
          answers: {
            proudMoment: "我把一条混乱的信息流整理成清晰流程，并让团队顺利执行。",
            trustedProblem: "别人常把模糊任务交给我，因为我能先拆解再推进。",
            energyPattern: "我在需要协调、梳理和把复杂事变简单的场景里最有能量。"
          }
        });
        const navigation = await confirmCareerNavigation({
          userId: "default-user",
          talentProfileId: talentProfile.id
        });
        careerDirectionSlug = navigation.navigation.directions[0]?.slug;
        expect(careerDirectionSlug).toBeTruthy();
      }

      const draft = await createDraft({
        company: sample.company,
        jobTitle: sample.jobTitle,
        language: "zh",
        masterResumeId: `master-${sample.slug}`,
        careerDirectionSlug,
        jdContent,
        resumeContent,
        resumeAssetRef: `manual://${sample.slug}/resume`
      });

      expect(draft.company).toBe(sample.company);
      expect(draft.jobTitle).toBe(sample.jobTitle);
      expect(draft.suggestions.length).toBeGreaterThan(0);
      const qualityScores = draft.suggestions.map((suggestion) =>
        scoreSuggestionQuality({
          beforeText: suggestion.beforeText,
          afterText: suggestion.afterText,
          reasonText: suggestion.reasonText,
          keywords: sample.expectedKeywords
        })
      );
      expect(qualityScores.some((score) => score.passed)).toBe(true);
      expect(draft.analysis.riskNotes.length).toBeGreaterThan(0);
      expect(draft.analysis.riskNotes.join(" ")).toContain("模型降级原因");
      expect(draft.suggestions.some((suggestion) => sample.expectedKeywords.some((keyword) => JSON.stringify(suggestion).includes(keyword)))).toBe(true);

      await generateSnapshotForDraft(draft.id);
      const snapshot = await readSnapshotForDraft(draft.id);

      expect(snapshot).not.toBeNull();
      expect(snapshot?.sections.length).toBeGreaterThanOrEqual(2);
      expect(snapshot?.templateKey).toBe("professional-cn");
      expect(snapshot?.sections.filter((section) => ["个人优势", "工作经历", "项目经历"].includes(section.title)).length).toBeGreaterThanOrEqual(2);
      expect(sample.expectedKeywords.some((keyword) => JSON.stringify(snapshot).includes(keyword))).toBe(true);
      expect(sample.expectedRiskKeywords.some((keyword) => draft.analysis.riskNotes.join(" ").includes(keyword))).toBe(true);

      const masterFactsAfter = await listMasterFacts("default-user");
      expect(masterFactsAfter).toHaveLength(masterFactsBefore.length);
      expect(masterFactsAfter.map((fact) => fact.id)).toEqual(masterFactsBefore.map((fact) => fact.id));
    });
  }
});
