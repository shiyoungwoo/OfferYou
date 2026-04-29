import { randomUUID } from "node:crypto";
import { callModelJSON } from "@/lib/ai/model-gateway";
import { calibratedResumeProfileSchema } from "@/lib/services/calibration/resume-calibration-types";
import type {
  CalibratedResumeEntry,
  CalibratedResumeProfile,
  ResumeEntrySection
} from "@/lib/services/calibration/resume-calibration-types";

type CalibrationInput = {
  resumeText: string;
};

export async function calibrateResumeStructure(input: CalibrationInput): Promise<CalibratedResumeProfile> {
  const fallback = calibrateResumeStructureDeterministic(input);
  const result = await callModelJSON<unknown>({
    task: "resume_calibration",
    systemPrompt: buildCalibrationSystemPrompt(),
    userPrompt: buildCalibrationUserPrompt(input.resumeText)
  });

  if (!result.data) {
    return {
      ...fallback,
      modelNotes: [...fallback.modelNotes, result.fallbackReason ?? "模型不可用，已使用确定性结构恢复。"]
    };
  }

  const parsed = calibratedResumeProfileSchema.safeParse(result.data);
  if (!parsed.success) {
    return {
      ...fallback,
      modelNotes: [...fallback.modelNotes, "模型返回结构无法通过校验，已使用确定性结构恢复。"]
    };
  }

  return {
    ...parsed.data,
    modelProvider: result.provider,
    updatedAt: new Date().toISOString()
  };
}

export function calibrateResumeStructureDeterministic(input: CalibrationInput): CalibratedResumeProfile {
  const lines = input.resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const personalInfo = extractPersonalInfo(lines);
  const parseWarnings = collectParseWarnings(lines);
  const entries: CalibratedResumeEntry[] = [];
  const unclassifiedText: string[] = [];
  let currentSection: ResumeEntrySection = "other";
  let currentEntry: CalibratedResumeEntry | null = null;

  for (const line of lines) {
    const section = detectSectionHeading(line);
    if (section) {
      if (currentEntry) {
        entries.push(currentEntry);
        currentEntry = null;
      }
      currentSection = section;
      continue;
    }

    if (isPersonalInfoLine(line, personalInfo)) {
      continue;
    }

    if (looksLikeEntryTitle(line)) {
      if (currentEntry) {
        entries.push(currentEntry);
      }

      const dateRange = extractDateRange(line);
      const title = stripDateRange(line).trim() || line;
      const issues: string[] = [];
      if (currentSection === "other") {
        issues.push("无法确定该经历所属模块，请人工确认。");
      }

      currentEntry = {
        id: randomUUID(),
        section: currentSection,
        title,
        dateRange,
        bullets: [],
        sourceText: line,
        confidence: currentSection === "other" ? "low" : "medium",
        issues
      };
      continue;
    }

    if (currentEntry) {
      currentEntry.bullets.push(line);
      currentEntry.sourceText = `${currentEntry.sourceText}\n${line}`;
    } else {
      unclassifiedText.push(line);
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  const hasLowConfidence = entries.some((entry) => entry.confidence === "low" || entry.issues.length > 0);
  const missingRequired = !personalInfo.name || !personalInfo.phone || !personalInfo.email || !entries.some((entry) => entry.section === "education");

  return {
    status: hasLowConfidence || missingRequired || parseWarnings.length > 0 ? "needs_review" : "confirmed",
    personalInfo,
    entries,
    unclassifiedText,
    parseWarnings,
    modelNotes: ["当前结果来自确定性结构恢复，适合兜底，不等同于多模态校准。"],
    modelProvider: "deterministic_fallback",
    updatedAt: new Date().toISOString()
  };
}

function extractPersonalInfo(lines: string[]) {
  const text = lines.slice(0, 8).join(" ");
  return {
    name: lines.find((line) => /^[\u4e00-\u9fa5·]{2,8}$/.test(line)),
    phone: text.match(/1[3-9]\d{9}/)?.[0],
    email: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0],
    location: text.match(/(?:所在地|居住地|城市)[:：]?\s*([^|｜\s]+)/u)?.[1],
    github: text.match(/github[:：]?\s*([^|｜\s]+)/i)?.[1],
    portfolio: text.match(/(?:作品集|portfolio)[:：]?\s*([^|｜\s]+)/i)?.[1]
  };
}

function detectSectionHeading(line: string): ResumeEntrySection | null {
  const compact = line.replace(/\s+/g, "");
  if (/^(个人优势|自我评价|个人总结|核心优势)$/u.test(compact)) return "summary";
  if (/^(工作经历|工作经验|职业经历|任职经历|实习经历)$/u.test(compact)) return "work";
  if (/^(项目经历|项目经验|个人项目|代表项目)$/u.test(compact)) return "project";
  if (/^(教育背景|教育经历|学历背景|学习经历)$/u.test(compact)) return "education";
  return null;
}

function looksLikeEntryTitle(line: string) {
  return Boolean(extractDateRange(line)) || /(大学|学院|公司|项目|产品|经理|负责人|实习|本科|硕士|博士)/u.test(line);
}

function extractDateRange(line: string) {
  return line.match(/(?:\d{4}[./]\d{2}|\d{4})\s*[-—–至]\s*(?:至今|Present|\d{4}[./]\d{2}|\d{4})/i)?.[0];
}

function stripDateRange(line: string) {
  const dateRange = extractDateRange(line);
  return dateRange ? line.replace(dateRange, "") : line;
}

function collectParseWarnings(lines: string[]) {
  return lines
    .filter((line) => /O["“”']?erYou|\$|�|\uFFFD/.test(line))
    .map((line) => `疑似 OCR 识别异常：${line}`);
}

function isPersonalInfoLine(line: string, info: ReturnType<typeof extractPersonalInfo>) {
  const values = [info.name, info.phone, info.email, info.location, info.github, info.portfolio].filter(Boolean) as string[];
  return values.some((value) => line.includes(value));
}

function buildCalibrationSystemPrompt() {
  return [
    "你是简历结构校准器，只负责从解析文本中恢复事实结构，不负责美化简历。",
    "必须保留事实，不得编造公司、学校、时间、职位、结果。",
    "如果字段不确定，confidence 写 low，并在 issues 中说明。",
    "如果发现 OCR 错误，例如 O\\\"erYou，应记录 parseWarnings，并在 title 中给出最可能的修正。",
    "输出必须是符合 CalibratedResumeProfile 的 JSON，不要输出 Markdown。"
  ].join("\n");
}

function buildCalibrationUserPrompt(resumeText: string) {
  return `请校准以下简历解析文本，恢复为结构化简历。\n\n${resumeText}`;
}
