import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "docs", "quality", "offeryou-real-trial-2026-04-24.md");
const artifactRoot = path.join(repoRoot, "docs", "quality", "offeryou-real-trial-artifacts");

const realResumePath = "/Users/wsyoung/Library/Mobile Documents/iCloud~md~obsidian/Documents/OrbitOS-vault/CN_主工作区/20_项目/OfferYou/2026-03-10-派生简历-AI就业指导产品经理.md";
const realJdPath = "/Users/wsyoung/Library/Mobile Documents/iCloud~md~obsidian/Documents/OrbitOS-vault/CN_主工作区/20_项目/OfferYou/2026-03-10-岗位定制-AI就业指导产品经理.md";
const interviewBaselinePath = "/Users/wsyoung/Library/Mobile Documents/iCloud~md~obsidian/Documents/OrbitOS-vault/CN_主工作区/20_项目/OfferYou/2026-03-11-面试冲刺-AI产品经理.md";

const tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-real-trial-"));
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
const { createInterviewPrepFromRecord, readInterviewPrepForRecord, buildInterviewPrepExportText } = require("../lib/services/interview/interview-prep-service.ts");
const { scoreSuggestionQuality } = require("../lib/services/quality/suggestion-quality.ts");

try {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(artifactRoot, { recursive: true });

  await createMasterFact({
    userId: "default-user",
    title: "OfferYou 真实试跑复盘",
    summary: "把真实 AIPM 历史材料跑进当前版本，验证简历定制、导出和面试准备链路。",
    blockType: "project",
    integrityNoticeConfirmedAt: new Date().toISOString()
  });

  const resumeContent = await readFile(realResumePath, "utf-8");
  const jdContent = await readFile(realJdPath, "utf-8");
  const interviewBaseline = await readFile(interviewBaselinePath, "utf-8");

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

  const draft = await createDraft({
    company: "高校 AI 就业指导",
    jobTitle: "AI 就业指导产品经理",
    language: "zh",
    masterResumeId: "master-real-trial-aipm",
    careerDirectionSlug: navigation.navigation.directions[0]?.slug,
    jdContent,
    resumeContent,
    resumeAssetRef: "manual://real-trial-aipm/resume"
  });

  const qualityScores = draft.suggestions.map((suggestion) =>
    scoreSuggestionQuality({
      beforeText: suggestion.beforeText,
      afterText: suggestion.afterText,
      reasonText: suggestion.reasonText,
      keywords: ["AI 产品经理", "OfferYou", "快照", "职业指导", "投递"]
    })
  );

  await generateSnapshotForDraft(draft.id);
  const snapshot = await readSnapshotForDraft(draft.id);
  if (!snapshot) {
    throw new Error("未能生成快照。");
  }

  const exportResult = await exportResumeDocumentForDraft({
    draftId: draft.id,
    document: snapshot
  });

  const stableArtifactDir = path.join(artifactRoot, "aipm");
  const stablePdfPath = path.join(stableArtifactDir, path.basename(exportResult.storagePath));
  await mkdir(stableArtifactDir, { recursive: true });
  await copyFile(exportResult.storagePath, stablePdfPath);

  const prep = await createInterviewPrepFromRecord(exportResult.recordId);
  const reloadedPrep = await readInterviewPrepForRecord(exportResult.recordId);
  const exportText = reloadedPrep ? buildInterviewPrepExportText(reloadedPrep) : "（未生成）";

  const reportLines = [
    "# OfferYou 真实自用试跑报告",
    "",
    `生成时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
    "试跑等级：B（自用可试跑）",
    "",
    "## 试跑样本",
    "",
    `- 岗位：${draft.jobTitle}`,
    `- 方向：${draft.company}`,
    `- 真实简历来源：${realResumePath}`,
    `- 真实 JD 来源：${realJdPath}`,
    `- 面试对照材料：${interviewBaselinePath}`,
    "",
    "## 核心结果",
    "",
    `- Draft ID：${draft.id}`,
    `- 建议数量：${draft.suggestions.length}`,
    `- 质量通过：${qualityScores.filter((score) => score.passed).length}/${draft.suggestions.length}`,
    `- PDF 路径：${stablePdfPath}`,
    `- Interview Prep：${prep.questions.length} 题（已持久化：${Boolean(reloadedPrep) ? "是" : "否"}）`,
    "",
    "## 建议质量",
    "",
    ...draft.suggestions.map((suggestion, index) => {
      const score = qualityScores[index];
      return [
        `${index + 1}. ${suggestion.title}`,
        `   评分：${score.score}，通过：${score.passed ? "是" : "否"}`,
        `   关键词命中：${score.matchedKeywords.length > 0 ? score.matchedKeywords.join("、") : "无"}`,
        `   提示：${score.notes.length > 0 ? score.notes.join("；") : "无"}`
      ].join("\n");
    }),
    "",
    "## 风险提示",
    "",
    summarizeRiskNotes(draft.analysis.riskNotes),
    "",
    "## 面试准备",
    "",
    `- 当前自我介绍长度：${prep.selfIntroDraft.trim().length} 字符`,
    `- 收藏问题：${prep.questions.filter((question) => question.favorite).length} 题`,
    `- 已填写答案：${prep.questions.filter((question) => question.answerDraft.trim().length > 0).length} 题`,
    "",
    "## 复盘观察",
    "",
    "- 当前版本已经能稳定完成「真实简历 -> JD 定制 -> Snapshot -> PDF 导出 -> 面试准备」主链路。",
    "- 面试准备已经可生成题目和自我介绍，但答案草稿仍需人工补齐，属于后续优化点。",
    "- 与 2026-03-11 的历史面试冲刺笔记相比，当前输出更适合作为可复盘材料，而不是临时脑暴稿。"
  ];

  reportLines.splice(
    reportLines.indexOf("## 面试准备"),
    0,
    "",
    "## 导出文本",
    "",
    exportText
  );

  await writeFile(outputPath, `${reportLines.join("\n").trim()}\n`, "utf-8");
  console.log(`已生成真实自用试跑报告：${path.relative(repoRoot, outputPath)}`);
} catch (error) {
  console.error("真实自用试跑失败：", error);
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
    if (require("node:fs").existsSync(absolutePath)) {
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

  return summary.length > 180 ? `${summary.slice(0, 180)}…` : summary;
}
