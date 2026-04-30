import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { listWorkspaceDrafts, saveWorkspaceDraft } = require("../lib/services/analysis/workspace-repository.ts");
const { analyzeDraft } = require("../lib/services/analysis/gap-analysis-service.ts");
const { calibrateResumeStructure } = require("../lib/services/calibration/resume-calibration-service.ts");
const { extractTextFromResumeSource } = require("../lib/services/ingestion/extract-text.ts");

function loadLocalEnv() {
  const envPath = ".env.local";
  if (!existsSync(envPath)) return;

  const envLines = readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function readDraftJdText(draft) {
  const storagePath = draft.jdAsset?.storagePath;
  if (storagePath && existsSync(storagePath)) {
    return readFileSync(storagePath, "utf-8");
  }

  return draft.jdPreview;
}

function buildFactSeeds(draft) {
  return [
    {
      title: "简历原文",
      section: "summary",
      text: draft.resumeExtractedText || "暂无提取到的简历内容。",
      sourceKind: "resume_baseline",
      sourceLabel: "简历原文"
    },
    ...draft.masterFactsUsed.map((fact) => ({
      title: fact.title,
      section: fact.blockType,
      text: fact.summary,
      sourceKind: "master_fact",
      sourceLabel: `默认事实: ${fact.title}`
    })),
    ...(draft.talentProfileUsed
      ? [
          {
            title: "已确认的优势档案",
            section: "summary",
            text: `${draft.talentProfileUsed.headline} ${draft.talentProfileUsed.confidenceNote}`,
            sourceKind: "target_role_fit",
            sourceLabel: "天赋视角"
          }
        ]
      : []),
    ...(draft.careerDirectionUsed
      ? [
          {
            title: `职业方向: ${draft.careerDirectionUsed.label}`,
            section: "summary",
            text: `${draft.careerDirectionUsed.rationale} 注意事项: ${draft.careerDirectionUsed.watchOut}`,
            sourceKind: "target_role_fit",
            sourceLabel: "职业方向视角"
          }
        ]
      : []),
    {
      title: "目标岗位契合度",
      section: "project",
      text: `正在申请 ${draft.company} 的 ${draft.jobTitle} 岗位，重点在于真实的岗位匹配、可迁移优势和有证据支撑的胜任力。`,
      sourceKind: "target_role_fit",
      sourceLabel: "岗位适配框架"
    }
  ];
}

loadLocalEnv();

const [draft] = await listWorkspaceDrafts();
if (!draft) {
  throw new Error("没有找到可重跑的草稿。");
}

const resumeExtractedText = await extractTextFromResumeSource({
  content: "",
  rawReference: draft.resumeSourceRef
});

const calibratedResume = await calibrateResumeStructure({
  resumeText: resumeExtractedText || draft.resumeExtractedText || ""
});

const analysis = await analyzeDraft({
  company: draft.company,
  jobTitle: draft.jobTitle,
  jdText: readDraftJdText(draft),
  talentProfile: draft.talentProfileUsed
    ? {
        headline: draft.talentProfileUsed.headline,
        confidenceNote: draft.talentProfileUsed.confidenceNote
      }
    : undefined,
  careerDirection: draft.careerDirectionUsed
    ? {
        label: draft.careerDirectionUsed.label,
        rationale: draft.careerDirectionUsed.rationale
      }
    : undefined,
  facts: buildFactSeeds({ ...draft, resumeExtractedText }),
  calibratedResume
});

const nextDraft = {
  ...draft,
  resumeExtractedText: resumeExtractedText || draft.resumeExtractedText,
  calibratedResume,
  analysis: {
    fitScore: analysis.fitScore,
    optimizationMode: analysis.optimizationMode,
    strengths: analysis.strengths,
    gaps: analysis.gaps,
    riskNotes: analysis.riskNotes
  },
  suggestions: analysis.suggestions
};

await saveWorkspaceDraft(nextDraft);

console.log(
  JSON.stringify(
    {
      draftId: nextDraft.id,
      company: nextDraft.company,
      jobTitle: nextDraft.jobTitle,
      suggestions: nextDraft.suggestions.map((suggestion) => ({
        id: suggestion.id,
        title: suggestion.title,
        sourceLabel: suggestion.sourceLabel,
        status: suggestion.status,
        afterPreview: suggestion.afterText.slice(0, 120)
      }))
    },
    null,
    2
  )
);
