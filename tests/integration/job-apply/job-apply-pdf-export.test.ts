import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMasterFact } from "@/lib/services/master/master-service";
import { confirmCareerNavigation, confirmTalentProfile } from "@/lib/services/talent/talent-profile-service";
import { createDraft } from "@/lib/services/ingestion/create-draft";
import { generateSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import { exportResumeDocumentForDraft } from "@/lib/services/export/resume-export-service";
import { readApplicationRecord } from "@/lib/services/applications/application-record-service";
import { jobApplyCases } from "@/tests/fixtures/job-apply/cases";
import { readFile } from "node:fs/promises";

let tempDir: string;
let previousCwd: string;

describe("job-apply pdf export fixtures", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-job-apply-pdf-"));
    process.chdir(tempDir);

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
    it(`exports a PDF for ${sample.slug}`, async () => {
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
      const result = await exportResumeDocumentForDraft({ draftId: draft.id });
      const record = await readApplicationRecord(result.recordId);
      const pdfStat = await stat(result.storagePath);
      const safeTitle = sample.jobTitle.replace(/[\/\\:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
      const expectedName = resumeContent.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "OfferYou 用户";

      expect(result.storagePath.endsWith(".pdf")).toBe(true);
      expect(pdfStat.size).toBeGreaterThan(100);
      expect(record?.exportStoragePath).toBe(result.storagePath);
      expect(path.basename(result.storagePath)).toContain(expectedName);
      expect(path.basename(result.storagePath)).toContain(safeTitle);
      expect(path.basename(result.storagePath)).toContain("可投递版");
      expect(path.basename(result.storagePath)).toMatch(/\d{8}\.pdf$/u);
      // 这里不再强制读取 PDF 页数，避免重新引入 pdf-parse 的 worker 警告和不稳定依赖。
    }, 20000);
  }
});
