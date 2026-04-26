import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

import { jobApplyCases } from "../tests/fixtures/job-apply/cases.ts";
import { scoreSuggestionQuality } from "../lib/services/quality/suggestion-quality.ts";

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "docs", "quality", "offeryou-beta-report.md");
const artifactRoot = path.join(repoRoot, "docs", "quality", "job-apply-fixture-artifacts");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-self-use-beta-"));
const previousCwd = process.cwd();

process.chdir(tempDir);

const require = createRequire(import.meta.url);
const Module = require("module");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const resolved = resolveRepositoryAlias(request.slice(2));
    if (resolved) {
      return originalResolveFilename.call(this, resolved, parent, isMain, options);
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { createMasterFact } = require("../lib/services/master/master-service.ts");
const { createDraft } = require("../lib/services/ingestion/create-draft.ts");
const { exportResumeDocumentForDraft } = require("../lib/services/export/resume-export-service.ts");
const { generateSnapshotForDraft, readSnapshotForDraft } = require("../lib/services/snapshot/snapshot-service.ts");
const {
  confirmCareerNavigation,
  confirmTalentProfile
} = require("../lib/services/talent/talent-profile-service.ts");
const { createInterviewPrepFromRecord, readInterviewPrepForRecord } = require("../lib/services/interview/interview-prep-service.ts");

try {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(artifactRoot, { recursive: true });

  await createMasterFact({
    userId: "default-user",
    title: "Workflow instrumentation rollout",
    summary: "Led the post-launch instrumentation rollout for workflow analytics.",
    blockType: "project",
    integrityNoticeConfirmedAt: new Date().toISOString()
  });

  const reportLines = [
    "# OfferYou 自用 Beta 报告",
    "",
    `生成时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
    `样本总数：${jobApplyCases.length}`,
    ""
  ];

  let passingSampleCount = 0;

  for (const sample of jobApplyCases) {
    const summary = await buildSampleSummary(sample);
    if (summary.qualityPassed) {
      passingSampleCount += 1;
    }

    reportLines.push(`## ${sample.company} / ${sample.jobTitle}`);
    reportLines.push("");
    reportLines.push(`- Draft ID：${summary.draftId}`);
    reportLines.push(`- 建议数量：${summary.suggestionCount}`);
    reportLines.push(`- 质量通过：${summary.qualityPassed ? "是" : "否"}（${summary.passedSuggestionCount}/${summary.suggestionCount}）`);
    reportLines.push(`- PDF 路径：${summary.pdfPath}`);
    reportLines.push(`- Interview Prep：${summary.interviewPrepGenerated ? "已生成" : "未生成"}（${summary.interviewPrepQuestionCount} 题）`);
    reportLines.push(`- 主要风险提示：${summary.riskNotes}`);
    reportLines.push("");
  }

  reportLines.unshift(`质量通过样本：${passingSampleCount} / ${jobApplyCases.length}`, "");

  await writeFile(outputPath, `${reportLines.join("\n").trim()}\n`, "utf-8");
  console.log(`已生成自用 Beta 报告：${path.relative(repoRoot, outputPath)}`);
} catch (error) {
  console.error("自用 Beta 报告生成失败：", error);
  process.exitCode = 1;
} finally {
  process.chdir(previousCwd);
  await rm(tempDir, { recursive: true, force: true });
}

async function buildSampleSummary(sample) {
  const resumeContent = await readFile(sample.resumePath, "utf-8");
  const jdContent = await readFile(sample.jdPath, "utf-8");

  let careerDirectionSlug;
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

  const qualityScores = draft.suggestions.map((suggestion) =>
    scoreSuggestionQuality({
      beforeText: suggestion.beforeText,
      afterText: suggestion.afterText,
      reasonText: suggestion.reasonText,
      keywords: sample.expectedKeywords
    })
  );
  const passedSuggestionCount = qualityScores.filter((score) => score.passed).length;
  const qualityPassed = passedSuggestionCount > 0;

  await generateSnapshotForDraft(draft.id);
  const snapshot = await readSnapshotForDraft(draft.id);

  if (!snapshot) {
    throw new Error(`未能生成快照：${sample.slug}`);
  }

  const exportResult = await exportResumeDocumentForDraft({
    draftId: draft.id,
    document: snapshot
  });
  const stableArtifactDir = path.join(artifactRoot, sample.slug);
  const stablePdfPath = path.join(stableArtifactDir, path.basename(exportResult.storagePath));
  await mkdir(stableArtifactDir, { recursive: true });
  await copyFile(exportResult.storagePath, stablePdfPath);

  const prep = await createInterviewPrepFromRecord(exportResult.recordId);
  const reloadedPrep = await readInterviewPrepForRecord(exportResult.recordId);

  return {
    draftId: draft.id,
    suggestionCount: draft.suggestions.length,
    passedSuggestionCount,
    qualityPassed,
    pdfPath: stablePdfPath,
    interviewPrepGenerated: Boolean(reloadedPrep),
    interviewPrepQuestionCount: prep.questions.length,
    riskNotes: summarizeRiskNotes(draft.analysis.riskNotes)
  };
}

function resolveRepositoryAlias(relativePath) {
  const candidates = [
    relativePath,
    `${relativePath}.ts`,
    `${relativePath}.tsx`,
    `${relativePath}.js`,
    `${relativePath}.mjs`,
    `${relativePath}.cjs`,
    path.join(relativePath, "index.ts"),
    path.join(relativePath, "index.tsx"),
    path.join(relativePath, "index.js")
  ];

  for (const candidate of candidates) {
    const absolutePath = path.join(repoRoot, candidate);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

function summarizeRiskNotes(riskNotes) {
  const summary = riskNotes.slice(0, 2).join("；").trim();
  if (!summary) {
    return "无";
  }

  return summary.length > 160 ? `${summary.slice(0, 160)}…` : summary;
}
