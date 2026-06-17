import { 
  normalizeOcrResumeText, 
  cleanOriginalResumeText, 
  cleanGeneratedResumeText 
} from "@/lib/services/analysis/text-cleaner";
import { callModelJSON } from "@/lib/ai/model-gateway";
import { readFile } from "node:fs/promises";
import type { ResumeDocument, ResumeDocumentEntryItem, ResumeDocumentItem } from "@/lib/document/resume-document";
import type { PersistedWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import type {
  CalibratedResumeEntry,
  CalibratedResumeProfile
} from "@/lib/services/calibration/resume-calibration-types";

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
  const { suggestions = [] } = draft;

  // Filter to get only the 'effective' suggestions.
  // If an entry has multiple suggestions (e.g. original + revisions),
  // we should only consider the most recent one that isn't pending.
  const suggestionGroups = new Map<string, SnapshotSuggestion[]>();
  for (const s of suggestions) {
    const key = s.candidateId ? `${s.section}:${s.candidateId}` : `${s.section}:${s.title}`;
    if (!suggestionGroups.has(key)) suggestionGroups.set(key, []);
    suggestionGroups.get(key)!.push(s);
  }

  const selectedSuggestions: SnapshotSuggestion[] = [];
  for (const group of suggestionGroups.values()) {
    // Sort by revision round or created at if available, or just use the last one in the array
    // Our suggestions are usually appended, so the last one is the latest.
    const latestActedUpon = [...group].reverse().find(s => s.status !== "pending");
    if (latestActedUpon && latestActedUpon.status === "accepted") {
      selectedSuggestions.push(latestActedUpon);
    }
  }

  const resumeText = draft.resumeExtractedText ?? "";
  const calibratedResume = draft.calibratedResume;
  const calibratedData = calibratedResume ? buildResumeDataFromCalibratedResume(calibratedResume) : null;
  const resumeSignals = calibratedData?.signals ?? extractResumeSignals(resumeText);
  const resumeSections = calibratedData?.sections ?? extractResumeSections(resumeText);
  const jdText = await readDraftJdText(draft);
  const targetTitle = resolveTargetTitle(draft, jdText, resumeSignals.name);
  const roleContext = { targetTitle, jdText };
  const calibrationWarning =
    calibratedResume && calibratedResume.status !== "confirmed"
      ? "当前简历结构仍有低置信字段，建议确认后再投递。"
      : "";

  const sections: ResumeDocument["sections"] = [
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
      items: buildStrengthItems(draft, resumeSections, selectedSuggestions)
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
      items: buildEducationItems(draft, resumeSections, selectedSuggestions)
    }
  ];
  return {
    templateKey: "professional-cn",
    header: {
      name: resumeSignals.name,
      title: targetTitle,
      meta: calibrationWarning ? [calibrationWarning] : [],
      contacts: resumeSignals.contacts
    },
    sections
  };
}

function buildPersonalInfoItems(
  targetTitle: string,
  resumeSignals: ReturnType<typeof extractResumeSignals>,
  resumeSections: ReturnType<typeof extractResumeSections>
) {
  const education = formatHighestEducationSummary(resumeSections.education);
  const language = extractLanguageSummary(resumeSections.skills);
  const items = [
    resumeSignals.phone ? `手机：${resumeSignals.phone}` : "",
    resumeSignals.email && targetTitle
      ? `邮箱：${resumeSignals.email} ｜ 求职意向：${targetTitle}`
      : resumeSignals.email
        ? `邮箱：${resumeSignals.email}`
        : targetTitle
          ? `求职意向：${targetTitle}`
          : "",
    education ? `学历：${education}` : "",
    language ? `英语：${language}` : "",
    resumeSignals.location ? `居住地：${resumeSignals.location}` : "",
    resumeSignals.github ? `GitHub：${resumeSignals.github}` : "",
    resumeSignals.portfolio ? `作品集：${resumeSignals.portfolio}` : ""
  ].filter(Boolean);

  return toTextItems(items);
}

function buildStrengthItems(
  draft: PersistedWorkspaceDraft,
  resumeSections: ReturnType<typeof extractResumeSections>,
  suggestions: PersistedWorkspaceDraft["suggestions"] = []
) {
  // suggestions here is the 'selectedSuggestions' (filtered for accepted status)
  const acceptedStrengths = suggestions
    .filter((suggestion) => isSuggestionForSection(suggestion, ["summary"]))
    .flatMap((suggestion) => splitStrengthText(suggestion.afterText))
    .filter(Boolean);

  let resultLines: string[] = [];

  if (acceptedStrengths.length > 0) {
    resultLines = acceptedStrengths;
  } else {
    // If no suggestions were accepted, prioritize falling back to original resume summary
    const originalSummaryEntry = resumeSections.work.concat(resumeSections.projects).find(s => 
      s.heading.includes("个人优势") || 
      s.heading.includes("自我评价") || 
      s.heading.includes("个人总结")
    );
    
    if (resumeSections.summary.length > 0) {
      resultLines = resumeSections.summary;
    } else if (originalSummaryEntry && originalSummaryEntry.summary) {
      resultLines = splitStrengthText(originalSummaryEntry.summary, true);
    } else if (originalSummaryEntry && originalSummaryEntry.bullets && originalSummaryEntry.bullets.length > 0) {
      resultLines = originalSummaryEntry.bullets;
    } else {
      // Last resort: AI analysis strengths or extractive facts from the resume.
      resultLines = (draft.analysis?.strengths ?? []).filter(isResumeReadyChineseLine);
      if (resultLines.length === 0) {
        resultLines = deriveStrengthsFromResumeSections(resumeSections);
      }
    }
  }

  if (acceptedStrengths.length === 0) {
    resultLines = resultLines.filter(line => {
      const { dateRange } = extractDateRange(line);
      const hasCompanyIndicator = /有限公司|集团|银行|工作室|Studio|Inc\.|Corp\.|Ltd\./i.test(line);
      const hasProjectBrand = /OfferYou|岗位定制|简历助手/i.test(line);
      return !dateRange && !hasCompanyIndicator && !hasProjectBrand;
    });
  }

  // Add talent profile context if available
  if (draft.talentProfileUsed?.headline) {
    const headline = trimSentence(draft.talentProfileUsed.headline);
    if (isResumeReadyChineseLine(headline)) {
      resultLines.unshift(headline);
    }
  }

  return toTextItems(
    dedupeItems(resultLines)
      .map((item) => trimTextForResume(item, 500, true)) // Significantly increased limit to 500 characters and marked as original
      .filter(isNonEmptyString)
      .slice(0, 5) // Increased from 4 to 5 to capture more points if they exist
  );
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
  if (isResumeOnlyDraft(draft)) {
    return dedupeResumeOnlyEntries(resumeSections.work)
      .map(preserveOriginalEntryForResume);
  }

  const rawWorkEntries = draft.calibratedResume ? [] : extractRawSectionEntries(draft.resumeExtractedText ?? "", "work");
  const suggestionEntries = suggestions
    .filter((suggestion) => isSuggestionForSection(suggestion, ["experience"]) && !isInternshipLike(suggestion.afterText))
    .map((suggestion) => createSuggestionEntry(suggestion))
    .filter((entry) => !isGenericWorkEntry(entry))
    .filter((entry) => {
      // Guard: reject entries whose heading or body text is education/credential-like
      const heading = entry.heading ?? "";
      const body = `${entry.summary ?? ""}\n${(entry.bullets ?? []).join("\n")}`;
      if (isEducationOrCredentialLikeText(heading)) return false;
      if (isEducationOrCredentialLikeText(body) && !isWorkLikeText(body)) return false;
      return true;
    });
  const rewrittenWorkKeys = suggestionEntries.map((entry) => normalizeResumeEntryKey(entry));
  const uniqueResumeWork = resumeSections.work.filter(
    (entry) => !isGenericWorkEntry(entry) && !rewrittenWorkKeys.includes(normalizeResumeEntryKey(entry))
  );
  const uniqueRawWorkEntries = rawWorkEntries.filter(
    (entry) => !rewrittenWorkKeys.includes(normalizeResumeEntryKey(entry))
  );
  const items = dedupeEntries([
    ...suggestionEntries,
    ...uniqueRawWorkEntries,
    ...uniqueResumeWork,
  ])
    .sort((a, b) => {
      const internshipDelta = Number(isInternshipEntry(a)) - Number(isInternshipEntry(b));
      if (internshipDelta !== 0) {
        return internshipDelta;
      }

      return scoreEntryForRole(b, roleContext) - scoreEntryForRole(a, roleContext);
    })
    .map((entry, index) => compactEntryForOnePage(entry, roleContext, index, "work"));

  if (items.length > 0) {
    return items.slice(0, 3);
  }

  return buildExperienceSectionItems(
    suggestions,
    ["experience"],
    `请补充与 ${roleContext.targetTitle} 最相关的正式工作经历，优先写职责、结果和协作对象。`
  );
}

function buildProjectItems(
  draft: PersistedWorkspaceDraft,
  roleContext: RoleContext,
  resumeSections: ReturnType<typeof extractResumeSections>,
  suggestions: PersistedWorkspaceDraft["suggestions"]
) {
  if (isResumeOnlyDraft(draft)) {
    return dedupeResumeOnlyEntries(normalizeProjectEntries(resumeSections.projects))
      .map(preserveOriginalEntryForResume);
  }

  const projectSuggestions = suggestions
    .filter((suggestion) => isSuggestionForSection(suggestion, ["project"]))
    .map((suggestion) => createSuggestionEntry(suggestion))
    .filter((entry) => {
      const heading = entry.heading ?? "";
      const body = `${entry.summary ?? ""}\n${(entry.bullets ?? []).join("\n")}`;
      if (isEducationOrCredentialLikeText(heading)) return false;
      if (isEducationOrCredentialLikeText(body) && !isProjectLikeText(body)) return false;
      return true;
    });
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
  const items = dedupeEntries(normalizeProjectEntries([...projectSuggestions, ...uniqueResumeProjects, ...factProjects]));

  if (items.length > 0) {
    return items
      .sort((a, b) => scoreEntryForRole(b, roleContext) - scoreEntryForRole(a, roleContext))
      .map((entry, index) => compactEntryForOnePage(entry, roleContext, index, "project"))
      .slice(0, 3);
  }

  return toTextItems(["请补充与你申请岗位最相关的项目经历，写清目标、动作和结果。"]);
}

function normalizeProjectEntries(entries: ParsedResumeEntry[]): ParsedResumeEntry[] {
  const normalized: ParsedResumeEntry[] = [];

  for (const entry of entries) {
    const previous = normalized.at(-1);
    if (previous && isProjectBodyOnlyEntry(entry)) {
      appendProjectBodyToEntry(previous, entry);
      continue;
    }

    normalized.push(entry);
  }

  return normalized;
}

function isProjectBodyOnlyEntry(entry: ParsedResumeEntry) {
  if (entry.meta || entry.subheading) {
    return false;
  }

  const text = [entry.heading, entry.summary, ...(entry.bullets ?? [])].filter(Boolean).join(" ");
  return isSentenceLikeHeading(entry.heading) || /^(定义|输出|核心模块|关键|策划|验证|完成|独立|通过|基于|「Codex|\u300cCodex)/u.test(text);
}

function appendProjectBodyToEntry(target: ParsedResumeEntry, source: ParsedResumeEntry) {
  const lines = [source.heading, source.summary, ...(source.bullets ?? [])]
    .map((line) => cleanDisplayLine(line ?? ""))
    .filter(isDisplayableResumeLine);

  if (lines.length === 0) {
    return;
  }

  target.bullets = dedupeItems([...(target.bullets ?? []), ...lines]);
}

function mergeDateOnlyEducationEntries(entries: ParsedResumeEntry[]): ParsedResumeEntry[] {
  const merged: ParsedResumeEntry[] = [];

  for (const entry of entries) {
    const dateOnly = extractDateRange([entry.heading, entry.summary].filter(Boolean).join(" "));
    const previous = merged.at(-1);

    if (previous && dateOnly.dateRange && !dateOnly.rest.trim() && !entry.subheading && !entry.meta) {
      previous.meta = previous.meta ?? dateOnly.dateRange;
      continue;
    }

    merged.push(entry);
  }

  return merged;
}

function formatEducationSummary(entry?: ParsedResumeEntry) {
  if (!entry) {
    return "";
  }

  const parts = [entry.heading, entry.subheading ?? ""]
    .join(" ｜ ")
    .split(/[|｜·]/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const school = parts.find((item) => /大学|学院|学校|University|College|School|Institute/iu.test(item)) ?? entry.heading;
  const degree = parts.find((item) => isDegreeLike(item));
  return [school, degree].filter(Boolean).join(" · ");
}

function formatHighestEducationSummary(entries: ParsedResumeEntry[]) {
  const ranked = entries
    .map((entry, index) => ({
      entry,
      index,
      degreeRank: getDegreeRank(extractEducationDegree(entry)),
      dateRank: extractEducationEndYear(entry.meta)
    }))
    .sort((left, right) => {
      if (right.degreeRank !== left.degreeRank) return right.degreeRank - left.degreeRank;
      if (right.dateRank !== left.dateRank) return right.dateRank - left.dateRank;
      return left.index - right.index;
    });

  return formatEducationSummary(ranked[0]?.entry);
}

function buildEducationItems(
  draft: PersistedWorkspaceDraft,
  resumeSections: ReturnType<typeof extractResumeSections>,
  _suggestions: PersistedWorkspaceDraft["suggestions"] = []
) {
  const rawEducationEntries = draft.calibratedResume ? [] : extractRawSectionEntries(draft.resumeExtractedText ?? "", "education");
  const items = dedupeEntries(mergeDateOnlyEducationEntries([
    ...rawEducationEntries,
    ...resumeSections.education,
    ...(draft.masterFactsUsed ?? [])
      .filter((fact) => fact.blockType === "education")
      .map((fact) => ({
        heading: fact.title,
        summary: fact.summary
      }))
  ]));

  if (items.length > 0) {
    // Allow up to 2 education entries (e.g. bachelor + master)
    return items.slice(0, 2);
  }

  return toTextItems(["请补充教育背景、专业、毕业时间或代表性课程。"]);
}

function buildSupplementItems(
  draft: PersistedWorkspaceDraft,
  resumeSections: ReturnType<typeof extractResumeSections>,
  suggestions: PersistedWorkspaceDraft["suggestions"] = []
) {
  const acceptedSupplement = suggestions
    .filter((suggestion) => isSuggestionForSection(suggestion, ["supplement"]))
    .map((suggestion) => cleanGeneratedResumeText(suggestion.afterText));
  const skillFacts = (draft.masterFactsUsed ?? [])
    .filter((fact) => fact.blockType === "skill" || fact.blockType === "certificate")
    .map((fact) => `${fact.title}：${fact.summary}`);
  const importantLines = dedupeItems([...acceptedSupplement, ...resumeSections.skills, ...skillFacts])
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => /(英语|CET|六级|四级|雅思|托福|证书|PMP|CFA)/iu.test(line));

  return toTextItems(importantLines.slice(0, 1));
}

function extractLanguageSummary(lines: string[]) {
  const source = lines.join(" ");
  const hits = [
    source.match(/CET[-\s]?6|英语六级|六级/iu)?.[0],
    source.match(/CET[-\s]?4|英语四级|四级/iu)?.[0],
    source.match(/雅思\s*\d+(?:\.\d+)?|IELTS\s*\d+(?:\.\d+)?/iu)?.[0],
    source.match(/托福\s*\d+|TOEFL\s*\d+/iu)?.[0]
  ].filter(Boolean) as string[];

  return dedupeItems(hits.map((hit) => hit.replace(/英语/u, "").replace(/\s+/g, " ").trim())).join(" / ");
}

function buildResumeDataFromCalibratedResume(calibratedResume: CalibratedResumeProfile): {
  signals: ReturnType<typeof extractResumeSignals>;
  sections: ReturnType<typeof extractResumeSections>;
} {
  const sections = buildResumeSectionsFromCalibratedResume(calibratedResume);
  const personal = calibratedResume.personalInfo;
  const contacts = dedupeItems(
    [
      personal.phone ? `手机：${personal.phone}` : "",
      personal.email ? `邮箱：${personal.email}` : "",
      personal.location ? `居住地：${personal.location}` : "",
      personal.github ? `GitHub：${personal.github}` : "",
      personal.portfolio ? `作品集：${personal.portfolio}` : ""
    ].filter(Boolean)
  );

  const signals: ReturnType<typeof extractResumeSignals> = {
      name: personal.name ?? "OfferYou 用户",
      email: personal.email,
      phone: personal.phone,
      location: personal.location,
      github: personal.github,
      portfolio: personal.portfolio,
      contacts
  };

  return {
    signals,
    sections
  };
}

function buildResumeSectionsFromCalibratedResume(calibratedResume: CalibratedResumeProfile) {
  const sections: ReturnType<typeof extractResumeSections> = {
    summary: calibratedResume.entries
      .filter((entry) => entry.section === "summary")
      .flatMap((entry) => {
        const title = cleanResumeLine(entry.title);
        const lines = [
          isSummarySectionTitle(title) ? "" : title,
          ...(entry.bullets ?? [])
        ].map((line) => cleanResumeLine(line)).filter(Boolean);
        return lines;
      }),
    work: calibratedResume.entries
      .filter((entry) => entry.section === "work")
      .map((entry) => mapCalibratedEntryToParsedResumeEntry(entry, "work")),
    education: calibratedResume.entries
      .filter((entry) => entry.section === "education")
      .flatMap((entry) => splitCalibratedEducationEntry(entry)),
    projects: calibratedResume.entries
      .filter((entry) => entry.section === "project")
      .map((entry) => mapCalibratedEntryToParsedResumeEntry(entry, "project")),
    skills: calibratedResume.entries
      .filter((entry) => entry.section === "credential" || entry.section === "supplement")
      .flatMap((entry) => [entry.title, ...(entry.bullets ?? [])])
      .map((line) => cleanResumeLine(line))
      .filter(Boolean)
  };

  return repairLeakedWorkEntriesFromProjects({
    ...sections,
    work: dedupeParsedEntries(sections.work),
    education: dedupeParsedEntries(sections.education),
    projects: dedupeParsedEntries(sections.projects),
    summary: dedupeItems(sections.summary).slice(0, 5),
    skills: dedupeItems(sections.skills).slice(0, 3)
  });
}

function repairLeakedWorkEntriesFromProjects(sections: ReturnType<typeof extractResumeSections>) {
  const repairedProjects: ParsedResumeEntry[] = [];
  const recoveredWork: ParsedResumeEntry[] = [];
  const fallbackOrganization = inferLeakedWorkOrganization(sections.work);

  for (const project of sections.projects) {
    const nextProject: ParsedResumeEntry = {
      ...project,
      bullets: []
    };
    let activeLeakedWork: ParsedResumeEntry | null = null;
    const bulletFragments = (project.bullets ?? []).flatMap((bullet) => splitExplicitBulletSeparators(bullet));

    for (const fragment of bulletFragments) {
      const leaked = extractLeakedWorkMarker(fragment);

      if (leaked) {
        const before = cleanDisplayLine(fragment.slice(0, leaked.index));
        const after = cleanDisplayLine(fragment.slice(leaked.index + leaked.fullText.length));

        if (before) {
          nextProject.bullets?.push(before);
        }

        activeLeakedWork = {
          heading: fallbackOrganization || "相关工作单位",
          subheading: leaked.role,
          meta: leaked.dateRange,
          bullets: after ? [after] : []
        };
        continue;
      }

      if (activeLeakedWork) {
        activeLeakedWork.bullets = [...(activeLeakedWork.bullets ?? []), fragment];
      } else {
        nextProject.bullets?.push(fragment);
      }
    }

    if (activeLeakedWork) {
      recoveredWork.push(activeLeakedWork);
    }

    nextProject.bullets = nextProject.bullets?.filter(Boolean);
    repairedProjects.push(nextProject);
  }

  return {
    ...sections,
    work: dedupeParsedEntries([...sections.work, ...recoveredWork]),
    projects: repairedProjects
  };
}

function inferLeakedWorkOrganization(workEntries: ParsedResumeEntry[]) {
  return workEntries.find((entry) => /银行|分行|公司|集团/u.test(entry.heading))?.heading ?? "";
}

function extractLeakedWorkMarker(fragment: string) {
  const match = fragment.match(
    /(综合运营岗（管培生）|综合运营岗|管培生)[（(]\s*((?:19|20)\d{2}(?:[./]\d{1,2})?\s*[-–—至到]\s*(?:(?:19|20)\d{2}(?:[./]\d{1,2})?|至今|现在))\s*[）)]/u
  );

  if (!match || match.index === undefined) {
    return null;
  }

  return {
    index: match.index,
    fullText: match[0],
    role: match[1],
    dateRange: match[2].replace(/\s+/g, " ")
  };
}

function deriveStrengthsFromResumeSections(resumeSections: ReturnType<typeof extractResumeSections>) {
  const text = [
    ...resumeSections.work.flatMap((entry) => [entry.heading, entry.subheading, ...(entry.bullets ?? [])]),
    ...resumeSections.projects.flatMap((entry) => [entry.heading, entry.subheading, ...(entry.bullets ?? [])])
  ]
    .filter(Boolean)
    .join(" ");
  const strengths: string[] = [];

  if (/(AI|Agent|RAG|智能客服|智能助手|大模型|Prompt|MVP|PRD)/iu.test(text)) {
    strengths.push("AI 产品落地经验：围绕智能客服、员工业务助手或投研辅助智能体等项目，完成需求定义、方案设计与结果验证。");
  }

  if (/(数据|分析|Tableau|SQL|Python|预算|指标|可视化|报表)/iu.test(text)) {
    strengths.push("数据分析与业务理解：具备预算分析、业务数据处理或可视化经验，能把业务问题转化为可执行的产品和分析方案。");
  }

  if (/(银行|金融|反洗钱|AML|KYC|合规|客户|B\s*端|理财|信用卡)/iu.test(text)) {
    strengths.push("金融业务与合规意识：覆盖运营、客户服务、反洗钱或 KYC 等场景，理解金融产品落地中的合规和质量要求。");
  }

  return strengths;
}

function mapCalibratedEntryToParsedResumeEntry(
  entry: CalibratedResumeEntry,
  section: "work" | "project" | "education"
): ParsedResumeEntry {
  if (section === "education") {
    const schoolMatch = entry.title.match(/^(.*?(?:大学|学院|学校|University|College|School|Institute))/i);
    const school = schoolMatch?.[1]?.trim() ?? entry.title.trim();
    const remaining = schoolMatch ? entry.title.slice(schoolMatch[0].length).trim() : "";
    const educationParts = remaining
      .split(/[|｜\s]{2,}|[|｜]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const parsedDegree = educationParts.find((part) => isDegreeLike(part)) ?? educationParts[0] ?? "";
    const degree = (entry.role && isDegreeLike(entry.role) ? entry.role : "") || parsedDegree;
    const parsedMajor =
      educationParts.find((part) => part !== degree && !isDateLikeText(part)) ??
      educationParts.find((part) => /专业|major|方向/i.test(part)) ??
      "";
    const major =
      (entry.organization && !isDegreeLike(entry.organization) && !isDateLikeText(entry.organization) ? entry.organization : "") ||
      parsedMajor;

    return {
      heading: school || entry.title,
      subheading: [major, degree].filter(Boolean).join(" ｜ ") || undefined,
      meta: entry.dateRange,
    };
  }

  if (section === "project") {
    return {
      heading: entry.title.replace(/[（(][）)]/g, "").trim(),
      subheading: entry.organization || entry.role,
      meta: entry.dateRange,
      summary: undefined,
      bullets: entry.bullets.length > 0 ? entry.bullets : undefined
    };
  }

  return {
    heading: (entry.organization || entry.title).replace(/[（(][）)]/g, "").trim(),
    subheading: entry.role || undefined,
    meta: entry.dateRange,
    summary: undefined,
    bullets: entry.bullets.length > 0 ? entry.bullets : undefined
  };
}

function isSummarySectionTitle(value: string) {
  return /^(个人优势|个人概述|自我评价|个人总结|核心优势|优势档案)$/u.test(value.trim());
}

function splitCalibratedEducationEntry(entry: CalibratedResumeEntry): ParsedResumeEntry[] {
  const source = entry.sourceText || [entry.title, entry.dateRange ?? "", ...(entry.bullets ?? [])].join(" ");
  const segments = splitEducationLine(source);

  if (segments.length > 1) {
    return segments.map((segment) => formatEducationLine(segment));
  }

  return [mapCalibratedEntryToParsedResumeEntry(entry, "education")];
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

function resolveTargetTitle(draft: PersistedWorkspaceDraft, jdText: string, candidateName?: string) {
  const inferredTitle = inferTargetTitleFromJd(jdText);
  const currentTitle = draft.jobTitle.trim();
  const normalizedCandidateName = (candidateName ?? "").replace(/\s+/g, "");

  if (normalizedCandidateName && currentTitle.replace(/\s+/g, "") === normalizedCandidateName) {
    return inferredTitle;
  }

  if (inferredTitle && isLikelyDefaultOrMismatchedTitle(currentTitle, jdText)) {
    return inferredTitle;
  }

  return currentTitle || inferredTitle || "";
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
    summary: [] as string[],
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
      if (currentSection !== "skills" && currentSection !== "summary" && sections[currentSection].length > 0 && shouldAppendLineToLastEntry(currentSection, cleanedLine)) {
        appendLineToLastEntry(sections[currentSection] as ParsedResumeEntry[], cleanedLine);
        continue;
      }

      const formatted = formatResumeLineForSection(currentSection, cleanedLine);
      if (currentSection === "skills" || currentSection === "summary") {
        (sections[currentSection] as string[]).push(formatted as string);
      } else {
        (sections[currentSection] as ParsedResumeEntry[]).push(formatted as ParsedResumeEntry);
      }
      continue;
    }

    const inferredSection = inferSectionFromLine(cleanedLine);
    if (inferredSection) {
      const formatted = formatResumeLineForSection(inferredSection, cleanedLine);
      if (inferredSection === "skills") {
        (sections[inferredSection] as string[]).push(formatted as string);
      } else {
        (sections[inferredSection] as ParsedResumeEntry[]).push(formatted as ParsedResumeEntry);
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
    summary: dedupeItems(sections.summary).slice(0, 5),
    work: dedupeParsedEntries(sections.work).slice(0, 3),
    education: dedupeParsedEntries(sections.education).slice(0, 2),
    projects: dedupeParsedEntries(sections.projects).slice(0, 3),
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

function detectResumeHeading(line: string): "summary" | "work" | "internship" | "education" | "projects" | "skills" | null {
  const normalized = normalizeHeadingText(line);

  if (/^(个人优势|自我评价|个人总结|个人概述|核心优势|优势档案|summary|highlights)$/.test(normalized)) {
    return "summary";
  }

  if (/^(工作经历|工作经验|工作履历|任职经历|实习经历|职业经历|professionalexperience|workexperience|employment)$/.test(normalized)) {
    return "work";
  }

  if (/^(实习经历|实习经验|internship|internshipexperience|internexperience)$/.test(normalized)) {
    return "internship";
  }

  if (/^(教育经历|教育背景|学历背景|毕业院校|学习经历|教育信息|education|academicbackground)$/.test(normalized)) {
    return "education";
  }

  if (/^(项目经历|项目经验|个人项目|核心项目|代表项目|projects|projectexperience)$/.test(normalized)) {
    return "projects";
  }

  if (/^(技能|专业技能|核心技能|技能与证书|证书|技能证书|主要技能|语言能力|skills|certificates|licenses)$/.test(normalized)) {
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

// Use normalizeOcrResumeText from text-cleaner.ts

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
  section: "summary" | "work" | "internship" | "education" | "projects" | "skills",
  line: string
) {
  if (section === "summary") {
    return line.trim();
  }

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

    if (targetSection === "education") {
      const split = splitEducationLine(cleanedLine);
      if (split.length > 1) {
        entries.push(...split.map(s => formatEducationLine(s)));
        continue;
      }
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
  const normalized = line.replace(/\s+/g, "");
  const patterns = {
    work: /(工作经历|工作经验|职业经历|任职经历)/u,
    education: /(教育经历|教育背景|学历背景|学习经历)/u
  };

  return patterns[targetSection].test(normalized);
}

function isAnyRawResumeHeading(line: string) {
  const normalized = line.replace(/\s+/g, "");
  return /(个人优势|核心优势|优势档案|项目经历|个人项目|工作经历|职业经历|实习经历|教育经历|教育背景|学历背景|技能与证书|专业技能)/u.test(normalized);
}

function detectLooseResumeHeading(line: string): "work" | "internship" | "education" | "projects" | "skills" | null {
  const compact = normalizeHeadingText(line);

  if (/^工作经历$/u.test(compact)) return "work";
  if (/^实习经历$/u.test(compact)) return "internship";
  if (/^(?:教育经历|教育背景)$/u.test(compact)) return "education";
  if (/^项目经历$/u.test(compact)) return "projects";
  if (/^(技能与证书|技能证书|专业技能|技能|证书)$/u.test(compact)) return "skills";

  const heading = detectResumeHeading(line);
  return heading === "summary" ? null : heading;
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

function splitEducationLine(cleanedLine: string): string[] {
  const schoolSegmentMatches = Array.from(
    cleanedLine.matchAll(
      /[\u4e00-\u9fa5A-Za-z]+(?:大学|学院|学校|University|College|School|Institute)[\s\S]*?(?=[\u4e00-\u9fa5A-Za-z]+(?:大学|学院|学校|University|College|School|Institute)|$)/g
    )
  )
    .map((match) => match[0].trim().replace(/^[|｜\s]+|[|｜\s]+$/g, ""))
    .filter(Boolean);

  if (schoolSegmentMatches.length > 1) {
    return schoolSegmentMatches;
  }

  const schoolAnchors = ["大学", "学院", "学校", "University", "College", "School", "Institute"];
  const anchorRegex = new RegExp(schoolAnchors.join("|"), "g");
  const matches = Array.from(cleanedLine.matchAll(anchorRegex));
  
  if (matches.length <= 1) return [cleanedLine];

  const splitIndices: number[] = [];
  for (let i = 1; i < matches.length; i++) {
    const currentAnchorPos = matches[i].index || 0;
    const previousAnchorEnd = (matches[i - 1].index || 0) + matches[i - 1][0].length;
    
    const searchRange = cleanedLine.slice(previousAnchorEnd, currentAnchorPos);
    
    // Look for a pipe, multiple spaces, or a date range (strong separators)
    const strongMatch = searchRange.match(/([|｜]|\s{2,}|\d{4}[./]\d{2}\s*-\s*(?:\d{4}[./]\d{2}|至今)|\d{4}-\d{4})(?=[^|｜\s]*$)/);
    if (strongMatch) {
      splitIndices.push(previousAnchorEnd + (strongMatch.index ?? 0) + (strongMatch[1].length > 1 ? strongMatch[1].length - 1 : 0));
    } else {
      // Fallback: look for a single space that follows a known degree or a closing parenthesis
      const weakMatch = searchRange.match(/([\u4e00-\u9fa5]{2,}(?:硕士|学士|博士|本科|研究生|毕业|学位)|[)）]|\s)(?=\s[\u4e00-\u9fa5A-Z])/);
      if (weakMatch) {
        const weakIndex = weakMatch.index ?? 0;
        const spaceOffset = searchRange.slice(weakIndex).indexOf(" ");
        if (spaceOffset !== -1) {
          splitIndices.push(previousAnchorEnd + weakIndex + spaceOffset);
        }
      }
    }
  }

  if (splitIndices.length === 0) return [cleanedLine];

  const entries: string[] = [];
  let lastIdx = 0;
  for (const splitIdx of [...splitIndices, cleanedLine.length]) {
    const segment = cleanedLine.slice(lastIdx, splitIdx).trim().replace(/^[|｜\s]+|[|｜\s]+$/g, "");
    if (segment) {
      entries.push(segment);
    }
    lastIdx = splitIdx;
  }
  return entries;
}

function formatEducationLine(line: string) {
  const { dateRange, rest } = extractDateRange(line);
  const normalizedRest = rest.replace(/\s+/g, " ").trim();
  const schoolMatch = normalizedRest.match(
    /^(.*?(?:大学|学院|学校|University|College|School|Institute))(?:\s+|$)/i
  );
  const school = schoolMatch?.[1]?.trim() ?? "";
  const remaining = school ? normalizedRest.slice(normalizedRest.indexOf(school) + school.length).trim() : normalizedRest;
  const educationParts = remaining
    .split(/[|｜\s]{2,}|[|｜]/)
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

function extractEducationDegree(entry: ParsedResumeEntry | undefined) {
  if (!entry) return "";
  const source = [entry.subheading, entry.heading].filter(Boolean).join(" ｜ ");
  return source
    .split(/[|｜·\s]+/u)
    .map((part) => part.trim())
    .find((part) => isDegreeLike(part)) ?? "";
}

function getDegreeRank(value: string) {
  const normalized = value.trim().toLowerCase();
  if (/博士|phd/.test(normalized)) return 6;
  if (/硕士|研究生|master|mba|emba/.test(normalized)) return 5;
  if (/本科|bachelor/.test(normalized)) return 4;
  if (/大专/.test(normalized)) return 3;
  return 0;
}

function extractEducationEndYear(value: string | undefined) {
  if (!value) return 0;
  const years = value.match(/(?:19|20)\d{2}/g)?.map((year) => Number(year)) ?? [];
  return years.length > 0 ? Math.max(...years) : 0;
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
  const normalized = line.toLowerCase();
  // Education lines should usually have a school indicator AND (a degree OR a major OR a date)
  const hasSchool = /(大学|学院|学校|university|college|school|institute)/i.test(normalized);
  const hasDegreeOrMajor = /(本科|硕士|博士|研究生|大专|毕业|major|gpa|bachelor|master|phd)/i.test(normalized);
  const { dateRange } = extractDateRange(line);

  return hasSchool && (hasDegreeOrMajor || Boolean(dateRange));
}

function isInternshipLike(line: string) {
  return /(实习|intern)/i.test(line);
}

function isInternshipEntry(entry: ParsedResumeEntry) {
  return isInternshipLike([entry.heading, entry.subheading, entry.summary, ...(entry.bullets ?? [])].join(" "));
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
    const key = normalizeEntryHeadingKey(item.heading);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()].map((item) => toEntryItem(item));
}

function dedupeResumeOnlyEntries(items: ParsedResumeEntry[]): ResumeDocumentEntryItem[] {
  const map = new Map<string, ParsedResumeEntry>();

  for (const item of items) {
    const key = [item.heading, item.subheading ?? "", item.meta ?? "", item.summary ?? ""]
      .join("::")
      .replace(/\s+/g, "");
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

function normalizeResumeEntryKey(entry: Pick<ParsedResumeEntry, "heading" | "subheading">) {
  return normalizeEntryHeadingKey([entry.heading, entry.subheading ?? ""].join(""));
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
  
  // Detect if this entry is from a suggestion (contains special markers or comes from the suggestion array)
  // Or if it's original (longer, has user styling)
  const isOriginal = !entry.summary?.includes("相关性较弱") && !entry.summary?.includes("改进建议");

  const maxSummaryLength = section === "project" ? (isPrimary ? 200 : 160) : (score >= 4 ? 140 : 80);
  const maxBullets = isOriginal ? 10 : (section === "project" ? (isPrimary ? 4 : 3) : score >= 4 ? 3 : score >= 2 ? 2 : 1);

  return {
    ...entry,
    heading: sanitizeHeading(entry.heading),
    summary: trimTextForResume(entry.summary, maxSummaryLength, isOriginal),
    bullets: (entry.bullets ?? [])
      .map((bullet) => trimTextForResume(bullet, score >= 4 ? 180 : 120, isOriginal))
      .filter(isNonEmptyString)
      .slice(0, maxBullets)
  };
}

function preserveOriginalEntryForResume(entry: ResumeDocumentEntryItem): ResumeDocumentEntryItem {
  return {
    ...entry,
    heading: sanitizeHeading(entry.heading),
    summary: cleanOriginalResumeText(entry.summary ?? "") || undefined,
    bullets: (entry.bullets ?? [])
      .map((bullet) => cleanOriginalResumeText(bullet))
      .filter(isNonEmptyString)
  };
}

function isResumeOnlyDraft(draft: PersistedWorkspaceDraft) {
  return Boolean(
    draft.calibratedResume &&
    !draft.company.trim() &&
    !draft.jdPreview.trim() &&
    draft.suggestions.length === 0
  );
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value);
}

function sanitizeHeading(heading: string) {
  return heading
    .replace(/\s*\)\s*/g, "｜") // Fix stray parentheses like 'OfferYou ) AI'
    .replace(/\s*%\s*/g, " ")
    .replace(/\s*[|｜]\s*/g, " ｜ ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimTextForResume(text: string | undefined, maxLength: number, isOriginal: boolean = false) {
  const cleaned = isOriginal ? cleanOriginalResumeText(text ?? "") : cleanGeneratedResumeText(text ?? "");
  if (!cleaned) {
    return undefined;
  }

  // If it's original content, be much more lenient with length to avoid mutilating user's work
  const effectiveMax = isOriginal ? maxLength * 1.5 : maxLength;

  if (cleaned.length <= effectiveMax) {
    return cleaned;
  }

  const cutAt = Math.max(
    cleaned.lastIndexOf("，", effectiveMax),
    cleaned.lastIndexOf("；", effectiveMax),
    cleaned.lastIndexOf("、", effectiveMax),
    cleaned.lastIndexOf(" ", effectiveMax)
  );
  const safeEnd = cutAt >= Math.floor(effectiveMax * 0.55) ? cutAt : effectiveMax;
  return cleaned.slice(0, safeEnd).replace(/[，；、\s]+$/u, "");
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

  if (["education", "edu", "教育经历", "教育背景", "学历背景", "学习经历"].includes(normalized)) {
    return "education";
  }

  if (["supplement", "skills", "skill", "certificate", "credential", "补充信息", "技能", "技能与证书", "证书"].includes(normalized)) {
    return "credential";
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
  const summary = item.summary ? cleanDisplayLine(item.summary) : undefined;
  const bullets = mergeBrokenBulletFragments([
    ...(isDisplayableResumeLine(summary) ? splitExplicitBulletSeparators(summary) : []),
    ...(item.bullets?.flatMap((bullet) => splitExplicitBulletSeparators(bullet)).filter(isDisplayableResumeLine) ?? [])
  ]);

  return {
    type: "entry",
    heading: cleanDisplayLine(item.heading),
    subheading: item.subheading ? cleanDisplayLine(item.subheading) : undefined,
    meta: item.meta ? cleanDisplayLine(item.meta) : undefined,
    // Keep entry body as one bullet list. Rendering summary and bullets as two
    // separate lists makes the PDF look like a nested/sub-list even when it is not.
    bullets: bullets.length > 0 ? bullets : undefined
  };
}

function toTextItems(items: string[]): ResumeDocumentItem[] {
  return items
    .map(cleanPlainTextItemLine)
    .filter(isDisplayableResumeLine)
    .map((item) => ({
      type: "text",
      text: item
    }));
}

function createSuggestionEntry(suggestion: SnapshotSuggestion): ParsedResumeEntry {
  const structuredEntry = parseStructuredSuggestionEntry(suggestion);
  if (structuredEntry) {
    return structuredEntry;
  }

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

function parseStructuredSuggestionEntry(suggestion: SnapshotSuggestion): ParsedResumeEntry | null {
  const lines = cleanGeneratedResumeText(suggestion.afterText)
    .split(/\r?\n/u)
    .map((line) => line.trim().replace(/^[•·▪\-–—]+\s*/, ""))
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const section = normalizeSuggestionSection(suggestion.section);
  const firstLine = lines[0] ?? "";
  const secondLine = lines[1] ?? "";
  const secondLineDate = extractDateRange(secondLine);
  const firstLineDate = extractDateRange(firstLine);
  const headerLine = secondLineDate.dateRange && !secondLineDate.rest ? `${firstLine} ${secondLine}` : firstLine;
  const bodyStartIndex = secondLineDate.dateRange && !secondLineDate.rest ? 2 : 1;
  const bodyLines = lines.slice(bodyStartIndex);

  if (section === "experience" && (firstLineDate.dateRange || secondLineDate.dateRange || /公司|银行|分行|集团|科技/u.test(firstLine))) {
    const entry = formatWorkLikeLine(headerLine, /实习/u.test(headerLine));
    entry.summary = bodyLines[0] ?? entry.summary;
    entry.bullets = bodyLines.length > 1 ? bodyLines.slice(1) : entry.bullets;
    return entry;
  }

  if (section === "project" && (firstLineDate.dateRange || secondLineDate.dateRange || /项目|OfferYou|自媒体|工具/u.test(firstLine))) {
    const titleAndDate = extractDateRange(headerLine);
    const entry: ParsedResumeEntry = {
      heading: titleAndDate.rest || firstLine,
      meta: titleAndDate.dateRange || undefined,
      summary: bodyLines[0],
      bullets: bodyLines.length > 1 ? bodyLines.slice(1) : undefined
    };
    return entry;
  }

  return null;
}

function stripRedundantEntryHeading(heading: string, text: string) {
  if (/OfferYou/i.test(heading)) {
    return text
      .replace(/^OfferYou\s*\)?\s*AI\s*岗位定制简历助手\s*（?个人(?:产品)?项目）?\s*(?:20\d{2}[./-]\d{1,2}\s*[-至到]\s*至今)?\s*/iu, "")
      .replace(/^OfferYou\s*[｜|]\s*AI\s*岗位定制简历助手\s*/iu, "")
      .trim();
  }

  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "";
  const headingKey = normalizeEntryHeadingKey(heading);
  const firstLineKey = normalizeEntryHeadingKey(firstLine);
  const strongHeadingOverlap =
    headingKey.length >= 6 &&
    firstLineKey.length >= 6 &&
    (firstLineKey.includes(headingKey.slice(0, 8)) || headingKey.includes(firstLineKey.slice(0, 8)));

  if (lines.length > 1 && extractDateRange(firstLine).dateRange && strongHeadingOverlap) {
    return lines.slice(1).join("\n").trim();
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
  if (isSentenceLikeHeading(title)) {
    return normalizeSuggestionSection(suggestion.section) === "project" ? "岗位相关项目" : "岗位相关经历";
  }
  return title && !/^(accepted|suggestion|ai)$/i.test(title) ? title : "岗位相关经历";
}

function splitIntoBullets(text: string) {
  // Split on semicolons and meaningful newlines only.
  // Do NOT split on 。(Chinese period) — it is a sentence terminator within a bullet,
  // not a delimiter between separate bullet points.
  // For newlines: only split when the next line looks like a new bullet (starts with
  // bullet markers, numbering, or is long enough to be a standalone point).
  // Mid-sentence newlines (from OCR/AI formatting) are normalized to spaces.
  const preprocessed = text.replace(/\n(?=[•·▪\-–—]\s)/g, "；")
    .replace(/\n(?=\d+[.)]\s)/g, "；")
    .replace(/\n(?=[一-龥]{4,})/g, "；")
    .replace(/\s*[▸▶]\s*/gu, "；")
    .replace(/\n/g, " ");
  return mergeBrokenBulletFragments(
    preprocessed
    .split(/[；;]/)
    .map((part) => cleanDisplayLine(part))
    .filter((part) => part.length > 0)
  );
}

function splitExplicitBulletSeparators(value: string) {
  return cleanDisplayLine(value)
    .split(/\s*[▸▶]\s*/u)
    .map((item) => cleanDisplayLine(item))
    .filter(Boolean);
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

// End of text parsing helpers

function splitStrengthText(text: string, isOriginal: boolean = false) {
  const cleaned = isOriginal ? cleanOriginalResumeText(text) : cleanGeneratedResumeText(text);
  if (!cleaned) {
    return [];
  }

  // If it's a block of text, try to split by common markers if they look like bullets
  let processed = cleaned;
  const colonCount = (cleaned.match(/[：:]/gu) ?? []).length;
  if (!cleaned.includes("\n") && colonCount >= 2) {
    // If there are multiple colons, it might be a list formatted as "Label: Content Label: Content"
    processed = cleaned.replace(/(?=[^：:\s]{2,12}[:：])/gu, "\n");
  }

  return processed
    .split(/[\n。；]+/u)
    .map((s) => s.trim())
    .filter(
      (item) =>
        isResumeReadyChineseLine(item) &&
        item.length >= 8 &&
        !isInternalAdviceLine(item) &&
        !isOcrPageArtifactLine(item)
    )
    .map((item) => item.replace(/^[，、；\s]+/u, ""));
}

function isResumeReadyChineseLine(text: string) {
  const cleaned = text.trim();
  if (!cleaned) {
    return false;
  }

  return /[\u4e00-\u9fa5]/u.test(cleaned);
}

function cleanDisplayLine(value: string) {
  return cleanGeneratedResumeText(value)
    .replace(/^\s*[-•·▪–—]\s*/u, "")
    .replace(/^\s*>+\s*/u, "")
    .replace(/\s+\|\s+/g, " ｜ ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPlainTextItemLine(value: string) {
  return cleanGeneratedResumeText(value)
    .replace(/^\s*[-•·▪–—]\s*/u, "")
    .replace(/^\s*>+\s*/u, "")
    .replace(/^(学历：[^|｜]+)\s*[|｜]\s*([^|｜]+)$/u, "$1 · $2")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeBrokenBulletFragments(items: string[]) {
  const merged: string[] = [];

  for (const value of items) {
    const item = cleanDisplayLine(value).trim();
    if (!item) {
      continue;
    }

    const previous = merged.at(-1);
    if (previous && shouldMergeBulletFragments(previous, item)) {
      merged[merged.length - 1] = mergeBulletFragments(previous, item);
      continue;
    }

    merged.push(item);
  }

  return merged;
}

function shouldMergeBulletFragments(previous: string, current: string) {
  const previousCompact = previous.replace(/\s+/g, "").trim();
  const currentCompact = current.replace(/\s+/g, "").trim();

  if (!previousCompact || !currentCompact) {
    return false;
  }

  if (previousCompact.endsWith("一") && currentCompact.startsWith("键")) {
    return true;
  }

  // Merge if previous ends with a continuation punctuation
  if (/[、，,；;：:\/｜|（(【\[]$/.test(previousCompact)) {
    return true;
  }

  // Merge if previous doesn't end with sentence-terminal punctuation
  // and current is a short fragment that looks like a broken sentence
  const endsWithTerminal = /[。！？!?.]$/.test(previousCompact);
  if (!endsWithTerminal && currentCompact.length < 15) {
    return true;
  }

  return false;
}

function mergeBulletFragments(previous: string, current: string) {
  return `${previous.replace(/\s+$/u, "")}${current.replace(/^\s+/u, "")}`;
}

function isDisplayableResumeLine(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  return !/^[-—–_*\s]{2,}$/.test(value.trim()) && !isInternalAdviceLine(value) && !isOcrPageArtifactLine(value);
}

function isInternalAdviceLine(value: string) {
  return /JD\s*缺失能力提醒|缺失能力提醒|建议在|建议补充|例如[：:]|岗位能力待确认/u.test(value);
}

function isOcrPageArtifactLine(value: string) {
  const compact = value.replace(/\s+/g, "").trim();
  return /file:\/\/\/tmp\/|\/tmp\/resume-|第\d+\/\d+[页⻚]|resume-ai-pm\.html|\.html$/iu.test(compact);
}

function isDateLikeText(value: string) {
  return /^\d{4}(?:[./-]\d{1,2})?\s*[-–—至到]\s*(?:\d{4}(?:[./-]\d{1,2})?|至今|present)$/iu.test(value.trim());
}

function isEducationOrCredentialLikeText(text: string) {
  return /(大学|学院|本科|硕士|博士|学历|教育|CET|英语|雅思|托福|证书|从业资格|驾驶证)/iu.test(text);
}

function isWorkLikeText(text: string) {
  return /(公司|银行|集团|科技|岗位|经理|工程师|运营|客户|业务|项目|负责|协助|主导|推进|优化|分析|交付)/iu.test(text);
}

function isProjectLikeText(text: string) {
  return /(项目|产品|系统|平台|工具|Agent|AI|MVP|PRD|接口|流程|工作流|上线|发布|迭代)/iu.test(text);
}

function isSentenceLikeHeading(value: string) {
  const cleaned = cleanDisplayLine(value);
  if (!cleaned) {
    return false;
  }

  return (
    cleaned.length > 28 ||
    /[，。；：:]/u.test(cleaned) ||
    /^(通过|基于|独立|协助|负责|输出|定义|完成|策划|优化|提升|验证)/u.test(cleaned)
  );
}
