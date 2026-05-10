import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON: vi.fn(async (options: { task?: string; userPrompt?: string }) => {
    if (options.task === "resume_calibration") {
      return {
        provider: "deterministic_fallback",
        generationMode: "deterministic_fallback",
        data: null,
        fallbackReason: "测试中不调用结构校准模型。"
      };
    }

    if (options.task === "jd_analysis") {
      return {
        provider: "openai_compatible",
        generationMode: "model",
        data: {
          company: "测试公司",
          jobTitle: "AI 产品经理",
          hardRequirements: ["AI 产品经理", "产品运营", "数据分析", "AI 内容"],
          coreAbilities: ["工作流", "跨团队", "复盘", "流程", "模板"],
          bonusItems: ["AI 产品实践"],
          avoidItems: ["必须基于真实事实"],
          sourceKeywords: ["AI 产品经理", "产品运营", "数据分析", "AI 内容", "工作流", "跨团队", "复盘", "流程", "模板"]
        }
      };
    }

    if (options.userPrompt?.includes('"suggestions"')) {
      return {
        provider: "openai_compatible",
        generationMode: "model",
        data: {
          suggestions: [
            {
              section: "project",
              title: "岗位定制改写",
              before: "原始经历",
              after: "AI 产品经理 / 产品运营 / AI 内容方向：围绕工作流、跨团队协作、数据分析、复盘、流程沉淀和模板化输出完成岗位定制表达。",
              reason: "对应 JD 中 AI 产品经理、产品运营、数据分析、AI 内容、工作流、跨团队、复盘、流程和模板要求，且必须基于真实事实。",
              jdAbility: "工作流",
              factAnchors: ["原始经历"]
            }
          ]
        }
      };
    }

    return {
      provider: "openai_compatible",
      generationMode: "model",
      data: {
        fitScore: 82,
        strengths: ["具备 AI 产品经理、产品运营、数据分析、AI 内容、工作流和跨团队相关信号。"],
        gaps: ["仍需补充可量化结果和真实事实证据。"],
        keywordsToBridge: ["AI 产品经理", "产品运营", "数据分析", "AI 内容", "工作流", "跨团队", "复盘", "流程", "模板"],
        riskNotes: ["每条改写仍需真实事实支撑。"]
      }
    };
  })
}));
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
      expect(draft.analysis.riskNotes.join(" ")).not.toContain("模型降级原因");
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
