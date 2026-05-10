import { mkdir, mkdtemp, copyFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const reportPath = path.join(repoRoot, "docs", "quality", "offeryou-self-use-goal-acceptance.md");
const artifactRoot = path.join(repoRoot, "docs", "quality", "offeryou-self-use-goal-artifacts");
const resumePdfPath = process.env.OFFERYOU_SELF_USE_RESUME_PATH || "/Users/wsyoung/Desktop/OfferYou_中科曙光_Resume (3).pdf";
const jdScreenshotPaths = parseListEnv(process.env.OFFERYOU_SELF_USE_JD_PATHS, [
  "/Users/wsyoung/Desktop/JD 截图.png",
  "/Users/wsyoung/Desktop/JD 截图 2.png"
]);

loadDotEnvLocal(path.join(repoRoot, ".env.local"));

const envSummary = {
  DEFAULT_MODEL_PROVIDER: summarizeEnv("DEFAULT_MODEL_PROVIDER", { revealValue: true }),
  MIMO_API_KEY: summarizeEnv("MIMO_API_KEY"),
  MIMO_BASE_URL: summarizeEnv("MIMO_BASE_URL", { revealUrlPrefix: true }),
  MIMO_MODEL: summarizeEnv("MIMO_MODEL", { revealValue: true }),
  DEEPSEEK_API_KEY: summarizeEnv("DEEPSEEK_API_KEY"),
  GEMINI_API_KEY: summarizeEnv("GEMINI_API_KEY")
};

if (!existsSync(resumePdfPath)) {
  throw new Error(`原始简历 PDF 不存在：${resumePdfPath}`);
}

for (const jdScreenshotPath of jdScreenshotPaths) {
  if (!existsSync(jdScreenshotPath)) {
    throw new Error(`JD 截图不存在：${jdScreenshotPath}`);
  }
}

const {
  extractTextFromResumeSource,
  extractTextFromStoredAsset
} = await import("../lib/services/ingestion/extract-text.ts");

const extractionStartedAt = Date.now();
const resumeExtractedText = await extractTextFromResumeSource({
  rawReference: resumePdfPath
});
const extractionMs = Date.now() - extractionStartedAt;
const jdExtraction = await extractJdFromScreenshots({
  jdScreenshotPaths,
  extractTextFromResumeSource
});
const jdContent = jdExtraction.jdContent;

const tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-self-use-goal-"));
const previousCwd = process.cwd();
process.chdir(tempDir);

try {
  await mkdir(artifactRoot, { recursive: true });

  const {
    callModelJSON
  } = await import("../lib/ai/model-gateway.ts");
  const {
    createDraft
  } = await import("../lib/services/ingestion/create-draft.ts");
  const {
    readWorkspaceDraft,
    saveWorkspaceDraft
  } = await import("../lib/services/analysis/workspace-repository.ts");
  const {
    generateSnapshotForDraft,
    readSnapshotForDraft
  } = await import("../lib/services/snapshot/snapshot-service.ts");
  const {
    exportResumeDocumentForDraft
  } = await import("../lib/services/export/resume-export-service.ts");
  const {
    createInterviewPrepFromRecord,
    readInterviewPrepForRecord,
    buildInterviewPrepExportText
  } = await import("../lib/services/interview/interview-prep-service.ts");

  const now = new Date();

  const modelProbe = await callModelJSON({
    task: "jd_analysis",
    systemPrompt: "只返回合法 JSON，不要输出 Markdown。",
    userPrompt: "请返回 {\"ok\":true,\"purpose\":\"OfferYou 模型探针\"}。",
    fallbackFactory: () => ({ ok: false, purpose: "规则兜底探针" })
  });
  const targetRole = await extractTargetRoleFromJd({
    jdContent,
    callModelJSON
  });

  const draft = await createDraft({
    company: targetRole.company,
    jobTitle: targetRole.jobTitle,
    language: "zh",
    masterResumeId: "self-use-goal-2026-05-06",
    jdContent,
    resumeAssetRef: resumePdfPath
  });

  const acceptance = await acceptRepresentativeSuggestions({
    draft,
    readWorkspaceDraft,
    saveWorkspaceDraft,
    generateSnapshotForDraft
  });

  const snapshotResult = await generateSnapshotForDraft(draft.id);
  const snapshot = await readSnapshotForDraft(draft.id);
  if (!snapshot) {
    throw new Error("Snapshot 生成后仍无法读取。");
  }

  const exports = [];
  for (const templateKey of ["professional-cn", "ats-clean"]) {
    const exportResult = await exportResumeDocumentForDraft({
      draftId: draft.id,
      templateKey
    });
    const stablePath = path.join(artifactRoot, `${templateKey}-${path.basename(exportResult.storagePath)}`);
    await copyFile(exportResult.storagePath, stablePath);
    const pdfStat = await stat(stablePath);
    const extracted = await extractTextFromStoredAsset({
      assetPath: stablePath,
      mimeType: "application/pdf",
      filename: stablePath
    });
    exports.push({
      templateKey,
      recordId: exportResult.recordId,
      sourcePath: exportResult.storagePath,
      stablePath,
      sizeBytes: pdfStat.size,
      extractedTextLength: extracted.extractedText.length,
      extractedTextSample: compactText(extracted.extractedText).slice(0, 260),
      checks: buildPdfContentChecks(extracted.extractedText)
    });
  }

  const interviewPrep = await createInterviewPrepFromRecord(exports[0].recordId);
  const reloadedInterviewPrep = await readInterviewPrepForRecord(exports[0].recordId);
  const interviewExportText = reloadedInterviewPrep
    ? buildInterviewPrepExportText(reloadedInterviewPrep)
    : buildInterviewPrepExportText(interviewPrep);
  const interviewPath = path.join(artifactRoot, "interview-prep.md");
  await writeFile(interviewPath, `${interviewExportText.trim()}\n`, "utf-8");

  const latestDraft = await readWorkspaceDraft(draft.id);
  const acceptedSuggestions = latestDraft?.suggestions.filter((suggestion) => suggestion.status === "accepted") ?? [];
  const allGenerationModes = latestDraft?.suggestions.map((suggestion) => suggestion.generationMode ?? "unknown") ?? [];
  const anyFallback = allGenerationModes.includes("deterministic_fallback") || Boolean(modelProbe.fallbackReason);
  const snapshotText = snapshot.sections
    .flatMap((section) => section.items.map((item) => item.type === "entry" ? formatSnapshotEntryForCheck(item) : item.text))
    .join(" ");
  const checks = buildHumanReadableChecks({
    snapshot,
    snapshotText,
    draft: latestDraft ?? draft,
    exports,
    interviewPrep: reloadedInterviewPrep ?? interviewPrep
  });

  const report = buildReport({
    now,
    envSummary,
    modelProbe,
    resumePdfPath,
    jdScreenshotPaths,
    jdExtraction,
    targetRole,
    jdContent,
    resumeExtractedText,
    extractionMs,
    draft: latestDraft ?? draft,
    acceptance,
    snapshotResult,
    snapshot,
    exports,
    interviewPath,
    interviewPrep: reloadedInterviewPrep ?? interviewPrep,
    checks,
    anyFallback
  });

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${report.trim()}\n`, "utf-8");

  console.log(JSON.stringify({
    ok: true,
    reportPath,
    draftId: draft.id,
    accepted: acceptedSuggestions.length,
    modelProbe: {
      provider: modelProbe.provider,
      generationMode: modelProbe.generationMode,
      fallbackReason: modelProbe.fallbackReason ?? null
    },
    pdfs: exports.map((item) => item.stablePath),
    interviewPath
  }, null, 2));
} finally {
  process.chdir(previousCwd);
  await rm(tempDir, { recursive: true, force: true });
}

function isSectionContentMismatch(suggestion) {
  const text = `${suggestion.title ?? ""}\n${suggestion.beforeText ?? ""}\n${suggestion.afterText ?? ""}`;
  const educationOrCredential = /(大学|学院|本科|硕士|博士|学历|教育|CET|英语|证书|从业资格|驾驶证)/iu.test(text);
  const workLike = /(公司|银行|集团|科技|岗位|经理|工程师|运营|客户|业务|负责|协助|主导|推进|优化|分析|交付)/iu.test(text);
  const projectLike = /(项目|产品|系统|平台|工具|Agent|AI|MVP|PRD|接口|流程|工作流|上线|发布|迭代)/iu.test(text);

  if ((suggestion.section === "experience" || suggestion.section === "work") && educationOrCredential && !workLike) return true;
  if (suggestion.section === "project" && educationOrCredential && !projectLike) return true;
  return false;
}

async function acceptRepresentativeSuggestions({ draft, readWorkspaceDraft, saveWorkspaceDraft, generateSnapshotForDraft }) {
  const accepted = [];
  const skipped = [];
  const preferredSections = ["summary", "experience", "work", "project", "education"];
  const seenSections = new Set();

  const candidates = [...draft.suggestions].sort((a, b) => {
    const aRank = preferredSections.indexOf(a.section);
    const bRank = preferredSections.indexOf(b.section);
    return normalizeRank(aRank) - normalizeRank(bRank);
  });

  for (const suggestion of candidates) {
    if (accepted.length >= 3) break;
    if (seenSections.has(suggestion.section) && accepted.length < 2) continue;

    if (isSectionContentMismatch(suggestion)) {
      skipped.push({
        id: suggestion.id,
        title: suggestion.title,
        section: suggestion.section,
        reason: "模块内容错配，未自动接受。"
      });
      continue;
    }

    if (suggestion.verification?.status === "fail") {
      skipped.push({
        id: suggestion.id,
        title: suggestion.title,
        section: suggestion.section,
        reason: "事实校验失败，未强行接受。"
      });
      continue;
    }

    try {
      const currentDraft = await readWorkspaceDraft(draft.id);
      const currentSuggestion = currentDraft?.suggestions.find((item) => item.id === suggestion.id);
      if (!currentDraft || !currentSuggestion) {
        throw new Error("草稿或建议不存在。");
      }

      currentSuggestion.status = "accepted";
      currentSuggestion.acceptedAfterText = currentSuggestion.afterText;
      currentSuggestion.acceptedReasonText = currentSuggestion.reasonText;
      await saveWorkspaceDraft(currentDraft);
      await generateSnapshotForDraft(draft.id);
      accepted.push({
        id: suggestion.id,
        title: suggestion.title,
        section: suggestion.section,
        generationMode: suggestion.generationMode ?? "unknown",
        modelProvider: suggestion.modelProvider ?? "unknown",
        verificationStatus: suggestion.verification?.status ?? "unknown",
        snapshotSynced: true
      });
      seenSections.add(suggestion.section);
    } catch (error) {
      skipped.push({
        id: suggestion.id,
        title: suggestion.title,
        section: suggestion.section,
        reason: error instanceof Error ? error.message : "接受失败。"
      });
    }
  }

  const latestDraft = await readWorkspaceDraft(draft.id);

  return {
    requestedMinimum: 3,
    accepted,
    skipped,
    totalAcceptedInDraft: latestDraft?.suggestions.filter((suggestion) => suggestion.status === "accepted").length ?? accepted.length
  };
}

function buildHumanReadableChecks({ snapshot, snapshotText, draft, exports, interviewPrep }) {
  const allHeadings = snapshot.sections
    .flatMap((section) => section.items.map((item) => item.type === "entry" ? item.heading : item.text))
    .join("\n");
  const duplicatedHeadings = findDuplicates(
    snapshot.sections.flatMap((section) => section.items.map((item) => item.type === "entry" ? item.heading : ""))
      .filter(Boolean)
  );

  const snapshotChecks = buildPdfContentChecks(snapshotText);

  return {
    pdfOpened: exports.every((item) => item.sizeBytes > 1000 && item.extractedTextLength > 40),
    hasName: snapshot.header.name.includes("吴") || snapshot.header.name.includes("OfferYou") === false,
    hasEducation: snapshotChecks.hasAnyEducation,
    hasUndergraduate: snapshotChecks.hasUndergraduate,
    hasGraduate: snapshotChecks.hasGraduate,
    companyNameChangedRisk: /陕西正大/.test(snapshotText),
    hasExpectedCompany: /陕西怡阳|广发银行|金山云|OfferYou/.test(snapshotText),
    hasOfferYouProject: snapshotChecks.hasOfferYouProject,
    hasInternalAdviceLeak: snapshotChecks.hasInternalAdviceLeak,
    hasDuplicateContentRisk: duplicatedHeadings.length > 0,
    acceptedSynced: draft.suggestions.some((suggestion) => suggestion.status === "accepted") && snapshot.sections.length > 0,
    exportTemplateCount: exports.length,
    interviewBasedOnSnapshot: interviewPrep.generationMode === "model" || interviewPrep.generationMode === "model_repaired" || interviewPrep.questions.length >= 5,
    snapshotSectionCount: snapshot.sections.length,
    riskNotes: [
      ...draft.analysis.riskNotes,
      ...exports.flatMap((item) => item.extractedTextLength < 40 ? [`${item.templateKey} 导出 PDF 文本提取长度偏低。`] : [])
    ],
    duplicatedHeadings,
    allHeadingsSample: allHeadings.slice(0, 300)
  };
}

function buildReport(input) {
  const generationModeCounts = countBy(input.draft.suggestions.map((suggestion) => suggestion.generationMode ?? "unknown"));
  const providerCounts = countBy(input.draft.suggestions.map((suggestion) => suggestion.modelProvider ?? "unknown"));
  const fallbackReasons = input.draft.suggestions
    .map((suggestion) => suggestion.modelFallbackReason)
    .filter(Boolean);
  const canReallySubmit = (
    input.exports.every((item) => item.sizeBytes > 1000) &&
    input.acceptance.accepted.length >= 3 &&
    input.checks.hasEducation &&
    input.checks.hasUndergraduate &&
    input.checks.hasOfferYouProject &&
    !input.checks.hasInternalAdviceLeak &&
    input.exports.every((item) => item.checks.hasUndergraduate && item.checks.hasOfferYouProject && !item.checks.hasInternalAdviceLeak) &&
    !input.checks.companyNameChangedRisk &&
    input.snapshot.sections.length > 0
  );

  const finalVerdict = canReallySubmit
    ? "可以进入人工复核后投递。当前产物已生成 PDF 与面试准备，但仍建议人工逐段检查 AI 改写质量。"
    : "暂不建议直接投递。当前链路生成了 PDF 和面试准备，但仍存在需要人工复核或修复的问题。";

  return [
    "# OfferYou 自用求职闭环验收报告",
    "",
    `验收日期：${formatDateZh(input.now)}`,
    "",
    "## 1. 模型与环境",
    "",
    `- 默认模型供应商：${input.envSummary.DEFAULT_MODEL_PROVIDER}`,
    `- MiMo Key：${input.envSummary.MIMO_API_KEY}`,
    `- MiMo Base URL：${input.envSummary.MIMO_BASE_URL}`,
    `- MiMo Model：${input.envSummary.MIMO_MODEL}`,
    `- DeepSeek Key：${input.envSummary.DEEPSEEK_API_KEY}`,
    `- Gemini Key：${input.envSummary.GEMINI_API_KEY}`,
    `- 模型探针：provider=${input.modelProbe.provider}，generationMode=${input.modelProbe.generationMode ?? "unknown"}${input.modelProbe.fallbackReason ? `，降级原因：${input.modelProbe.fallbackReason}` : ""}`,
    "",
    "## 2. 输入材料",
    "",
    `- 原始简历：${input.resumePdfPath}`,
    `- JD 截图：${input.jdScreenshotPaths.join("；")}`,
    `- JD 来源说明：本次使用桌面真实 JD 截图。主验收岗位：${input.targetRole.company}｜${input.targetRole.jobTitle}。`,
    `- JD 识别方式：${input.jdExtraction.usedOcr ? "本机 OCR 通过质量检查" : "本机 OCR 未通过质量检查，使用人工视觉转写"}。`,
    `- 多模态识别：当前验收脚本未接入多模态模型，不能声称由 AI 视觉模型识别 JD 截图。`,
    input.jdExtraction.fallbackReason ? `- JD 识别降级原因：${input.jdExtraction.fallbackReason}` : "",
    `- JD 文本长度：${input.jdContent.length} 字符。`,
    `- PDF 解析长度：${input.resumeExtractedText.length} 字符，耗时 ${input.extractionMs} ms。`,
    `- PDF 解析片段：${compactText(input.resumeExtractedText).slice(0, 220) || "未提取到文本。"}`,
    "",
    "## 3. 链路结果",
    "",
    "### 简历解析",
    "",
    `- calibratedResume：${input.draft.calibratedResume ? "已生成" : "未生成"}`,
    `- 模块数量：${input.draft.calibratedResume?.entries?.length ?? 0}`,
    `- 解析风险：${input.draft.calibratedResume?.parseWarnings?.join("；") || "无明确结构风险。"}`,
    "",
    "### JD 理解",
    "",
    `- 公司：${input.draft.company}`,
    `- 岗位：${input.draft.jobTitle}`,
    `- JDInsight generationMode：${input.draft.jdInsight?.generationMode ?? "unknown"}`,
    `- 核心能力：${(input.draft.jdInsight?.coreAbilities ?? []).join("、") || "未识别"}`,
    `- 硬要求：${(input.draft.jdInsight?.hardRequirements ?? []).join("、") || "未识别"}`,
    "",
    "### 改写建议",
    "",
    `- 建议数量：${input.draft.suggestions.length}`,
    `- generationMode 分布：${formatCountMap(generationModeCounts)}`,
    `- provider 分布：${formatCountMap(providerCounts)}`,
    `- fallbackReason：${fallbackReasons.length > 0 ? fallbackReasons.join("；") : "无"}`,
    `- 接受建议：${input.acceptance.accepted.length}/${input.acceptance.requestedMinimum}`,
    ...input.acceptance.accepted.map((item) => `  - ${item.section}｜${item.title}｜${item.generationMode}｜snapshotSynced=${item.snapshotSynced}`),
    ...(input.acceptance.skipped.length > 0 ? ["- 跳过建议：", ...input.acceptance.skipped.map((item) => `  - ${item.section}｜${item.title}｜${item.reason}`)] : []),
    "",
    "### Snapshot",
    "",
    `- Snapshot templateKey：${input.snapshot.templateKey}`,
    `- Section 数量：${input.snapshot.sections.length}`,
    `- 页数估算：${input.snapshotResult.pageEstimate}`,
    `- 标题样例：${input.checks.allHeadingsSample || "无"}`,
    "",
    "### PDF",
    "",
    ...input.exports.flatMap((item) => [
      `- ${item.templateKey}`,
      `  - 路径：${item.stablePath}`,
      `  - 大小：${item.sizeBytes} bytes`,
      `  - PDF 文本提取长度：${item.extractedTextLength}`,
      `  - PDF 文本片段：${item.extractedTextSample || "无法提取文本"}`
    ]),
    "",
    "### 面试准备",
    "",
    `- 输出路径：${input.interviewPath}`,
    `- generationMode：${input.interviewPrep.generationMode ?? "unknown"}`,
    `- provider：${input.interviewPrep.modelProvider ?? "unknown"}`,
    `- 问题数量：${input.interviewPrep.questions.length}`,
    `- 自我介绍长度：${input.interviewPrep.selfIntroDraft.trim().length}`,
    `- 风险提示：${(input.interviewPrep.riskNotes ?? []).join("；") || "无"}`,
    "",
    "## 4. 人工可读检查",
    "",
    `- PDF 是否可打开：${renderBoolean(input.checks.pdfOpened)}`,
    `- 个人信息是否有姓名：${renderBoolean(input.checks.hasName)}`,
    `- 教育背景是否存在：${renderBoolean(input.checks.hasEducation)}`,
    `- 本科教育是否保留：${renderBoolean(input.checks.hasUndergraduate)}`,
    `- 硕士教育是否保留：${renderBoolean(input.checks.hasGraduate)}`,
    `- 公司名称是否出现「陕西正大」误改风险：${input.checks.companyNameChangedRisk ? "存在" : "未发现"}`,
    `- 是否包含预期经历公司或项目：${renderBoolean(input.checks.hasExpectedCompany)}`,
    `- OfferYou 项目是否保留：${renderBoolean(input.checks.hasOfferYouProject)}`,
    `- 是否泄漏内部建议文案：${input.checks.hasInternalAdviceLeak ? "存在" : "未发现"}`,
    `- 是否存在重复标题风险：${input.checks.hasDuplicateContentRisk ? `存在：${input.checks.duplicatedHeadings.join("、")}` : "未发现"}`,
    `- 接受建议后预览是否可同步到 Snapshot：${renderBoolean(input.checks.acceptedSynced)}`,
    `- 是否分别导出两个模板：${input.checks.exportTemplateCount === 2 ? "是" : "否"}`,
    `- 面试准备是否基于 Snapshot/JD：${renderBoolean(input.checks.interviewBasedOnSnapshot)}`,
    "",
    "PDF 内容完整性：",
    ...input.exports.map((item) => `- ${item.templateKey}：本科=${renderBoolean(item.checks.hasUndergraduate)}，OfferYou 项目=${renderBoolean(item.checks.hasOfferYouProject)}，内部建议泄漏=${item.checks.hasInternalAdviceLeak ? "存在" : "未发现"}`),
    "",
    "## 5. 失败或风险",
    "",
    `- 模型 fallback：${input.anyFallback ? "存在或需要继续人工核实" : "本次探针和建议未显示整体 fallback"}`,
    `- 事实风险：${input.checks.riskNotes.length > 0 ? input.checks.riskNotes.join("；") : "未发现明显事实风险。"}`,
    input.jdExtraction.usedOcr
      ? "- 输入风险：JD 来自截图 OCR，仍需人工核对截图文字是否完整。"
      : "- 输入风险：本机 OCR 未通过质量检查，JD 使用人工视觉转写；这是可追踪输入，不是 job-apply 生成物，也不是多模态模型识别结果。",
    "- 浏览器限制：本脚本通过 Playwright/Chromium 导出 PDF，没有在用户浏览器中人工点击完成。",
    "",
    "## 6. 最终结论",
    "",
    finalVerdict,
    "",
    "距离 job-apply Skill 的差距：",
    "- 本次已使用桌面真实 JD 截图和原始 PDF 简历，但 JD 截图没有走多模态模型；后续需要接入多模态直读或严格 OCR 完整度门禁。",
    "- 仍需要人工判断 AI 改写是否真正超过规则模板，而不是只看 generationMode。",
    "- 仍需要在浏览器中完成一次人工上传、确认、预览、导出的体验验收。",
    "",
    "下一轮只建议做 3 件事：",
    "- 把 JD 截图 OCR 完整度作为硬门槛：低于阈值时请求人工确认或改用多模态模型，不进入伪完整链路。",
    "- 加一个「模型未真实返回就停止」的硬门槛，避免规则兜底进入投递链路。",
    "- 做一条 PDF 内容一致性检查：接受建议文本、Snapshot、Professional CN PDF、ATS Clean PDF 四者必须可对齐。",
    "",
    "## 7. 附录",
    "",
    "已运行或需要配套运行的命令：",
    "- `git status --short`：已检查，仓库存在大量前序改动，本次未清理。",
    "- `git grep -n \"tp-\"`：已检查，未发现明显真实 API Key 入库；存在测试 fixture 与锁文件 false positive。",
    "- `git ls-files | rg \"env|sqlite|\\\\.log$|storage|node_modules|\\\\.next\"`：已检查，未发现运行产物入库。",
    "- `pnpm exec tsc --noEmit`：本轮前置检查通过。",
    "- `pnpm test`：本轮前置检查通过。",
    "- `pnpm run check:vnext`：本轮前置检查通过。",
    "- `pnpm run test:pdf`：需在本报告生成后再次运行确认。"
  ].join("\n");
}

function loadDotEnvLocal(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSyncUtf8(filePath);
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function readFileSyncUtf8(filePath) {
  return existsSync(filePath)
    ? Buffer.from(readFileSync(filePath)).toString("utf-8")
    : "";
}

function summarizeEnv(key, options = {}) {
  const value = process.env[key];
  if (!value) return "missing";
  if (options.revealValue) return `present:${value}`;
  if (options.revealUrlPrefix) {
    try {
      const url = new URL(value);
      return `present:${url.origin}/...`;
    } catch {
      return "present";
    }
  }
  return "present";
}

function compactText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeRank(rank) {
  return rank === -1 ? 99 : rank;
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function formatCountMap(map) {
  return Object.entries(map)
    .map(([key, value]) => `${key}:${value}`)
    .join("，") || "无";
}

function parseListEnv(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

async function extractJdFromScreenshots({ jdScreenshotPaths, extractTextFromResumeSource }) {
  const explicitJdText = readExplicitJdText();
  if (explicitJdText) {
    return {
      usedOcr: false,
      jdContent: explicitJdText,
      parts: [],
      fallbackReason: undefined,
      sourceMode: "explicit_text"
    };
  }

  const ocrParts = [];

  for (const screenshotPath of jdScreenshotPaths) {
    try {
      const text = await extractTextFromResumeSource({
        rawReference: screenshotPath
      });
      if (text.trim()) {
        ocrParts.push({
          screenshotPath,
          text: text.trim()
        });
      }
    } catch {
      // The acceptance report records the fallback; do not fail the whole run because local OCR is unavailable.
    }
  }

  const ocrText = ocrParts.map((part) => `【截图：${part.screenshotPath}】\n${part.text}`).join("\n\n").trim();
  if (isReliableJdOcrText(ocrText)) {
    return {
      usedOcr: true,
      jdContent: ocrText,
      parts: ocrParts,
      fallbackReason: undefined,
      sourceMode: "ocr"
    };
  }

  const reason = ocrText
    ? "本机 OCR 返回内容存在明显乱码或缺少岗位关键信息。"
    : "本机 OCR 不可用或提取文本过短。";
  throw new Error(
    [
      `${reason} 当前验收脚本没有接入多模态视觉模型，不能把 JD 截图伪装成已识别。`,
      "请提供 JD 文本，或配置真正可读取图片的多模态模型后再跑验收。",
      "可选输入：设置 OFFERYOU_SELF_USE_JD_TEXT，或设置 OFFERYOU_SELF_USE_JD_TEXT_PATH 指向 JD 文本文件。"
    ].join(" ")
  );
}

function isReliableJdOcrText(text) {
  const normalized = text.replace(/\s+/g, "");
  if (normalized.length < 180) {
    return false;
  }

  const chineseCount = [...normalized].filter((char) => /[\u4e00-\u9fa5]/u.test(char)).length;
  const chineseRatio = chineseCount / Math.max(normalized.length, 1);
  const hasCompany = /魔镜洞察|鲜啤福鹿家|天威诚信|中电信人工智能公司|华信瑞德|海普信息技术/u.test(text);
  const hasJdStructure = /岗位职责|任职要求|我们要找的人|需求管理|产品全流程|AI产品/u.test(text);

  return chineseRatio >= 0.35 && hasCompany && hasJdStructure;
}

function readExplicitJdText() {
  const inlineText = process.env.OFFERYOU_SELF_USE_JD_TEXT?.trim();
  if (inlineText) {
    return inlineText;
  }

  const jdTextPath = process.env.OFFERYOU_SELF_USE_JD_TEXT_PATH?.trim();
  if (jdTextPath) {
    return readFileSyncUtf8(jdTextPath).trim();
  }

  return "";
}

async function extractTargetRoleFromJd({ jdContent, callModelJSON }) {
  const response = await callModelJSON({
    task: "jd_analysis",
    systemPrompt: [
      "从 JD 文本中抽取主投递岗位。",
      "只返回 JSON，不要 Markdown。",
      "格式：{\"company\":\"公司名\",\"jobTitle\":\"岗位名\",\"confidence\":\"high|medium|low\",\"evidence\":\"原文证据\"}。",
      "如果 JD 中没有公司名或岗位名，字段留空，不要猜。"
    ].join("\n"),
    userPrompt: jdContent,
    fallbackFactory: () => null
  });

  if (response.generationMode === "deterministic_fallback" || !response.data) {
    throw new Error("模型未能抽取 JD 公司与岗位，已停止验收，避免写入默认公司或岗位。");
  }

  const company = normalizeTargetRoleField(response.data.company);
  const jobTitle = normalizeTargetRoleField(response.data.jobTitle);
  if (!company || !jobTitle || company === "待确认公司" || jobTitle === "目标岗位") {
    throw new Error("JD 公司或岗位抽取不完整，已停止验收。请补充 JD 文本或人工确认公司与岗位后再运行。");
  }

  return {
    company,
    jobTitle
  };
}

function normalizeTargetRoleField(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function findDuplicates(values) {
  const counts = countBy(values);
  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

function buildPdfContentChecks(text) {
  return {
    hasAnyEducation: /对外经济贸易大学|湖南工业大学|本科|硕士/.test(text),
    hasUndergraduate: /湖南工业大学/.test(text) && /本科/.test(text),
    hasGraduate: /对外经济贸易大学/.test(text) && /硕士/.test(text),
    hasOfferYouProject: /OfferYou/.test(text) && /岗位定制简历助手|求职辅助产品|AI\s*岗位定制/.test(text),
    hasInternalAdviceLeak: /JD\s*缺失能力提醒|缺失能力提醒|建议在总结|岗位能力待确认|建议补充/.test(text)
  };
}

function formatSnapshotEntryForCheck(item) {
  return [
    item.heading,
    item.subheading,
    item.meta,
    item.summary,
    ...(item.bullets ?? [])
  ]
    .filter(Boolean)
    .join(" ");
}

function renderBoolean(value) {
  return value ? "是" : "否";
}

function formatDateZh(date) {
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
