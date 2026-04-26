import { readFile } from "node:fs/promises";
import type { ResumeDocument, ResumeDocumentEntryItem, ResumeDocumentItem } from "@/lib/document/resume-document";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";

type ParsedResumeEntry = {
  heading: string;
  meta?: string;
  subheading?: string;
  summary?: string;
  bullets?: string[];
};

type SnapshotSuggestion = PersistedWorkspaceDraft["suggestions"][number];

type RoleContext = {
  targetTitle: string;
  jdText: string;
};

export async function composeSnapshotDocument(draft: PersistedWorkspaceDraft): Promise<ResumeDocument> {
  const suggestions = draft.suggestions ?? [];
  const acceptedSuggestions = suggestions.filter((suggestion) => suggestion.status === "accepted");
  const selectedSuggestions = acceptedSuggestions.length > 0 ? acceptedSuggestions : suggestions.slice(0, 4);
  const resumeText = draft.resumeExtractedText ?? "";
  const resumeSignals = extractResumeSignals(resumeText);
  const resumeSections = extractResumeSections(resumeText);
  const jdText = await readDraftJdText(draft);
  const targetTitle = resolveTargetTitle(draft, jdText);
  const roleContext = { targetTitle, jdText };

  return {
    templateKey: "professional-cn",
    header: {
      name: resumeSignals.name,
      title: targetTitle,
      meta: [],
      contacts: resumeSignals.contacts
    },
    sections: [
      {
        id: "personal-info",
        title: "个人信息",
        tone: "hero",
        items: buildPersonalInfoItems(targetTitle, resumeSignals, resumeSections)
      },
      {
        id: "personal-strengths",
        title: "个人优势",
        tone: "standard",
        items: buildStrengthItems(draft, selectedSuggestions)
      },
      {
        id: "work-experience",
        title: "工作经历",
        items: buildWorkExperienceItems(draft, roleContext, resumeSections, selectedSuggestions)
      },
      {
        id: "project-experience",
        title: "项目经历",
        items: buildProjectItems(draft, roleContext, resumeSections, selectedSuggestions)
      },
      {
        id: "education",
        title: "教育背景",
        tone: "muted",
        items: buildEducationItems(draft, resumeSections)
      }
    ]
  };
}

function buildPersonalInfoItems(
  targetTitle: string,
  resumeSignals: ReturnType<typeof extractResumeSignals>,
  resumeSections: ReturnType<typeof extractResumeSections>
) {
  const education = formatEducationSummary(resumeSections.education[0]);
  const items = [
    `手机：${resumeSignals.phone ?? "未填写"}`,
    `邮箱：${resumeSignals.email ?? "未填写"} ｜ 求职意向：${targetTitle}`,
    `学历：${education ?? "未填写"}`,
    `居住地：${resumeSignals.location ?? "未填写"}`,
    `GitHub：${resumeSignals.github ?? "未填写"}`,
    `作品集：${resumeSignals.portfolio ?? "未填写"}`
  ];

  return toTextItems(items);
}

function buildStrengthItems(draft: PersistedWorkspaceDraft, suggestions: PersistedWorkspaceDraft["suggestions"] = []) {
  const strengths = (draft.analysis?.strengths ?? []).filter(isResumeReadyChineseLine);
  const acceptedStrengths = suggestions
    .filter((suggestion) => isSuggestionForSection(suggestion, ["summary"]))
    .flatMap((suggestion) => splitStrengthText(suggestion.afterText))
    .filter(Boolean);
  const items = [...acceptedStrengths, ...strengths].map((item) => trimTextForResume(item, 72)).filter(isNonEmptyString);

  if (draft.talentProfileUsed?.confidenceNote) {
    const note = trimSentence(draft.talentProfileUsed.confidenceNote);
    if (isResumeReadyChineseLine(note)) {
      items.push(note);
    }
  }

  if (draft.talentProfileUsed?.headline) {
    const headline = trimSentence(draft.talentProfileUsed.headline);
    if (isResumeReadyChineseLine(headline)) {
      items.unshift(headline);
    }
  }

  if (draft.careerDirectionUsed?.rationale) {
    const rationale = trimSentence(draft.careerDirectionUsed.rationale);
    if (isResumeReadyChineseLine(rationale)) {
      items.push(rationale);
    }
  }

  return toTextItems(dedupeItems(items).slice(0, 3));
}

function buildExperienceSectionItems(
  suggestions: PersistedWorkspaceDraft["suggestions"],
  targetSections: Array<PersistedWorkspaceDraft["suggestions"][number]["section"]>,
  fallbackText?: string
) {
  const items = suggestions
    .filter((suggestion) => isSuggestionForSection(suggestion, targetSections))
    .map((suggestion) => suggestion.afterText.trim())
    .filter(Boolean);

  if (items.length > 0) {
    return toTextItems(dedupeItems(items).slice(0, 3));
  }

  if (fallbackText) {
    return toTextItems([fallbackText]);
  }

  return toTextItems(["请继续补充这一部分，让简历结构更完整。"]);
}

function buildWorkExperienceItems(
  draft: PersistedWorkspaceDraft,
  roleContext: RoleContext,
  resumeSections: ReturnType<typeof extractResumeSections>,
  suggestions: PersistedWorkspaceDraft["suggestions"]
) {
  const rawWorkEntries = extractRawSectionEntries(draft.resumeExtractedText ?? "", "work");
  const items = dedupeEntries([
    ...rawWorkEntries,
    ...resumeSections.work.filter((entry) => !isGenericWorkEntry(entry)),
    ...suggestions
      .filter((suggestion) => isSuggestionForSection(suggestion, ["experience"]) && !isInternshipLike(suggestion.afterText))
      .map((suggestion) => createSuggestionEntry(suggestion))
      .filter((entry) => !isGenericWorkEntry(entry))
  ])
    .sort((a, b) => scoreEntryForRole(b, roleContext) - scoreEntryForRole(a, roleContext))
    .map((entry, index) => compactEntryForOnePage(entry, roleContext, index, "work"));

  if (items.length > 0) {
    return items.slice(0, 3);
  }

  return buildExperienceSectionItems(
    suggestions,
    ["experience", "summary"],
    `请补充与 ${roleContext.targetTitle} 最相关的正式工作经历，优先写职责、结果和协作对象。`
  );
}

function buildProjectItems(
  draft: PersistedWorkspaceDraft,
  roleContext: RoleContext,
  resumeSections: ReturnType<typeof extractResumeSections>,
  suggestions: PersistedWorkspaceDraft["suggestions"]
) {
  const projectSuggestions = suggestions
    .filter((suggestion) => isSuggestionForSection(suggestion, ["project"]))
    .map((suggestion) => createSuggestionEntry(suggestion));
  const rewrittenProjectKeys = projectSuggestions.map((entry) => normalizeEntryHeadingKey(entry.heading));
  const uniqueResumeProjects = resumeSections.projects.filter(
    (entry) => !rewrittenProjectKeys.includes(normalizeEntryHeadingKey(entry.heading))
  );
  const factProjects = (draft.masterFactsUsed ?? [])
    .filter((fact) => fact.blockType === "project")
    .map((fact) => ({
      heading: fact.title,
      summary: fact.summary
    }));
  const items = dedupeEntries([...projectSuggestions, ...uniqueResumeProjects, ...factProjects]);

  if (items.length > 0) {
    return items
      .sort((a, b) => scoreEntryForRole(b, roleContext) - scoreEntryForRole(a, roleContext))
      .map((entry, index) => compactEntryForOnePage(entry, roleContext, index, "project"))
      .slice(0, 2);
  }

  return toTextItems(["请补充与你申请岗位最相关的项目经历，写清目标、动作和结果。"]);
}

function formatEducationSummary(entry?: ParsedResumeEntry) {
  if (!entry) {
    return "";
  }

  const degree = entry.subheading?.split("｜").map((item) => item.trim()).find((item) => isDegreeLike(item));
  return [entry.heading, degree].filter(Boolean).join(" · ");
}

function buildEducationItems(draft: PersistedWorkspaceDraft, resumeSections: ReturnType<typeof extractResumeSections>) {
  const rawEducationEntries = extractRawSectionEntries(draft.resumeExtractedText ?? "", "education");
  const items = dedupeEntries([
    ...rawEducationEntries,
    ...resumeSections.education,
    ...(draft.masterFactsUsed ?? [])
      .filter((fact) => fact.blockType === "education")
      .map((fact) => ({
        heading: fact.title,
        summary: fact.summary
      }))
  ]);

  if (items.length > 0) {
    return items.slice(0, 1);
  }

  return toTextItems(["请补充教育背景、专业、毕业时间或代表性课程。"]);
}

function buildCertificatesAndSkills(
  draft: PersistedWorkspaceDraft,
  resumeSections: ReturnType<typeof extractResumeSections>
) {
  const skillFacts = (draft.masterFactsUsed ?? [])
    .filter((fact) => fact.blockType === "skill" || fact.blockType === "certificate")
    .map((fact) => `${fact.title}：${fact.summary}`);
  const roleAnchors = [`目标岗位：${draft.jobTitle}`, `投递公司：${draft.company}`];
  const items = dedupeItems([...resumeSections.skills, ...skillFacts, ...roleAnchors]);

  return toTextItems(items.slice(0, 3));
}

function resolveTargetTitle(draft: PersistedWorkspaceDraft, jdText: string) {
  const inferredTitle = inferTargetTitleFromJd(jdText);
  const currentTitle = draft.jobTitle.trim();

  if (inferredTitle && isLikelyDefaultOrMismatchedTitle(currentTitle, jdText)) {
    return inferredTitle;
  }

  return currentTitle || inferredTitle || "目标岗位";
}

async function readDraftJdText(draft: PersistedWorkspaceDraft) {
  const assetPath = draft.jdAsset?.storagePath;
  if (!assetPath) {
    return draft.jdPreview ?? "";
  }

  try {
    return `${await readFile(assetPath, "utf-8")}\n${draft.jdPreview ?? ""}`.trim();
  } catch {
    return draft.jdPreview ?? "";
  }
}

function inferTargetTitleFromJd(jdText: string) {
  const normalized = jdText.replace(/\s+/g, " ").trim();

  const explicitTitle = normalized.match(/(?:岗位|职位|招聘岗位|应聘职位|目标岗位)[:：】\]]?\s*([\u4e00-\u9fa5A-Za-z0-9 /｜|+_-]{2,24})/)?.[1]?.trim();
  if (explicitTitle && !/^(职责|要求|资格|描述)$/u.test(explicitTitle)) {
    return explicitTitle.replace(/[【】\[\]]/g, "").trim();
  }

  if (/Prompt|提示词/i.test(normalized) && /(AI|模型|自动回复|对话|数据生成|数据标注)/i.test(normalized)) {
    return "AI Prompt 产品专员";
  }

  if (/(客户成功|customer success|onboarding|续约|客户经营)/i.test(normalized)) {
    return "客户成功经理";
  }

  if (/(AI 产品|生成式 AI|智能体|Agent|产品规划|需求分析)/i.test(normalized)) {
    return "AI 产品经理";
  }

  return "";
}

function isLikelyDefaultOrMismatchedTitle(title: string, jdText: string) {
  if (!title) {
    return true;
  }

  if (title === "客户成功经理" && /Prompt|自动回复|模型训练|数据生成|AI语言模型/i.test(jdText)) {
    return true;
  }

  return false;
}

function extractResumeSignals(resumeText: string) {
  const lines = getResumeContentLines(resumeText);
  const headerLines = getResumeHeaderLines(lines);
  const firstHeading = lines
    .map((line) => parseMarkdownHeading(line))
    .find((heading) => heading?.level === 1 && isResumeNameLike(heading.text));
  const firstNameLine = headerLines.concat(lines.slice(0, 8)).find((line) => isResumeNameLike(line));
  const normalized = normalizeCandidateName(firstHeading?.text ?? firstNameLine ?? "");
  const isChineseNameLike = isResumeNameLike(normalized);
  const isEnglishNameLike = /^[A-Za-z]+(?: [A-Za-z]+){0,2}$/.test(normalized);
  const email = headerLines
    .concat(lines)
    .map((line) => line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0])
    .find(Boolean);
  const phone = headerLines
    .concat(lines)
    .map((line) => line.replace(/\s+/g, "").match(/(?:\+?86)?(1[3-9]\d{9})/)?.[0]?.trim())
    .find(Boolean);
  const location = headerLines
    .map((line) => {
      const labeledMatch = line.match(/^(?:现居|地址|所在地|居住地)[:：]\s*(.+)$/i);
      if (labeledMatch) {
        return labeledMatch[1].trim();
      }

      return /^(?:北京|上海|深圳|广州|杭州|苏州|成都|武汉|南京)$/i.test(line) ? line.trim() : "";
    })
    .find(Boolean);
  const github = headerLines
    .find((line) => /github\.com|gitlab\.com|gitee\.com/i.test(line));
  const portfolio = headerLines.find((line) => /作品集|portfolio|blog|个人主页|demo|作品|https?:\/\//i.test(line));
  const normalizedGithub = github ? sanitizeHeaderValue(github) : undefined;
  const normalizedPortfolio = portfolio ? sanitizeHeaderValue(portfolio) : undefined;
  const contacts = dedupeItems([email ?? "", phone ?? "", normalizedGithub ?? "", normalizedPortfolio ?? "", location ?? ""]);

  if (isChineseNameLike || isEnglishNameLike) {
    return {
      name: normalized,
      email,
      phone,
      location,
      github: normalizedGithub,
      portfolio: normalizedPortfolio,
      contacts
    };
  }

  return {
    name: "OfferYou 用户",
    email,
    phone,
    location,
    github: normalizedGithub,
    portfolio: normalizedPortfolio,
    contacts
  };
}

function extractResumeSections(resumeText: string) {
  const lines = getResumeContentLines(resumeText);

  const sections = {
    work: [] as ParsedResumeEntry[],
    internship: [] as ParsedResumeEntry[],
    education: [] as ParsedResumeEntry[],
    projects: [] as ParsedResumeEntry[],
    skills: [] as string[]
  };

  let currentSection: keyof typeof sections | null = null;

  for (const rawLine of lines) {
    const markdownHeading = parseMarkdownHeading(rawLine);
    const headingText = markdownHeading ? cleanResumeLine(markdownHeading.text) : rawLine;

    if (markdownHeading?.level === 1 && isResumeNameLike(headingText)) {
      continue;
    }

    const heading = detectResumeHeading(headingText);
    if (heading) {
      currentSection = heading;
      continue;
    }

    const lineToProcess = markdownHeading ? headingText : rawLine;

    if (isMetaLine(lineToProcess)) {
      continue;
    }

    const isBulletContinuation = /^[•·▪\-–—]/.test(lineToProcess) || /^\d+[.)]\s+/.test(lineToProcess);
    const cleanedLine = cleanResumeLine(lineToProcess);

    if (currentSection && isBulletContinuation && currentSection !== "skills" && sections[currentSection].length > 0) {
      appendLineToLastEntry(sections[currentSection] as ParsedResumeEntry[], cleanedLine);
      continue;
    }

    if (currentSection) {
      if (currentSection !== "skills" && sections[currentSection].length > 0 && shouldAppendLineToLastEntry(currentSection, cleanedLine)) {
        appendLineToLastEntry(sections[currentSection] as ParsedResumeEntry[], cleanedLine);
        continue;
      }

      const formatted = formatResumeLineForSection(currentSection, cleanedLine);
      if (currentSection === "skills") {
        sections.skills.push(formatted as string);
      } else {
        sections[currentSection].push(formatted as ParsedResumeEntry);
      }
      continue;
    }

    const inferredSection = inferSectionFromLine(cleanedLine);
    if (inferredSection) {
      const formatted = formatResumeLineForSection(inferredSection, cleanedLine);
      if (inferredSection === "skills") {
        sections.skills.push(formatted as string);
      } else {
        sections[inferredSection].push(formatted as ParsedResumeEntry);
      }
    }
  }

  const looseWork = extractLooseEntriesFromSection(lines, "work");
  const looseEducation = extractLooseEntriesFromSection(lines, "education");
  const looseProjects = extractLooseEntriesFromSection(lines, "projects");

  if ((sections.work.length === 0 || sections.work.every((entry) => isGenericWorkEntry(entry))) && looseWork.length > 0) {
    sections.work = looseWork;
  }

  if ((sections.education.length === 0 || sections.education[0]?.heading === "教育经历") && looseEducation.length > 0) {
    sections.education = looseEducation;
  }

  if (sections.projects.length === 0 && looseProjects.length > 0) {
    sections.projects = looseProjects;
  }

  return {
    work: dedupeParsedEntries(sections.work).slice(0, 2),
    education: dedupeParsedEntries(sections.education).slice(0, 1),
    projects: dedupeParsedEntries(sections.projects).slice(0, 2),
    skills: dedupeItems(sections.skills).slice(0, 3)
  };
}

function getResumeContentLines(resumeText: string) {
  const rawLines = resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines[0] !== "---") {
    return rawLines;
  }

  const closingIndex = rawLines.findIndex((line, index) => index > 0 && line === "---");
  const startIndex = closingIndex >= 0 ? closingIndex + 1 : 1;
  return rawLines.slice(startIndex);
}

function getResumeHeaderLines(lines: string[]) {
  const headerLines: string[] = [];

  for (const line of lines) {
    const heading = parseMarkdownHeading(line);
    if (heading && heading.level >= 2) {
      break;
    }

    if (!heading && detectResumeHeading(line)) {
      break;
    }

    headerLines.push(line);
  }

  return headerLines;
}

function parseMarkdownHeading(line: string) {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (!match) {
    return null;
  }

  return {
    level: match[1].length,
    text: match[2].trim()
  };
}

function isResumeNameLike(text: string) {
  const normalized = normalizeCandidateName(text);
  if (!normalized) {
    return false;
  }

  if (/^(个人优势|工作经历|实习经历|教育经历|项目经历|技能|证书|简历|resume|curriculum vitae)$/i.test(normalized)) {
    return false;
  }

  return /^[\u4e00-\u9fa5·]{2,8}$/.test(normalized) || /^[A-Za-z]+(?: [A-Za-z]+){0,2}$/.test(normalized);
}

function detectResumeHeading(line: string): "work" | "internship" | "education" | "projects" | "skills" | null {
  const normalized = normalizeHeadingText(line);

  if (/^(工作经历|工作经验|professional experience|work experience|employment)$/.test(normalized)) {
    return "work";
  }

  if (/^(实习经历|internship|internship experience|intern experience)$/.test(normalized)) {
    return "internship";
  }

  if (/^(教育经历|教育背景|education|academic background)$/.test(normalized)) {
    return "education";
  }

  if (/^(项目经历|项目经验|projects|project experience)$/.test(normalized)) {
    return "projects";
  }

  if (/^(技能|专业技能|技能与证书|证书|技能证书|skills|certificates|licenses)$/.test(normalized)) {
    return "skills";
  }

  return null;
}

function inferSectionFromLine(line: string): "work" | "internship" | "education" | "projects" | "skills" | null {
  if (isEducationLike(line)) {
    return "education";
  }

  if (isInternshipLike(line)) {
    return "internship";
  }

  if (isProjectLike(line)) {
    return "projects";
  }

  if (isSkillLike(line)) {
    return "skills";
  }

  if (isWorkLike(line)) {
    return "work";
  }

  return null;
}

function isMetaLine(line: string) {
  return (
    /^\d{4}\/\d{1,2}\/\d{1,2}/.test(line) ||
    /^第\s*\d+\s*\/\s*\d+\s*[页⻚]/.test(line) ||
    /^file:\/\//i.test(line) ||
    /file:\/\/\/tmp\//i.test(line) ||
    /^(男|女)\s*[|｜]/.test(line) ||
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(line) ||
    /^(电话|手机|邮箱|微信|github|git|作品集|portfolio|blog|个人主页|location|地址)[:：]/i.test(line) ||
    /(https?:\/\/|github\.com|gitlab\.com|gitee\.com)/i.test(line)
  );
}

function isPortfolioLine(line: string) {
  return /(?:github|gitlab|gitee|作品集|portfolio|blog|个人主页|demo|作品|https?:\/\/)/i.test(line);
}

function cleanResumeLine(line: string) {
  return line.replace(/^[•·▪\-–—]+\s*/, "").replace(/^\d+[.)]\s+/, "").trim();
}

function normalizeCandidateName(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();

  if (/^[\u4e00-\u9fa5·](?:\s+[\u4e00-\u9fa5·]){1,7}$/u.test(trimmed)) {
    return trimmed.replace(/\s+/g, "");
  }

  return trimmed;
}

function normalizeHeadingText(text: string) {
  return text.toLowerCase().replace(/\s+/g, "");
}

function normalizeOcrResumeText(text: string) {
  return text
    .replace(/\$O&erYou\$/g, "OfferYou")
    .replace(/O\"erYou/g, "OfferYou")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldAppendLineToLastEntry(section: "work" | "internship" | "education" | "projects", line: string) {
  const { dateRange, rest } = extractDateRange(line);

  if (section === "education") {
    return Boolean(dateRange) && rest.trim().length === 0;
  }

  if (dateRange) {
    return false;
  }

  if (section === "work" || section === "internship") {
    const looksLikeNewWorkEntry = /^(.*?(?:公司|集团|科技|银行|分行|支行|studio|inc\.?|corp\.?|ltd\.?)).*(?:\d{4}|[%｜|])/i.test(line);
    return !looksLikeNewWorkEntry;
  }

  return !/(个人项目|项目|project|OfferYou|工作流|自媒体|内容运营)/i.test(line);
}

function formatResumeLineForSection(
  section: "work" | "internship" | "education" | "projects" | "skills",
  line: string
) {
  if (section === "work" || section === "internship") {
    return formatWorkLikeLine(line, section === "internship");
  }

  if (section === "education") {
    return formatEducationLine(line);
  }

  if (section === "skills") {
    return formatSkillLine(line);
  }

  return formatProjectLine(line);
}

function extractLooseEntriesFromSection(
  lines: string[],
  targetSection: "work" | "education" | "projects"
): ParsedResumeEntry[] {
  const entries: ParsedResumeEntry[] = [];
  let active = false;

  for (const rawLine of lines) {
    const heading = detectLooseResumeHeading(rawLine);
    if (heading) {
      active = heading === targetSection;
      continue;
    }

    if (!active || isMetaLine(rawLine)) {
      continue;
    }

    const cleanedLine = cleanResumeLine(rawLine);
    if (!cleanedLine) {
      continue;
    }

    if (entries.length > 0 && shouldAppendLineToLastEntry(targetSection, cleanedLine)) {
      appendLineToLastEntry(entries, cleanedLine);
      continue;
    }

    const formatted = formatResumeLineForSection(targetSection, cleanedLine);
    entries.push(formatted as ParsedResumeEntry);
  }

  return entries;
}

function extractRawSectionEntries(resumeText: string, targetSection: "work" | "education"): ParsedResumeEntry[] {
  const lines = getResumeContentLines(resumeText);
  const entries: ParsedResumeEntry[] = [];
  let active = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (isRawHeading(trimmed, targetSection)) {
      active = true;
      continue;
    }

    if (isAnyRawResumeHeading(trimmed)) {
      active = false;
      continue;
    }

    if (!active || isMetaLine(trimmed)) {
      continue;
    }

    const cleanedLine = cleanResumeLine(trimmed);
    if (!cleanedLine) {
      continue;
    }

    if (entries.length > 0 && shouldAppendLineToLastEntry(targetSection, cleanedLine)) {
      appendLineToLastEntry(entries, cleanedLine);
      continue;
    }

    entries.push(formatResumeLineForSection(targetSection, cleanedLine) as ParsedResumeEntry);
  }

  return entries;
}

function isRawHeading(line: string, targetSection: "work" | "education") {
  const patterns = {
    work: /^工\s*作\s*经\s*历$/u,
    education: /^教\s*育\s*经\s*历$/u
  };

  return patterns[targetSection].test(line);
}

function isAnyRawResumeHeading(line: string) {
  return /^(个\s*人\s*优\s*势|项\s*目\s*经\s*历|工\s*作\s*经\s*历|实\s*习\s*经\s*历|教\s*育\s*经\s*历|技\s*能\s*与\s*证\s*书)$/u.test(line);
}

function detectLooseResumeHeading(line: string): "work" | "internship" | "education" | "projects" | "skills" | null {
  const compact = normalizeHeadingText(line);

  if (/^工作经历$/u.test(compact)) return "work";
  if (/^实习经历$/u.test(compact)) return "internship";
  if (/^教育经历$/u.test(compact)) return "education";
  if (/^项目经历$/u.test(compact)) return "projects";
  if (/^(技能与证书|技能证书|专业技能|技能|证书)$/u.test(compact)) return "skills";

  return detectResumeHeading(line);
}

function formatWorkLikeLine(line: string, internship: boolean) {
  const { dateRange, rest } = extractDateRange(line);
  const normalizedRest = normalizeOcrResumeText(rest);
  const compactParts = normalizedRest
    .split(/[|｜%]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (compactParts.length >= 2 && !compactParts.some((part) => /(负责|协助|主导|参与|推进|优化|完成|制定|支持|推动|led|built|owned|managed|delivered)/i.test(part))) {
    return {
      heading: compactParts[0],
      subheading: compactParts[1],
      meta: dateRange || undefined,
      summary: compactParts.slice(2).join(" ｜ ") || undefined
    } satisfies ParsedResumeEntry;
  }
  const companyMatch = normalizedRest.match(
    /^(.*?(?:分行|支行|公司|集团|科技|信息|网络|咨询|传媒|教育|资本|银行|研究院|事务所|studio|inc\.?|corp\.?|ltd\.?|co\.?))(?:\s+|$)/i
  );
  const company = companyMatch?.[1]?.trim() ?? "";
  const remaining = company ? normalizedRest.slice(company.length).trim() : normalizedRest;
  const actionKeywordMatch = remaining.match(/(负责|协助|主导|参与|搭建|推进|优化|完成|制定|支持|推动|led|built|owned|managed|delivered)/i);
  const roleCandidate = actionKeywordMatch ? remaining.slice(0, actionKeywordMatch.index ?? 0).trim() : remaining;
  const detail = actionKeywordMatch ? remaining.slice(actionKeywordMatch.index ?? 0).trim() : "";
  const role = roleCandidate
    .replace(/^[%｜|·)）\s]+/g, "")
    .replace(/[｜|·%]+$/g, "")
    .trim()
    .replace(/\s+/g, "");
  const heading = company || (internship ? "相关实习单位" : "相关工作单位");
  const bullets = splitIntoBullets(detail);

  return {
    heading,
    subheading: role || (internship ? "实习岗位" : "相关岗位"),
    meta: dateRange || undefined,
    summary: bullets.shift() ?? (detail || undefined),
    bullets: bullets.length > 0 ? bullets : undefined
  } satisfies ParsedResumeEntry;
}

function formatEducationLine(line: string) {
  const { dateRange, rest } = extractDateRange(line);
  const normalizedRest = rest.replace(/\s+/g, " ").trim();
  const schoolMatch = normalizedRest.match(
    /^(.*?(?:大学|学院|学校|University|College|School|Institute))(?:\s+|$)/i
  );
  const school = schoolMatch?.[1]?.trim() ?? "";
  const remaining = school ? normalizedRest.slice(school.length).trim() : normalizedRest;
  const educationParts = remaining
    .split(/[|｜]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const degree =
    educationParts.find((part) => isDegreeLike(part)) ??
    remaining.match(/(本科|硕士|博士|研究生|大专|MBA|EMBA|Bachelor|Master|PhD)/i)?.[1]?.trim() ??
    "";
  const major =
    (educationParts.length > 1 ? educationParts.find((part) => part !== degree) : undefined) ??
    remaining.replace(degree, "").replace(/[|｜]/g, " ").trim();
  return {
    heading: school || "教育经历",
    subheading: [major, degree].filter(Boolean).join(" ｜ ") || undefined,
    meta: dateRange || undefined
  } satisfies ParsedResumeEntry;
}

function formatProjectLine(line: string) {
  const { dateRange, rest } = extractDateRange(line);
  const normalized = normalizeOcrResumeText(rest);
  const titleSource = normalized.replace(/^(?:个人项目|项目|Project)\s*[:：]\s*/i, "");
  const title = titleSource.split(/[，。:：]/)[0]?.trim() || "项目经历";
  const remainder = titleSource.slice(title.length).replace(/^[，。:：\s]+/, "").trim();
  const bullets = splitIntoBullets(remainder);

  return {
    heading: title,
    meta: dateRange || undefined,
    summary: (bullets.shift() ?? remainder) || undefined,
    bullets: bullets.length > 0 ? bullets : undefined
  } satisfies ParsedResumeEntry;
}

function formatSkillLine(line: string) {
  const normalized = line.replace(/[、,，/]/g, " · ").replace(/\s{2,}/g, " ").trim();
  return normalized || line;
}

function sanitizeHeaderValue(line: string) {
  return line.replace(/^(?:GitHub|GitLab|Gitee|作品集|Portfolio|Blog|个人主页|Demo|居住地|所在地|现居|地址)[:：]\s*/i, "").trim();
}

function isDegreeLike(value: string) {
  return /^(本科|硕士|博士|研究生|大专|MBA|EMBA|Bachelor|Master|PhD)$/i.test(value);
}

function extractDateRange(line: string) {
  const match = line.match(
    /((?:19|20)\d{2}(?:[./]\d{1,2})?(?:\s*(?:-|–|—|~|至|到)\s*(?:(?:19|20)\d{2}(?:[./]\d{1,2})?|至今|现在))?)/i
  );

  if (!match) {
    return {
      dateRange: "",
      rest: line
    };
  }

  const dateRange = match[1].replace(/\s+/g, "");
  const rest = `${line.slice(0, match.index ?? 0)} ${line.slice((match.index ?? 0) + match[1].length)}`.trim();

  return {
    dateRange,
    rest
  };
}

function isEducationLike(line: string) {
  return /(大学|学院|本科|硕士|博士|研究生|major|gpa|毕业|university|college|bachelor|master|phd)/i.test(line);
}

function isInternshipLike(line: string) {
  return /(实习|intern)/i.test(line);
}

function isProjectLike(line: string) {
  return /(项目|project|课题|产品上线|系统搭建|从0到1)/i.test(line);
}

function isSkillLike(line: string) {
  return /(技能|skill|证书|certificate|语言能力|sql|excel|python|figma|ppt|办公软件|英语|雅思|托福|cfa|pmp)/i.test(line);
}

function isWorkLike(line: string) {
  return /(有限公司|公司|集团|科技|职责|负责|搭建|推进|优化|增长|运营|lead|manager|coordinator|specialist)/i.test(line);
}

function trimSentence(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/[。.!?]+$/, "");
}

function dedupeItems(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function dedupeEntries(items: ParsedResumeEntry[]): ResumeDocumentEntryItem[] {
  const map = new Map<string, ParsedResumeEntry>();

  for (const item of items) {
    const key = [item.heading, item.subheading ?? "", item.meta ?? "", item.summary ?? ""].join("::");
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()].map((item) => toEntryItem(item));
}

function normalizeEntryHeadingKey(value: string) {
  const normalized = value
    .replace(/[|｜)）（()·\s_-]+/g, "")
    .replace(/个人项目|项目|产品/g, "")
    .toLowerCase();

  if (/offeryou/i.test(value) && /岗位定制|简历助手|求职辅助/.test(value)) {
    return "offeryou-resume-assistant";
  }

  return normalized.slice(0, 24);
}

function scoreEntryForRole(entry: ResumeDocumentEntryItem, roleContext: RoleContext) {
  const text = [entry.heading, entry.subheading, entry.summary, ...(entry.bullets ?? [])].join(" ");
  const normalized = text.toLowerCase();
  const jdText = roleContext.jdText.toLowerCase();
  const jobTitle = roleContext.targetTitle;
  let score = 0;

  if (/客户成功|customer success/i.test(jobTitle) && /(客户|customer|b\s*端|b端|服务|方案|推介|异议|onboarding|交付|培训|协作)/i.test(normalized)) {
    score += 4;
  }

  if (/(prompt|提示词|对话|模型|训练|数据生成|标注)/i.test(jdText) && /(prompt|提示词|对话|模型|训练|数据|ai|生成|标注|评测)/i.test(normalized)) {
    score += 4;
  }

  if (/(产品|需求|原型|用户|迭代|prd|流程|工作流|agent)/i.test(jdText) && /(产品|需求|原型|用户|迭代|prd|流程|工作流|agent|mvp)/i.test(normalized)) {
    score += 3;
  }

  if (/(产品|prompt|ai|需求|流程|sop|数据|分析|迭代)/i.test(normalized)) {
    score += 2;
  }

  if (entry.meta?.includes("至今") || entry.meta?.includes("2025")) {
    score += 1;
  }

  return score;
}

function compactEntryForOnePage(
  entry: ResumeDocumentEntryItem,
  roleContext: RoleContext,
  index: number,
  section: "work" | "project"
): ResumeDocumentEntryItem {
  const score = scoreEntryForRole(entry, roleContext);
  const isPrimary = index === 0;
  const maxSummaryLength = section === "project" ? (isPrimary ? 92 : 56) : (score >= 4 ? 82 : 48);
  const maxBullets = section === "project" ? (isPrimary ? 2 : 1) : score >= 4 ? 2 : score >= 2 ? 1 : 0;

  return {
    ...entry,
    summary: trimTextForResume(entry.summary, maxSummaryLength),
    bullets: (entry.bullets ?? [])
      .map((bullet) => trimTextForResume(bullet, score >= 4 ? 72 : 46))
      .filter(isNonEmptyString)
      .slice(0, maxBullets)
  };
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value);
}

function trimTextForResume(text: string | undefined, maxLength: number) {
  const cleaned = cleanGeneratedResumeText(text ?? "");
  if (!cleaned) {
    return undefined;
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const cutAt = Math.max(
    cleaned.lastIndexOf("，", maxLength),
    cleaned.lastIndexOf("；", maxLength),
    cleaned.lastIndexOf("、", maxLength),
    cleaned.lastIndexOf(" ", maxLength)
  );
  const safeEnd = cutAt >= Math.floor(maxLength * 0.55) ? cutAt : maxLength;
  return `${cleaned.slice(0, safeEnd).replace(/[，；、\s]+$/u, "")}…`;
}

function isSuggestionForSection(
  suggestion: PersistedWorkspaceDraft["suggestions"][number],
  targetSections: Array<PersistedWorkspaceDraft["suggestions"][number]["section"]>
) {
  return targetSections.includes(normalizeSuggestionSection(suggestion.section));
}

function normalizeSuggestionSection(section: string) {
  const normalized = section.toLowerCase().replace(/\s+/g, "");

  if (["summary", "personal", "个人优势", "个人概述", "自我评价"].includes(normalized)) {
    return "summary";
  }

  if (["experience", "work", "工作经历", "工作经验", "职业经历"].includes(normalized)) {
    return "experience";
  }

  if (["project", "projects", "项目经历", "项目经验"].includes(normalized)) {
    return "project";
  }

  return section;
}

function isGenericWorkEntry(entry: ParsedResumeEntry) {
  return ["相关工作单位", "相关岗位", "相关实习单位", "实习岗位"].includes(entry.heading) || ["相关岗位", "实习岗位"].includes(entry.subheading ?? "");
}

function dedupeParsedEntries(items: ParsedResumeEntry[]) {
  const map = new Map<string, ParsedResumeEntry>();

  for (const item of items) {
    const key = [item.heading, item.subheading ?? "", item.meta ?? "", item.summary ?? ""].join("::");
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

function toEntryItem(item: ParsedResumeEntry): ResumeDocumentEntryItem {
  return {
    type: "entry",
    heading: item.heading,
    subheading: item.subheading,
    meta: item.meta,
    summary: item.summary,
    bullets: item.bullets?.filter(Boolean)
  };
}

function toTextItems(items: string[]): ResumeDocumentItem[] {
  return items.map((item) => ({
    type: "text",
    text: item
  }));
}

function createSuggestionEntry(suggestion: SnapshotSuggestion): ParsedResumeEntry {
  const heading = deriveSuggestionEntryHeading(suggestion);
  const cleanedText = stripRedundantEntryHeading(heading, cleanGeneratedResumeText(suggestion.afterText));
  const bullets = splitIntoBullets(cleanedText);
  const summary = bullets.shift() ?? cleanedText;

  return {
    heading,
    summary,
    bullets: bullets.length > 0 ? bullets : undefined
  };
}

function stripRedundantEntryHeading(heading: string, text: string) {
  if (/OfferYou/i.test(heading)) {
    return text
      .replace(/^OfferYou\s*\)?\s*AI\s*岗位定制简历助手\s*（?个人(?:产品)?项目）?\s*(?:20\d{2}[./-]\d{1,2}\s*[-至到]\s*至今)?\s*/iu, "")
      .replace(/^OfferYou\s*[｜|]\s*AI\s*岗位定制简历助手\s*/iu, "")
      .trim();
  }

  return text;
}

function deriveSuggestionEntryHeading(suggestion: SnapshotSuggestion) {
  const source = cleanGeneratedResumeText([suggestion.beforeText, suggestion.afterText, suggestion.title].join(" "));

  if (/OfferYou|求职辅助|简历助手|岗位定制/i.test(source)) {
    return "OfferYou｜AI 岗位定制简历助手";
  }

  if (/自媒体|小红书|公众号|微博|内容运营/i.test(source)) {
    return "AI 工具自媒体内容运营";
  }

  if (/广发银行|B\s*端客户|信用卡|风控|客户异议/i.test(source)) {
    return "广发银行北京分行｜综合柜员岗";
  }

  if (/陕西怡阳|氧浓度|多变量|数据采集|数据工程/i.test(source)) {
    return "陕西怡阳医疗科技有限公司｜数据工程师";
  }

  const title = cleanGeneratedResumeText(suggestion.title).replace(/(?:改写|优化|建议)$/u, "").trim();
  return title && !/^(accepted|suggestion|ai)$/i.test(title) ? title : "岗位相关经历";
}

function splitIntoBullets(text: string) {
  return text
    .split(/[；;\n。]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function appendLineToLastEntry(entries: ParsedResumeEntry[], line: string) {
  const lastEntry = entries.at(-1);

  if (!lastEntry) {
    entries.push({
      heading: "经历补充",
      bullets: [line]
    });
    return;
  }

  const dateOnly = extractDateRange(line);
  if (dateOnly.dateRange && !dateOnly.rest.trim()) {
    lastEntry.meta = lastEntry.meta ?? dateOnly.dateRange;
    return;
  }

  if (!lastEntry.bullets) {
    lastEntry.bullets = [];
  }

  lastEntry.bullets.push(normalizeOcrResumeText(line));
}

function cleanGeneratedResumeText(text: string) {
  return normalizeOcrResumeText(text)
    .replace(/([产品项目])OfferYou/gu, "$1 OfferYou")
    .replace(/^围绕[^，。；]{2,48}[，。；]\s*/u, "")
    .replace(/^这段经历与目标\s*JD\s*相关性较弱，建议仅保留时间、机构和岗位信息，并用一句话点出可迁移能力[:：]\s*/iu, "")
    .replace(/，?强化这段经历与目标岗位职责之间的对应关系。?$/u, "")
    .replace(/，?让真实经历中的优势、动作和结果更容易被识别。?$/u, "")
    .replace(/，?保留原有事实基础并突出可迁移能力。?$/u, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitStrengthText(text: string) {
  const cleaned = cleanGeneratedResumeText(text);
  const withBreaks = cleaned.replace(
    /(产品理解|项目推进|协作沟通|事实意识|AI\s*产品实践者|跨角色统筹|数据驱动思维|内容运营能力)[:：]/gu,
    "\n$1："
  );

  return withBreaks
    .split(/[\n。；]+/u)
    .map((item) => item.trim())
    .filter((item) => isResumeReadyChineseLine(item) && item.length >= 8)
    .map((item) => item.replace(/^[，、；\s]+/u, ""));
}

function isResumeReadyChineseLine(text: string) {
  const cleaned = text.trim();
  if (!cleaned) {
    return false;
  }

  return /[\u4e00-\u9fa5]/u.test(cleaned);
}
