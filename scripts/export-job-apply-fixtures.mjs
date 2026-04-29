import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "docs", "quality", "job-apply-fixture-outputs.md");
const artifactRoot = path.join(repoRoot, "docs", "quality", "job-apply-fixture-artifacts");
const fixtureRoot = path.join(repoRoot, "tests", "fixtures", "job-apply");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-job-apply-fixtures-"));
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

const samples = [
  {
    slug: "aipm",
    company: "星桥智能",
    jobTitle: "AI 产品经理",
    resumePath: path.join(fixtureRoot, "aipm", "resume.md"),
    jdPath: path.join(fixtureRoot, "aipm", "jd.md"),
    withTalentContext: true
  },
  {
    slug: "product-ops",
    company: "云海数据",
    jobTitle: "产品运营 / 业务分析",
    resumePath: path.join(fixtureRoot, "product-ops", "resume.md"),
    jdPath: path.join(fixtureRoot, "product-ops", "jd.md"),
    withTalentContext: false
  },
  {
    slug: "ai-content",
    company: "灵犀内容",
    jobTitle: "AI 内容应用专员",
    resumePath: path.join(fixtureRoot, "ai-content", "resume.md"),
    jdPath: path.join(fixtureRoot, "ai-content", "jd.md"),
    withTalentContext: false
  }
];

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
    "# Job Apply Fixture Outputs",
    "",
    `生成时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
    `临时工作目录：${tempDir}`,
    `稳定产物目录：${path.relative(repoRoot, artifactRoot)}`,
    ""
  ];

  for (const sample of samples) {
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

    reportLines.push(`## ${sample.company} / ${sample.jobTitle}`);
    reportLines.push("");
    reportLines.push(`- Draft ID：${draft.id}`);
    reportLines.push(`- Snapshot 模板：${snapshot.templateKey}`);
    reportLines.push(`- PDF 路径：${stablePdfPath}`);
    reportLines.push(`- Record ID：${exportResult.recordId}`);
    reportLines.push(`- 风险提示：${summarizeRiskNotes(draft.analysis.riskNotes)}`);
    reportLines.push("");
  }

  await writeFile(outputPath, `${reportLines.join("\n").trim()}\n`, "utf-8");
  console.log(`已生成样本导出报告：${path.relative(repoRoot, outputPath)}`);
} catch (error) {
  console.error("样本导出失败：", error);
  process.exitCode = 1;
} finally {
  process.chdir(previousCwd);
  await rm(tempDir, { recursive: true, force: true });
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

  return summary.length > 120 ? `${summary.slice(0, 120)}…` : summary;
}
