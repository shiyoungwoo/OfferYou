import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMasterFact } from "@/lib/services/master/master-service";
import { createDraft } from "@/lib/services/ingestion/create-draft";
import { generateSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import { createApplicationRecord } from "@/lib/services/applications/application-record-service";
import {
  createInterviewPrepFromRecord,
  saveInterviewPrep
} from "@/lib/services/interview/interview-prep-service";
import { jobApplyCases } from "@/tests/fixtures/job-apply/cases";
import { confirmCareerNavigation, confirmTalentProfile } from "@/lib/services/talent/talent-profile-service";

let tempDir: string;
let previousCwd: string;

describe("job-apply interview prep fixtures", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-job-apply-interview-"));
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
    it(`builds interview prep from the exported record for ${sample.slug}`, async () => {
      const resumeContent = await readFile(sample.resumePath, "utf-8");
      const jdContent = await readFile(sample.jdPath, "utf-8");

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

      await generateSnapshotForDraft(draft.id);
      const record = await createApplicationRecord({
        draftId: draft.id,
        exportStoragePath: path.join(tempDir, `${sample.slug}.pdf`)
      });

      const prep = await createInterviewPrepFromRecord(record.id);

      expect(prep.questions.length).toBeGreaterThanOrEqual(5);
      expect(new Set(prep.questions.map((question) => question.sourceType)).size).toBeGreaterThanOrEqual(2);
      expect(prep.selfIntroDraft).toContain(sample.company);
      expect(prep.selfIntroDraft).toContain(sample.jobTitle);

      const firstQuestion = prep.questions[0];
      const savedAnswer = `${sample.company} 的${sample.jobTitle}面试回答草稿。`;
      firstQuestion.answerDraft = savedAnswer;
      firstQuestion.favorite = true;
      prep.updatedAt = new Date().toISOString();
      await saveInterviewPrep(prep);

      const reloaded = await createInterviewPrepFromRecord(record.id);
      expect(reloaded.questions[0]?.answerDraft).toContain(savedAnswer);
      expect(reloaded.questions[0]?.favorite).toBe(true);
    }, 30000);
  }
});
