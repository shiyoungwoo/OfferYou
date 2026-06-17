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
      status: "needs_review",
      modelNotes: [...fallback.modelNotes, result.fallbackReason ?? "模型不可用，已使用确定性结构恢复。"]
    };
  }

  const parsed = calibratedResumeProfileSchema.safeParse(normalizeModelCalibrationPayload(result.data));
  if (!parsed.success) {
    const schemaMessage = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "root"}：${issue.message}`)
      .join("；");
    return {
      ...fallback,
      status: "needs_review",
      modelNotes: [
        ...fallback.modelNotes,
        `模型返回结构无法通过校验，已使用确定性结构恢复。${schemaMessage ? `校验信息：${schemaMessage}` : ""}`
      ]
    };
  }

  // Normalize legacy sections in model output
  const normalizedEntries = normalizeCalibratedEntries(parsed.data.entries);
  const modelProfile: CalibratedResumeProfile = {
    ...parsed.data,
    entries: normalizedEntries,
    modelProvider: result.provider,
    updatedAt: new Date().toISOString()
  };

  if (shouldPreferDeterministicCalibration(modelProfile, fallback)) {
    return {
      ...fallback,
      status: fallback.status === "confirmed" ? "needs_review" : fallback.status,
      modelNotes: [
        ...fallback.modelNotes,
        "模型校准结果缺少关键模块、时间或工作经历，已改用确定性结构恢复，请人工核对。"
      ]
    };
  }

  return modelProfile;
}

/**
 * Normalize model output into a shape that matches CalibratedResumeProfile.
 *
 * Handles three common model output variants:
 *  - Standard:  `{ status, personalInfo, entries: [...] }`       (Gemini, well-prompted models)
 *  - Sections:  `{ sections: [{ type, dates, ... }] }`           (some OpenAI-compatible models)
 *  - Flat keys: `{ personal_info, summary, work: [...], education: [...] }`  (MiMo default)
 *
 * Per-entry field aliases:
 *  - `type` / `category` → `section`
 *  - `dates` / `startDate`+`endDate` → `dateRange`
 *  - `company` / `institution` → `title` (for work/education)
 *  - `position` → `role`
 *  - `responsibilities` / `content` (array) → `bullets`
 */
function normalizeModelCalibrationPayload(data: unknown) {
  if (!isRecord(data)) return data;

  // --- resolve entries array from three known layouts ---
  let rawEntries: unknown[] | null = null;

  if (Array.isArray(data.entries)) {
    // Standard layout
    rawEntries = data.entries;
  } else if (Array.isArray(data.sections)) {
    // Sections layout — two variants:
    //  A) flat sections: `[{ type: "work", title: "...", ... }]`  (some models)
    //  B) nested sections: `[{ section: "work", entries: [{ title: "...", ... }] }]`  (Gemini 3.5 Flash)
    const collected: unknown[] = [];
    for (const section of data.sections) {
      if (isRecord(section) && Array.isArray(section.entries)) {
        // Variant B: category header with nested entries
        const category = section.section ?? section.type ?? "other";
        for (const entry of section.entries) {
          if (isRecord(entry)) {
            collected.push({ ...entry, section: entry.section ?? category });
          }
        }
      } else {
        // Variant A: flat section = single entry
        collected.push(section);
      }
    }
    rawEntries = collected;
  } else {
    // MiMo flat-keys layout: collect category arrays into a unified entries list
    const categoryKeys = ["summary", "work", "project", "education", "credential", "other_needs_review"];
    const collected: unknown[] = [];

    for (const key of categoryKeys) {
      const value = data[key];
      if (Array.isArray(value)) {
        // work/education/project → array of entries
        for (const item of value) {
          if (isRecord(item)) {
            collected.push({ ...item, section: item.section ?? key });
          }
        }
      } else if (typeof value === "string" && key === "summary") {
        // summary → single string, wrap into an entry
        collected.push({ section: "summary", title: "个人优势", bullets: [value] });
      }
    }

    if (collected.length > 0) {
      rawEntries = collected;
    }
  }

  if (!rawEntries) return data;

  // --- resolve personalInfo ---
  let personalInfo: Record<string, unknown>;

  if (isRecord(data.personalInfo)) {
    personalInfo = { ...data.personalInfo };
  } else {
    // MiMo: personal_info is a top-level object or a section entry
    personalInfo = {};

    // Check top-level `personal_info` key first
    if (isRecord(data.personal_info)) {
      const p = data.personal_info;
      const content = isRecord(p.content) ? p.content : p;
      for (const field of ["name", "phone", "email", "location", "github", "portfolio"]) {
        if (isString(content[field])) personalInfo[field] = content[field];
      }
    }

    // Also check if personal_info exists as an entry in rawEntries
    if (!personalInfo.name) {
      const personalEntry = rawEntries.find(
        (e: unknown) => isRecord(e) && ((e.type ?? e.section) === "personal_info")
      );
      if (personalEntry) {
        const p = personalEntry as Record<string, unknown>;
        const content = isRecord(p.content) ? p.content : p;
        for (const field of ["name", "phone", "email", "location", "github", "portfolio"]) {
          if (!personalInfo[field] && isString(content[field])) personalInfo[field] = content[field];
        }
      }
    }

    // Fallback: top-level name field
    if (!personalInfo.name && isString(data.name)) personalInfo.name = data.name;
  }

  // Filter out personal_info entries — they're already extracted into personalInfo above
  const entries = rawEntries
    .filter((entry: unknown) => {
      if (!isRecord(entry)) return true;
      const entryType = entry.type ?? entry.section;
      return entryType !== "personal_info";
    })
    .map((entry: unknown, index: number) => normalizeModelCalibrationEntry(entry, index));

  // Populate educationSummary from education entries if missing
  if (!personalInfo.educationSummary) {
    const educationEntries = entries.filter((e) => e.section === "education");
    if (educationEntries.length > 0) {
      personalInfo.educationSummary = educationEntries
        .map((e) => [e.title, e.dateRange].filter(Boolean).join(" "))
        .join(" | ")
        .replace(/[（(][）)]/g, "")
        .trim();
    }
  }

  return {
    status: isCalibrationStatus(data.status) ? data.status : "needs_review",
    personalInfo,
    entries,
    unclassifiedText: Array.isArray(data.unclassifiedText) ? data.unclassifiedText.filter(isString) : [],
    parseWarnings: Array.isArray(data.parseWarnings) ? data.parseWarnings.filter(isString) : [],
    modelNotes: Array.isArray(data.modelNotes) ? data.modelNotes.filter(isString) : []
  };
}

/**
 * Normalize a single calibration entry.
 *
 * Handles field aliases from different model output styles:
 *  - `type` / `category` → `section`
 *  - `dates` / `startDate`+`endDate` → `dateRange`
 *  - `company` / `institution` → `title` (for work/education)
 *  - `position` → `role`
 *  - `responsibilities` / `content` (array) → `bullets`
 */
function normalizeModelCalibrationEntry(entry: unknown, index: number) {
  const record = isRecord(entry) ? entry : {};

  // --- bullets: array, string, or MiMo `responsibilities` / `content` / `description` ---
  const bullets = Array.isArray(record.bullets)
    ? record.bullets.filter(isString)
    : typeof record.bullets === "string"
      ? splitBullets(record.bullets)
      : Array.isArray(record.responsibilities)
        ? record.responsibilities.filter(isString)
        : Array.isArray(record.content)
          ? record.content.filter(isString)
          : isString(record.description) && record.description.trim()
            ? splitBullets(record.description)
            : [];

  // --- title: standard `title`, MiMo `company`/`institution`, Gemini `school` ---
  const rawTitle = isString(record.title) && record.title.trim()
    ? record.title.trim()
    : isString(record.company) && record.company.trim()
      ? record.company.trim()
      : isString(record.institution) && record.institution.trim()
        ? record.institution.trim()
        : isString(record.school) && record.school.trim()
          ? record.school.trim()
          : `简历条目 ${index + 1}`;
  const title = rawTitle.replace(/[（(][）)]/g, "").trim();

  // --- dateRange: standard, `dates`, `duration`, `date`, `startDate`+`endDate`, `start_time`+`end_time`, `start_date`+`end_date` ---
  const dateRange = isString(record.dateRange) && record.dateRange.trim()
    ? record.dateRange
    : isString(record.dates) && record.dates.trim()
      ? record.dates
      : isString(record.duration) && record.duration.trim()
        ? record.duration
        : isString(record.date) && record.date.trim()
          ? record.date
          : (isString(record.startDate) || isString(record.endDate))
            ? [record.startDate ?? "?", record.endDate ?? "至今"].join(" - ")
            : (isString(record.start_time) || isString(record.end_time))
              ? [record.start_time ?? "?", record.end_time ?? "至今"].join(" - ")
              : (isString(record.start_date) || isString(record.end_date))
                ? [record.start_date ?? "?", record.end_date ?? "至今"].join(" - ")
                : undefined;

  // --- role: standard `role`, MiMo `position`, `degree` (education) ---
  const role = isString(record.role) && record.role.trim()
    ? record.role
    : isString(record.position) && record.position.trim()
      ? record.position
      : isString(record.degree) && record.degree.trim()
        ? record.degree
        : undefined;

  // --- organization: standard `organization`, MiMo `major` (education) ---
  const organization = isString(record.organization) && record.organization.trim()
    ? record.organization
    : isString(record.major) && record.major.trim()
      ? record.major
      : undefined;

  const sourceText = isString(record.sourceText) && record.sourceText.trim()
    ? record.sourceText.trim()
    : [title, dateRange, ...bullets].filter(isString).join("\n");

  const id = isString(record.id) && record.id.trim() ? record.id.trim() : crypto.randomUUID();

  // --- section: standard `section`, MiMo `type`, or `category` ---
  const rawSectionValue = isString(record.section) ? record.section
    : isString(record.type) ? record.type
      : isString(record.category) ? record.category
        : undefined;
  const rawSection = rawSectionValue && isRawResumeSection(rawSectionValue) ? rawSectionValue : "other";
  const section = normalizeResumeEntrySection(rawSection);

  return {
    id,
    candidateId: id,
    section,
    sectionType: section,
    title,
    organization,
    role,
    dateRange,
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
      const title = stripDateRange(line).replace(/[（(][）)]/g, "").trim() || line;
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

  const normalizedEntries = normalizeCalibratedEntries(entries);

  const hasLowConfidence = normalizedEntries.some((entry) => entry.confidence === "low" || entry.issues.length > 0);
  const missingRequired = !personalInfo.name || !personalInfo.phone || !personalInfo.email || !normalizedEntries.some((entry) => entry.section === "education");

  // Populate educationSummary from collected education lines
  const educationSummary = normalizedEntries.filter((entry) => entry.section === "education").length > 0
    ? normalizedEntries
        .filter((entry) => entry.section === "education")
        .map(formatEducationSummary)
        .filter(Boolean)
        .join(" | ")
    : undefined;

  return {
    status: hasLowConfidence || missingRequired || parseWarnings.length > 0 ? "needs_review" : "confirmed",
    personalInfo: { ...personalInfo, educationSummary },
    entries: normalizedEntries,
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
    name: normalizeChineseName(lines.find((line) => /^[\u4e00-\u9fa5·\s]{2,24}$/.test(line))),
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
    "section 只能使用 summary、work、project、education、credential、personal_info、other_needs_review。",
    "summary 条目 title 必须是「个人优势」，优势正文全部放入 bullets，不要把第一条优势塞进 title。",
    "work 条目 title 和 organization 必须是公司/机构名称，role 必须是岗位名称，禁止把岗位名称放进公司字段。",
    "education 条目 title 必须是学校，role 必须是学历，organization 必须是专业，禁止把「学校 | 学历 | 专业」整行塞进 title。",
    "credential 只放证书、语言、技能，不要放入工作经历或项目经历。",
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

function normalizeCalibratedEntries(entries: CalibratedResumeEntry[]) {
  const normalized: CalibratedResumeEntry[] = [];
  let activeWorkOrganization: string | undefined;

  for (const rawEntry of entries) {
    const entry = normalizeCalibratedEntry(rawEntry);

    if (entry.section !== "work") {
      normalized.push(entry);
      continue;
    }

    const parsedWorkTitle = parseWorkTitle(entry.title);
    if (parsedWorkTitle) {
      entry.title = parsedWorkTitle.organization;
      entry.organization = entry.organization ?? parsedWorkTitle.organization;
      entry.role = entry.role ?? parsedWorkTitle.role;
    }

    const organization = entry.organization ?? (looksLikeOrganizationName(entry.title) ? entry.title : undefined);
    if (organization && !entry.role && entry.bullets.length === 0) {
      activeWorkOrganization = organization;
      continue;
    }

    if (!entry.organization && activeWorkOrganization && !looksLikeOrganizationName(entry.title)) {
      entry.organization = activeWorkOrganization;
      entry.role = entry.role ?? entry.title;
      entry.title = activeWorkOrganization;
    }

    if (entry.organization) {
      activeWorkOrganization = entry.organization;
    }

    normalized.push(entry);
  }

  return splitNestedProjectsFromWorkEntries(normalized);
}

function shouldPreferDeterministicCalibration(modelProfile: CalibratedResumeProfile, fallback: CalibratedResumeProfile) {
  const modelSummaryCount = modelProfile.entries.filter((entry) => entry.section === "summary").length;
  const fallbackSummaryCount = fallback.entries.filter((entry) => entry.section === "summary").length;
  const modelDatedCount = modelProfile.entries.filter((entry) => Boolean(entry.dateRange)).length;
  const fallbackDatedCount = fallback.entries.filter((entry) => Boolean(entry.dateRange)).length;
  const modelWorkCount = modelProfile.entries.filter((entry) => entry.section === "work").length;
  const fallbackWorkCount = fallback.entries.filter((entry) => entry.section === "work").length;

  if (fallbackSummaryCount > 0 && modelSummaryCount === 0) {
    return true;
  }

  if (fallbackDatedCount >= modelDatedCount + 3) {
    return true;
  }

  if (fallbackWorkCount >= modelWorkCount + 1 && fallbackWorkCount >= 3) {
    return true;
  }

  return false;
}

function normalizeCalibratedEntry(entry: CalibratedResumeEntry): CalibratedResumeEntry {
  const section = normalizeResumeEntrySection(entry.section);
  const normalized: CalibratedResumeEntry = {
    ...entry,
    section,
    sectionType: entry.sectionType ? normalizeResumeEntrySection(entry.sectionType) : section,
    bullets: joinWrappedResumeLines(entry.bullets)
  };

  if (section === "summary") {
    const summaryLines = normalized.title.trim() && normalized.title.trim() !== "个人优势"
      ? [normalized.title, ...normalized.bullets]
      : normalized.bullets;
    normalized.title = "个人优势";
    normalized.bullets = joinWrappedResumeLines(summaryLines);
    normalized.sourceText = [normalized.title, ...normalized.bullets].join("\n");
    normalized.rawText = normalized.sourceText;
    return normalized;
  }

  if (section === "education") {
    const parsedEducation = parseEducationTitle(normalized.title);
    if (parsedEducation) {
      normalized.title = parsedEducation.school;
      normalized.role = normalized.role ?? parsedEducation.degree;
      normalized.organization = normalized.organization ?? parsedEducation.major;
    }
  }

  return normalized;
}

function parseEducationTitle(title: string) {
  const parts = stripDateRange(title)
    .replace(/[（(][）)]/g, "")
    .split(/[|｜]/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) return null;
  return {
    school: parts[0],
    degree: parts[1],
    major: parts.slice(2).join(" | ")
  };
}

function parseWorkTitle(title: string) {
  const cleanTitle = stripDateRange(title).replace(/[（(][）)]/g, "").trim();
  const parts = cleanTitle
    .split(/\s+[—–-]\s+|[|｜]/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2 || !looksLikeOrganizationName(parts[0])) return null;
  return {
    organization: parts[0],
    role: parts.slice(1).join(" / ")
  };
}

function looksLikeOrganizationName(value: string) {
  return /(公司|银行|集团|分行|支行|科技|网络|中心|机构|研究院|事业部|学校|学院|有限公司|股份有限公司)/u.test(value);
}

function joinWrappedResumeLines(lines: string[]) {
  const merged: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const previous = merged.at(-1);
    if (previous && shouldMergeWrappedLine(previous, line)) {
      merged[merged.length - 1] = `${previous}${needsSpaceBetween(previous, line) ? " " : ""}${line}`;
    } else {
      merged.push(line);
    }
  }

  return merged;
}

function shouldMergeWrappedLine(previous: string, next: string) {
  if (/[。！？；;.!?]$/u.test(previous)) return false;
  if (isStandaloneBulletHeading(previous)) return false;
  if (startsNewResumeBullet(next)) return false;
  return true;
}

function isStandaloneBulletHeading(line: string) {
  return /^(项目[一二三四五六七八九十]|经历[一二三四五六七八九十])[:：]/u.test(line);
}

function startsNewResumeBullet(line: string) {
  return /^(项目[一二三四五六七八九十]|成果|负责|基于|内嵌|设计|同步|独立|构建|协助|面向|担任|执行|运用|参与|兼任|产品\s*0|AI\s*Agent|一线业务|懂技术|通过|主导|推动|优化|制定|输出|定义)/iu.test(line);
}

function needsSpaceBetween(previous: string, next: string) {
  return /[A-Za-z0-9]$/u.test(previous) && /^[A-Za-z0-9]/u.test(next);
}

function formatEducationSummary(entry: CalibratedResumeEntry) {
  return [entry.title, entry.role, entry.organization, entry.dateRange].filter(Boolean).join(" ");
}

function splitNestedProjectsFromWorkEntries(entries: CalibratedResumeEntry[]) {
  const result: CalibratedResumeEntry[] = [];

  for (const entry of entries) {
    if (entry.section !== "work") {
      result.push(entry);
      continue;
    }

    const { workBullets, projects } = extractNestedProjects(entry);
    result.push({
      ...entry,
      bullets: workBullets,
      sourceText: [entry.title, entry.role, entry.dateRange, ...workBullets].filter(Boolean).join("\n"),
      rawText: [entry.title, entry.role, entry.dateRange, ...workBullets].filter(Boolean).join("\n")
    });
    result.push(...projects);
  }

  return result;
}

function extractNestedProjects(entry: CalibratedResumeEntry) {
  const workBullets: string[] = [];
  const projects: CalibratedResumeEntry[] = [];
  let currentProject: CalibratedResumeEntry | null = null;

  for (const bullet of entry.bullets) {
    const projectTitle = extractNestedProjectTitle(bullet);

    if (projectTitle) {
      if (currentProject) {
        projects.push(currentProject);
      }

      currentProject = {
        id: crypto.randomUUID(),
        candidateId: "",
        section: "project",
        sectionType: "project",
        title: projectTitle,
        organization: entry.organization ?? entry.title,
        role: entry.role,
        dateRange: entry.dateRange,
        bullets: [],
        sourceText: bullet,
        rawText: bullet,
        confidence: entry.confidence,
        issues: entry.issues
      };
      currentProject.candidateId = currentProject.id;
      continue;
    }

    if (currentProject) {
      currentProject.bullets.push(bullet);
      currentProject.sourceText = `${currentProject.sourceText}\n${bullet}`;
      currentProject.rawText = currentProject.sourceText;
    } else {
      workBullets.push(bullet);
    }
  }

  if (currentProject) {
    projects.push(currentProject);
  }

  return { workBullets, projects };
}

function extractNestedProjectTitle(line: string) {
  const match = line.match(/^项目[一二三四五六七八九十\d]+[:：]\s*(.+)$/u);
  return match?.[1]?.trim() || null;
}
