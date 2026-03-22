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

export async function composeSnapshotDocument(draft: PersistedWorkspaceDraft): Promise<ResumeDocument> {
  const acceptedSuggestions = draft.suggestions.filter((suggestion) => suggestion.status === "accepted");
  const selectedSuggestions = acceptedSuggestions.length > 0 ? acceptedSuggestions : draft.suggestions.slice(0, 4);
  const resumeSignals = extractResumeSignals(draft.resumeExtractedText);
  const resumeSections = extractResumeSections(draft.resumeExtractedText);
  const photo = await buildPhotoPayload(draft.profilePhotoAssetRef);

  return {
    templateKey: "template_a",
    header: {
      name: resumeSignals.name,
      title: draft.jobTitle,
      meta: buildHeaderMeta(draft),
      contacts: resumeSignals.contacts,
      photo
    },
    sections: [
      {
        id: "personal-strengths",
        title: "个人优势",
        tone: "hero",
        items: buildStrengthItems(draft)
      },
      {
        id: "work-experience",
        title: "工作经历",
        items: buildWorkExperienceItems(draft, resumeSections, selectedSuggestions)
      },
      {
        id: "internship-experience",
        title: "实习经历",
        items: buildInternshipItems(draft, resumeSections, selectedSuggestions)
      },
      {
        id: "project-experience",
        title: "项目经历",
        items: buildProjectItems(draft, resumeSections, selectedSuggestions)
      },
      {
        id: "education",
        title: "教育经历",
        tone: "muted",
        items: buildEducationItems(draft, resumeSections)
      },
      {
        id: "certificates-skills",
        title: "证书 / 技能",
        tone: "muted",
        items: buildCertificatesAndSkills(draft, resumeSections)
      }
    ]
  };
}

function buildHeaderMeta(draft: PersistedWorkspaceDraft) {
  const meta = [draft.company];

  if (draft.careerDirectionUsed?.label) {
    meta.push(draft.careerDirectionUsed.label);
  }

  if (draft.language) {
    meta.push(draft.language.toUpperCase());
  }

  return meta;
}

function buildStrengthItems(draft: PersistedWorkspaceDraft) {
  const items = [...draft.analysis.strengths];

  if (draft.talentProfileUsed?.confidenceNote) {
    items.push(trimSentence(draft.talentProfileUsed.confidenceNote));
  }

  if (draft.talentProfileUsed?.headline) {
    items.unshift(trimSentence(draft.talentProfileUsed.headline));
  }

  if (draft.careerDirectionUsed?.rationale) {
    items.push(trimSentence(draft.careerDirectionUsed.rationale));
  }

  return toTextItems(dedupeItems(items).slice(0, 4));
}

function buildExperienceSectionItems(
  suggestions: PersistedWorkspaceDraft["suggestions"],
  targetSections: Array<PersistedWorkspaceDraft["suggestions"][number]["section"]>,
  fallbackText?: string
) {
  const items = suggestions
    .filter((suggestion) => targetSections.includes(suggestion.section))
    .map((suggestion) => suggestion.afterText.trim())
    .filter(Boolean);

  if (items.length > 0) {
    return toTextItems(dedupeItems(items).slice(0, 6));
  }

  if (fallbackText) {
    return toTextItems([fallbackText]);
  }

  return toTextItems(["请继续补充这一部分，让简历结构更完整。"]);
}

function buildWorkExperienceItems(
  draft: PersistedWorkspaceDraft,
  resumeSections: ReturnType<typeof extractResumeSections>,
  suggestions: PersistedWorkspaceDraft["suggestions"]
) {
  const items = dedupeEntries([
    ...resumeSections.work,
    ...suggestions
      .filter((suggestion) => (suggestion.section === "experience" || suggestion.section === "summary") && !isInternshipLike(suggestion.afterText))
      .map((suggestion) => createSuggestionEntry(suggestion.afterText))
  ]);

  if (items.length > 0) {
    return items.slice(0, 4);
  }

  return buildExperienceSectionItems(
    suggestions,
    ["experience", "summary"],
    `请补充与 ${draft.jobTitle} 最相关的正式工作经历，优先写职责、结果和协作对象。`
  );
}

function buildInternshipItems(
  draft: PersistedWorkspaceDraft,
  resumeSections: ReturnType<typeof extractResumeSections>,
  suggestions: PersistedWorkspaceDraft["suggestions"]
) {
  const items = dedupeEntries([
    ...resumeSections.internship,
    ...suggestions.filter((suggestion) => isInternshipLike(suggestion.afterText)).map((suggestion) => createSuggestionEntry(suggestion.afterText))
  ]);

  if (items.length > 0) {
    return items.slice(0, 4);
  }

  return toTextItems([`如有相关实习经历，请补充公司、岗位、时间和最能说明能力的成果。`]);
}

function buildProjectItems(
  draft: PersistedWorkspaceDraft,
  resumeSections: ReturnType<typeof extractResumeSections>,
  suggestions: PersistedWorkspaceDraft["suggestions"]
) {
  const projectSuggestions = suggestions
    .filter((suggestion) => suggestion.section === "project")
    .map((suggestion) => createSuggestionEntry(suggestion.afterText));
  const factProjects = (draft.masterFactsUsed ?? [])
    .filter((fact) => fact.blockType === "project")
    .map((fact) => ({
      heading: fact.title,
      summary: fact.summary
    }));
  const items = dedupeEntries([...resumeSections.projects, ...projectSuggestions, ...factProjects]);

  if (items.length > 0) {
    return items.slice(0, 4);
  }

  return toTextItems(["请补充与你申请岗位最相关的项目经历，写清目标、动作和结果。"]);
}

function buildEducationItems(draft: PersistedWorkspaceDraft, resumeSections: ReturnType<typeof extractResumeSections>) {
  const items = dedupeEntries([
    ...resumeSections.education,
    ...(draft.masterFactsUsed ?? [])
      .filter((fact) => fact.blockType === "education")
      .map((fact) => ({
        heading: fact.title,
        summary: fact.summary
      }))
  ]);

  if (items.length > 0) {
    return items.slice(0, 3);
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

  return toTextItems(items.slice(0, 5));
}

function extractResumeSignals(resumeText: string) {
  const lines = resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0];
  const normalized = firstLine ? firstLine.replace(/\s+/g, " ").trim() : "";
  const isChineseNameLike = /^[\u4e00-\u9fa5·]{2,8}$/.test(normalized);
  const isEnglishNameLike = /^[A-Za-z]+(?: [A-Za-z]+){0,2}$/.test(normalized);
  const email = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = resumeText.match(/(?:\+?\d[\d\s-]{6,}\d)/)?.[0]?.replace(/\s+/g, " ").trim();
  const location = lines.find((line) => /(上海|北京|深圳|广州|杭州|苏州|成都|武汉|南京|remote|hybrid|onsite)/i.test(line));
  const contacts = dedupeItems([email ?? "", phone ?? "", location ?? ""]);

  if (isChineseNameLike || isEnglishNameLike) {
    return {
      name: normalized,
      contacts
    };
  }

  return {
    name: "OfferYou 用户",
    contacts
  };
}

function extractResumeSections(resumeText: string) {
  const lines = resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = {
    work: [] as ParsedResumeEntry[],
    internship: [] as ParsedResumeEntry[],
    education: [] as ParsedResumeEntry[],
    projects: [] as ParsedResumeEntry[],
    skills: [] as string[]
  };

  let currentSection: keyof typeof sections | null = null;

  for (const rawLine of lines) {
    const heading = detectResumeHeading(rawLine);
    if (heading) {
      currentSection = heading;
      continue;
    }

    if (isMetaLine(rawLine)) {
      continue;
    }

    const isBulletContinuation = /^[•·▪\-–—]/.test(rawLine);
    const cleanedLine = cleanResumeLine(rawLine);

    if (currentSection && isBulletContinuation && currentSection !== "skills") {
      appendLineToLastEntry(sections[currentSection] as ParsedResumeEntry[], cleanedLine);
      continue;
    }

    if (currentSection) {
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

  return {
    work: dedupeParsedEntries(sections.work).slice(0, 5),
    internship: dedupeParsedEntries(sections.internship).slice(0, 4),
    education: dedupeParsedEntries(sections.education).slice(0, 3),
    projects: dedupeParsedEntries(sections.projects).slice(0, 5),
    skills: dedupeItems(sections.skills).slice(0, 4)
  };
}

function detectResumeHeading(line: string): "work" | "internship" | "education" | "projects" | "skills" | null {
  const normalized = line.toLowerCase();

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

  if (/^(技能|专业技能|证书|技能证书|skills|certificates|licenses)$/.test(normalized)) {
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
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(line) || /^(电话|手机|邮箱|微信|location|地址)[:：]/i.test(line);
}

function cleanResumeLine(line: string) {
  return line.replace(/^[•·▪\-–—]+\s*/, "").replace(/^\d+[.)]\s+/, "").trim();
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

function formatWorkLikeLine(line: string, internship: boolean) {
  const { dateRange, rest } = extractDateRange(line);
  const normalizedRest = rest.replace(/\s+/g, " ").trim();
  const companyMatch = normalizedRest.match(
    /^(.*?(?:公司|集团|科技|信息|网络|咨询|传媒|教育|资本|银行|研究院|事务所|studio|inc\.?|corp\.?|ltd\.?|co\.?))(?:\s+|$)/i
  );
  const company = companyMatch?.[1]?.trim() ?? "";
  const remaining = company ? normalizedRest.slice(company.length).trim() : normalizedRest;
  const actionKeywordMatch = remaining.match(/(负责|协助|主导|参与|搭建|推进|优化|完成|制定|支持|推动|led|built|owned|managed|delivered)/i);
  const roleCandidate = actionKeywordMatch ? remaining.slice(0, actionKeywordMatch.index ?? 0).trim() : remaining;
  const detail = actionKeywordMatch ? remaining.slice(actionKeywordMatch.index ?? 0).trim() : "";
  const role = roleCandidate
    .replace(/[｜|·]+$/g, "")
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
  const degreeMatch = remaining.match(/(本科|硕士|博士|研究生|大专|MBA|EMBA|Bachelor|Master|PhD)/i);
  const degree = degreeMatch?.[1]?.trim() ?? "";
  const major = remaining.replace(degreeMatch?.[0] ?? "", "").trim();
  return {
    heading: school || "教育经历",
    subheading: [major, degree].filter(Boolean).join(" ｜ ") || undefined,
    meta: dateRange || undefined
  } satisfies ParsedResumeEntry;
}

function formatProjectLine(line: string) {
  const { dateRange, rest } = extractDateRange(line);
  const normalized = rest.replace(/\s+/g, " ").trim();
  const title = normalized.split(/[，。:：]/)[0]?.trim() || "项目经历";
  const remainder = normalized.slice(title.length).replace(/^[，。:：\s]+/, "").trim();
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
  return /(有限公司|公司|集团|科技|职责|负责|搭建|推进|优化|增长|运营|经理|专员|顾问|lead|manager|coordinator|specialist)/i.test(line);
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

function createSuggestionEntry(text: string): ParsedResumeEntry {
  const bullets = splitIntoBullets(text);
  const summary = bullets.shift() ?? text;

  return {
    heading: "定制化经历表达",
    summary,
    bullets: bullets.length > 0 ? bullets : undefined
  };
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

  if (!lastEntry.bullets) {
    lastEntry.bullets = [];
  }

  lastEntry.bullets.push(line);
}

async function buildPhotoPayload(profilePhotoAssetRef?: string) {
  if (!profilePhotoAssetRef) {
    return {
      mode: "placeholder" as const,
      label: "照片"
    };
  }

  try {
    const buffer = await readFile(profilePhotoAssetRef);
    const mimeType = inferPhotoMimeType(profilePhotoAssetRef);
    return {
      mode: "uploaded" as const,
      label: "照片",
      src: `data:${mimeType};base64,${buffer.toString("base64")}`
    };
  } catch {
    return {
      mode: "placeholder" as const,
      label: "照片"
    };
  }
}

function inferPhotoMimeType(filename: string) {
  const normalized = filename.toLowerCase();

  if (normalized.endsWith(".png")) {
    return "image/png";
  }

  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}
