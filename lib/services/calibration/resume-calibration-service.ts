import { callModelJSON } from "@/lib/ai/model-gateway";
import { calibratedResumeProfileSchema } from "@/lib/services/calibration/resume-calibration-types";
import type {
  CalibratedResumeEntry,
  CalibratedResumeProfile,
  ResumeEntrySection
} from "@/lib/services/calibration/resume-calibration-types";
import { normalizeResumeEntrySection } from "@/lib/services/calibration/resume-calibration-types";

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

  const parsed = calibratedResumeProfileSchema.safeParse(normalizeModelCalibrationPayload(result.data));
  if (!parsed.success) {
    return {
      ...fallback,
      modelNotes: [...fallback.modelNotes, "模型返回结构无法通过校验，已使用确定性结构恢复。"]
    };
  }

  // Normalize legacy sections in model output
  const normalizedEntries = parsed.data.entries.map((entry) => ({
    ...entry,
    section: normalizeResumeEntrySection(entry.section),
    sectionType: entry.sectionType ? normalizeResumeEntrySection(entry.sectionType) : entry.section
  }));

  return {
    ...parsed.data,
    entries: normalizedEntries,
    modelProvider: result.provider,
    updatedAt: new Date().toISOString()
  };
}

function normalizeModelCalibrationPayload(data: unknown) {
  if (!isRecord(data)) return data;
  if (!Array.isArray(data.entries)) return data;

  return {
    status: isCalibrationStatus(data.status) ? data.status : "needs_review",
    personalInfo: isRecord(data.personalInfo) ? data.personalInfo : {},
    entries: data.entries.map((entry, index) => normalizeModelCalibrationEntry(entry, index)),
    unclassifiedText: Array.isArray(data.unclassifiedText) ? data.unclassifiedText.filter(isString) : [],
    parseWarnings: Array.isArray(data.parseWarnings) ? data.parseWarnings.filter(isString) : [],
    modelNotes: Array.isArray(data.modelNotes) ? data.modelNotes.filter(isString) : []
  };
}

function normalizeModelCalibrationEntry(entry: unknown, index: number) {
  const record = isRecord(entry) ? entry : {};
  const bullets = Array.isArray(record.bullets)
    ? record.bullets.filter(isString)
    : typeof record.bullets === "string"
      ? splitBullets(record.bullets)
      : [];
  const title = isString(record.title) && record.title.trim() ? record.title.trim() : `简历条目 ${index + 1}`;
  const sourceText = isString(record.sourceText) && record.sourceText.trim()
    ? record.sourceText.trim()
    : [title, record.dateRange, ...bullets].filter(isString).join("\n");

  const id = isString(record.id) && record.id.trim() ? record.id.trim() : crypto.randomUUID();
  const rawSection = isRawResumeSection(record.section) ? record.section : "other";
  const section = normalizeResumeEntrySection(rawSection);

  return {
    id,
    candidateId: id,
    section,
    sectionType: section,
    title,
    organization: isString(record.organization) ? record.organization : undefined,
    role: isString(record.role) ? record.role : undefined,
    dateRange: isString(record.dateRange) ? record.dateRange : undefined,
    bullets,
    sourceText,
    rawText: sourceText,
    confidence: isConfidence(record.confidence) ? record.confidence : "medium",
    issues: Array.isArray(record.issues) ? record.issues.filter(isString) : []
  };
}

export function calibrateResumeStructureDeterministic(input: CalibrationInput): CalibratedResumeProfile {
  const lines = input.resumeText
    .split(/\r?\n/)
    .map((line) => normalizeResumeLine(line))
    .filter(Boolean);

  const personalInfo = extractPersonalInfo(lines);
  const parseWarnings = collectParseWarnings(lines);
  const entries: CalibratedResumeEntry[] = [];
  const unclassifiedText: string[] = [];
  let currentSection: ResumeEntrySection = "other_needs_review";
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

    // For other_needs_review: auto-create an entry if one doesn't exist yet
    if (currentSection === "other_needs_review" && !currentEntry) {
      currentEntry = {
        id: crypto.randomUUID(),
        candidateId: "",
        section: currentSection,
        sectionType: currentSection,
        title: line,
        dateRange: undefined,
        bullets: [],
        sourceText: line,
        rawText: line,
        confidence: "low",
        issues: ["无法确定所属模块，请人工确认。"]
      };
      currentEntry.candidateId = currentEntry.id;
      continue;
    }

    if (currentEntry && shouldAppendLineToCurrentEntry(currentSection, line, currentEntry)) {
      appendLineToCalibrationEntry(currentEntry, line);
      continue;
    }

    // Credential-like content in non-credential context: force section switch
    if (currentSection !== "credential" && /(CET-?[46]|英语[：:]|雅思|托福|证书|基金从业|驾驶证|从业资格)/iu.test(line)) {
      if (currentEntry) {
        entries.push(currentEntry);
        currentEntry = null;
      }
      currentSection = "credential";
    }

    if (looksLikeEntryTitle(line, currentSection)) {
      if (currentEntry) {
        entries.push(currentEntry);
      }

      const dateRange = extractDateRange(line);
      const title = stripDateRange(line).trim() || line;
      const issues: string[] = [];
      if (currentSection === "other_needs_review") {
        issues.push("无法确定该经历所属模块，请人工确认。");
      }

      currentEntry = {
        id: crypto.randomUUID(),
        candidateId: "",
        section: currentSection,
        sectionType: currentSection,
        title,
        dateRange,
        bullets: [],
        sourceText: line,
        rawText: line,
        confidence: currentSection === "other_needs_review" ? "low" : "medium",
        issues
      };
      currentEntry.candidateId = currentEntry.id;
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

  // Normalize any legacy sections to canonical
  for (const entry of entries) {
    entry.section = normalizeResumeEntrySection(entry.section);
    entry.sectionType = entry.sectionType ? normalizeResumeEntrySection(entry.sectionType) : entry.section;
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
    name: normalizeChineseName(lines.find((line) => /^[\u4e00-\u9fa5·\s]{2,12}$/.test(line))),
    phone: text.match(/1[3-9]\d{9}/)?.[0],
    email: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0],
    location: text.match(/(?:所在地|居住地|城市)[:：]?\s*([^|｜\s]+)/u)?.[1],
    github: text.match(/github[:：]?\s*([^|｜\s]+)/i)?.[1],
    portfolio: text.match(/(?:作品集|portfolio)[:：]?\s*([^|｜\s]+)/i)?.[1]
  };
}

function detectSectionHeading(line: string): ResumeEntrySection | null {
  const compact = line.replace(/^#{1,6}\s*/u, "").replace(/\s+/g, "");
  if (/^(个人优势|个人概述|自我评价|个人总结|核心优势)$/u.test(compact)) return "summary";
  if (/^(工作经历|工作经验|职业经历|任职经历|实习经历)$/u.test(compact)) return "work";
  if (/^(项目经历|项目经验|个人项目|代表项目)$/u.test(compact)) return "project";
  if (/^(教育背景|教育经历|学历背景|学习经历)$/u.test(compact)) return "education";
  if (/^(技能与证书|技能证书|专业技能|技能|证书|语言能力)$/u.test(compact)) return "credential";
  if (/^(其他信息|其他|附加信息|补充)$/u.test(compact)) return "other_needs_review";
  return null;
}

function looksLikeEntryTitle(line: string, currentSection?: ResumeEntrySection) {
  if (extractDateRange(line)) return true;
  // Credential-like keywords should only create entry titles in credential context
  if (/(技能|证书|英语|CET|雅思|托福|基金从业|驾驶证|从业资格)/iu.test(line)) {
    return currentSection === "credential";
  }
  const cleaned = line.replace(/^\d+[.)、]\s*/u, "").trim();
  if (currentSection === "work") {
    return /[|｜]/u.test(cleaned) && /(运营|经理|工程师|专员|分析|顾问|实习|负责人|产品|内容|数据|客服|柜员)/iu.test(cleaned);
  }
  if (currentSection === "project") {
    return cleaned.length <= 42 && /(项目|流程|优化|产品|工具|内容|AI|Agent|系统|平台|工作流)/iu.test(cleaned);
  }
  return /(大学|学院|公司|项目|产品|经理|负责人|实习|本科|硕士|博士)/iu.test(line);
}

function shouldAppendLineToCurrentEntry(
  section: ResumeEntrySection,
  line: string,
  currentEntry: CalibratedResumeEntry
) {
  const dateRange = extractDateRange(line);
  const rest = stripDateRange(line).trim();

  if (section === "education") {
    return Boolean(dateRange) && rest.length === 0 && Boolean(currentEntry.title);
  }

  if (section === "summary") {
    return !dateRange;
  }

  if (section === "work" || section === "project") {
    if (dateRange) {
      return false;
    }

    return isExperienceContinuationLine(line);
  }

  if (section === "credential") {
    return !dateRange && !/^(技能|证书|语言|英语|CET)/iu.test(line);
  }

  if (section === "other_needs_review") {
    return !dateRange;
  }

  return false;
}

function appendLineToCalibrationEntry(entry: CalibratedResumeEntry, line: string) {
  const dateRange = extractDateRange(line);
  const rest = stripDateRange(line).trim();

  if (dateRange && rest.length === 0) {
    entry.dateRange = entry.dateRange ?? dateRange;
    entry.sourceText = `${entry.sourceText}\n${line}`;
    entry.rawText = entry.sourceText;
    return;
  }

  entry.bullets.push(line);
  entry.sourceText = `${entry.sourceText}\n${line}`;
  entry.rawText = entry.sourceText;
}

function isExperienceContinuationLine(line: string) {
  const cleaned = line.trim();
  if (!cleaned) {
    return false;
  }

  return (
    cleaned.length > 28 ||
    /[，。；：:、]/u.test(cleaned) ||
    /^(独立|输出|定义|核心模块|核心|关键|策划|验证|完成|基于|通过|流程优化|B\s*端|复杂问题|协助|主导|负责|参与|搭建|推进|优化|制定|支持|推动|提升|梳理|运营|发布|覆盖|单篇|系列)/iu.test(cleaned)
  );
}

function normalizeResumeLine(line: string) {
  return line
    .trim()
    .replace(/^#{1,6}\s*/u, "")
    .replace(/\s%+\s/u, " | ")
    .replace(/\$O[&＆]erYou\$/gu, "OfferYou")
    .replace(/O["'""\u201c\u2018]\s*erYou/gu, "OfferYou")
    .replace(/OfferYou\s*\)/gu, "OfferYou")
    .trim();
}

function normalizeChineseName(name?: string) {
  if (!name) return undefined;
  const compact = name.replace(/\s+/g, "");
  return /^[\u4e00-\u9fa5·]{2,8}$/u.test(compact) ? compact : undefined;
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
  if (/^求职意向[:：]/u.test(line)) {
    return true;
  }

  const values = [info.name, info.phone, info.email, info.location, info.github, info.portfolio].filter(Boolean) as string[];
  const compactLine = line.replace(/\s+/g, "");
  return values.some((value) => line.includes(value) || compactLine.includes(value.replace(/\s+/g, "")));
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isCalibrationStatus(value: unknown): value is CalibratedResumeProfile["status"] {
  return value === "pending" || value === "needs_review" || value === "confirmed";
}

function isResumeSection(value: unknown): value is ResumeEntrySection {
  return value === "summary" || value === "work" || value === "project" || value === "education" || value === "credential" || value === "personal_info" || value === "other_needs_review";
}

function isRawResumeSection(value: unknown): value is string {
  return isResumeSection(value) || value === "supplement" || value === "other";
}

function isConfidence(value: unknown): value is CalibratedResumeEntry["confidence"] {
  return value === "high" || value === "medium" || value === "low";
}

function splitBullets(value: string) {
  return value
    .split(/\r?\n|[；;]/u)
    .map((line) => line.trim())
    .filter(Boolean);
}
