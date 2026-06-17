import { randomUUID } from "node:crypto";
import { executeSqlParams, querySqlParams } from "@/lib/db";
import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import {
  readApplicationRecord,
  updateApplicationRecordInterviewPrep
} from "@/lib/services/applications/application-record-service";
import { readSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import type { ResumeDocument } from "@/lib/document/resume-document";
import { parseJsonPayload } from "@/lib/services/persistence/json-payload";
import { callModelJSON, callModelText } from "@/lib/ai/model-gateway";

export type InterviewQuestionSourceType = "jd" | "snapshot" | "master_fact" | "inferred" | "basic";

export type InterviewQuestion = {
  id: string;
  questionText: string;
  sourceType: InterviewQuestionSourceType;
  sourceRef?: string;
  favorite: boolean;
  answerDraft: string;
};

export type InterviewPrepRecord = {
  id: string;
  applicationRecordId: string;
  draftId: string;
  company: string;
  jobTitle: string;
  candidateName: string;
  selfIntroDraft: string;
  questions: InterviewQuestion[];
  generationMode?: "model" | "model_repaired" | "deterministic_fallback";
  riskNotes?: string[];
  modelProvider?: string;
  createdAt: string;
  updatedAt: string;
};

type ModelInterviewPrepOutput = {
  selfIntroDraft: string;
  questions: Array<{
    questionText: string;
    sourceType?: InterviewQuestionSourceType;
    sourceRef?: string;
    answerDraft?: string;
  }>;
};

export async function optimizeInterviewAnswerDraft(input: {
  company: string;
  jobTitle: string;
  questionText: string;
  answerDraft: string;
  sourceType?: InterviewQuestionSourceType;
  sourceRef?: string;
}): Promise<{
  answerDraft: string;
  generationMode: InterviewPrepRecord["generationMode"];
  modelProvider?: string;
  riskNote?: string;
}> {
  const originalDraft = input.answerDraft.trim();
  const systemPrompt = [
    "你是一位面试教练，负责把候选人的答案草稿优化成真实、清晰、可直接练习的面试回答。",
    "",
    "规则：",
    "- 不编造公司、学历、项目结果、指标或经历。",
    "- 如果原答案信息不足，可以给出回答框架和需要补充的要点，但不能虚构事实。",
    "- 优先使用 STAR / 结论先行 / 业务价值表达。",
    "- 只输出优化后的答案正文，不要解释，不要 Markdown 标题。"
  ].join("\n");
  const userPrompt = [
    `公司：${input.company}`,
    `岗位：${input.jobTitle}`,
    `问题：${input.questionText}`,
    `问题来源：${renderInterviewQuestionSourceLabel(input.sourceType ?? "inferred")}${input.sourceRef ? ` · ${input.sourceRef}` : ""}`,
    "",
    "当前答案草稿：",
    originalDraft || "（用户还没有写答案，请生成一个不编造事实的回答框架，并标出需要补充的个人经历要点。）"
  ].join("\n");

  const result = await callModelText({
    systemPrompt,
    userPrompt,
    task: "interview"
  });
  const optimized = result.data?.trim();

  if (!optimized || result.generationMode === "deterministic_fallback") {
    return {
      answerDraft: originalDraft,
      generationMode: "deterministic_fallback",
      modelProvider: result.provider,
      riskNote: `AI 优化失败，已保留原答案。${result.fallbackReason ?? "请稍后重试。"}`
    };
  }

  return {
    answerDraft: optimized,
    generationMode: result.generationMode as InterviewPrepRecord["generationMode"],
    modelProvider: result.provider
  };
}

async function buildInterviewPrepWithModel(input: {
  record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>;
  draft: Awaited<ReturnType<typeof readWorkspaceDraft>>;
  snapshot: ResumeDocument | null;
  prepId: string;
}): Promise<Pick<InterviewPrepRecord, "selfIntroDraft" | "questions" | "generationMode" | "riskNotes" | "modelProvider">> {
  const systemPrompt = [
    "你是一位资深面试辅导教练。根据候选人的简历快照和目标岗位 JD，生成面试准备材料。",
    "",
    "规则：",
    "- 只能基于已确认快照和 JD 中的信息，不编造公司、学历、项目结果。",
    "- 输出 5 到 8 个面试问题。",
    "- 自我介绍控制在 60 到 90 秒。",
    "- 每个问题需标注 sourceType（jd / snapshot / master_fact / inferred）。",
    "- 没有对应来源时，不得把问题标为 jd / snapshot / master_fact，只能标 inferred。",
    "- 输出合法 JSON，不要 Markdown。"
  ].join("\n");

  const snapshotText = input.snapshot
    ? input.snapshot.sections
        .flatMap((s) => s.items.map((item) => (item.type === "entry" ? `${item.heading}: ${(item.bullets ?? []).join("，")}` : item.text)))
        .filter(Boolean)
        .join("\n")
    : "（无快照）";

  const userPrompt = [
    `公司：${input.record.company}`,
    `岗位：${input.record.jobTitle}`,
    getRecordInterviewContext(input.record) ? `用户补充 / 联网资料：\n${getRecordInterviewContext(input.record)}` : "",
    "",
    `JD 能力要求：${(input.draft?.jdInsight?.coreAbilities ?? []).join("、") || "（未解析）"}`,
    `候选人优势：${(input.draft?.analysis?.strengths ?? []).join("、") || "（未解析）"}`,
    "",
    "已确认简历快照内容：",
    snapshotText,
    "",
    `请输出 JSON：{ "selfIntroDraft": string, "questions": Array<{ "questionText": string, "sourceType": "jd"|"snapshot"|"master_fact"|"inferred", "sourceRef"?: string, "answerDraft"?: string }> }`
  ].join("\n");

  const result = await callModelJSON<ModelInterviewPrepOutput>({
    systemPrompt,
    userPrompt,
    task: "interview"
  });

  if (!result.data?.selfIntroDraft || !result.data.questions?.length) {
    throw new Error(result.fallbackReason ?? "Model returned empty interview prep.");
  }

  const questions = result.data.questions.slice(0, 8).map((q, index) => ({
    id: `${input.prepId}-q${index + 1}`,
    questionText: q.questionText,
    sourceType: (q.sourceType ?? "inferred") as InterviewQuestionSourceType,
    sourceRef: q.sourceRef,
    favorite: false,
    answerDraft: q.answerDraft ?? ""
  }));

  return {
    selfIntroDraft: result.data.selfIntroDraft,
    questions,
    generationMode: result.generationMode as InterviewPrepRecord["generationMode"],
    riskNotes: result.fallbackReason ? [result.fallbackReason] : undefined,
    modelProvider: result.provider
  };
}

export async function createInterviewPrepFromRecord(
  recordId: string,
  options: { force?: boolean } = {}
): Promise<InterviewPrepRecord> {
  const record = await readApplicationRecord(recordId);
  if (!record) {
    throw new Error("Application record not found.");
  }

  const draft = record.draftId ? await readWorkspaceDraft(record.draftId) : null;
  if (record.draftId && !draft) {
    throw new Error("Workspace draft not found for the application record.");
  }
  const snapshot = record.draftId ? await readSnapshotForDraft(record.draftId) : null;
  const now = new Date().toISOString();
  const prepId = `interview-${record.id}`;
  const evidence = getInterviewEvidenceState({ record, draft, snapshot });
  const existing = await readInterviewPrepForRecord(recordId);

  if (existing && !options.force && !shouldRegenerateUnsafePrep(existing, evidence)) {
    await updateApplicationRecordInterviewPrep({
      recordId,
      interviewPrepId: existing.id,
      interviewStatus: "preparing"
    });
    return existing;
  }

  if (!evidence.canUseModel) {
    const prep = buildBasicInterviewPrep({
      record,
      prepId,
      now
    });
    await saveInterviewPrep(prep);
    await updateApplicationRecordInterviewPrep({
      recordId: record.id,
      interviewPrepId: prep.id,
      interviewStatus: "preparing"
    });
    return prep;
  }

  let modelResult: Awaited<ReturnType<typeof buildInterviewPrepWithModel>> | null = null;
  let modelFailureReason = "";
  try {
    modelResult = await buildInterviewPrepWithModel({ record, draft, snapshot, prepId });
  } catch (error) {
    modelResult = null;
    modelFailureReason = error instanceof Error ? error.message : "模型调用失败。";
    if (process.env.OFFERYOU_DEBUG_AI === "1") {
      console.error("[InterviewPrep] Model call failed, falling back to templates:", error);
    }
  }

  if (!modelResult && existing && options.force && isModelGeneratedPrep(existing) && evidence.canUseModel) {
    const preserved = preserveExistingModelPrepAfterFailure({
      existing,
      failureReason: modelFailureReason,
      now
    });
    await saveInterviewPrep(preserved);
    await updateApplicationRecordInterviewPrep({
      recordId: record.id,
      interviewPrepId: preserved.id,
      interviewStatus: "preparing"
    });
    return preserved;
  }

  const selfIntroDraft = modelResult?.selfIntroDraft ?? buildSelfIntroDraft({
    company: record.company,
    jobTitle: record.jobTitle,
    draft,
    snapshot
  });

  const questions = modelResult?.questions
    ? sanitizeModelQuestions(modelResult.questions, evidence)
    : buildInterviewQuestions({
        record,
        draft,
        snapshot
      }, prepId);

  const prep: InterviewPrepRecord = {
    id: prepId,
    applicationRecordId: record.id,
    draftId: record.draftId,
    company: record.company,
    jobTitle: record.jobTitle,
    candidateName: snapshot?.header.name ?? "OfferYou 用户",
    selfIntroDraft,
    questions,
    generationMode: modelResult?.generationMode ?? "deterministic_fallback",
    riskNotes: modelResult?.riskNotes ?? buildFallbackRiskNotes({ modelResult, draft, evidence, modelFailureReason }),
    modelProvider: modelResult?.modelProvider,
    createdAt: now,
    updatedAt: now
  };

  await saveInterviewPrep(prep);
  await updateApplicationRecordInterviewPrep({
    recordId: record.id,
    interviewPrepId: prep.id,
    interviewStatus: "preparing"
  });

  return prep;
}

function isModelGeneratedPrep(prep: InterviewPrepRecord) {
  return prep.generationMode === "model" || prep.generationMode === "model_repaired";
}

function preserveExistingModelPrepAfterFailure(input: {
  existing: InterviewPrepRecord;
  failureReason: string;
  now: string;
}): InterviewPrepRecord {
  return {
    ...input.existing,
    riskNotes: mergeRiskNotes(input.existing.riskNotes, [
      `本次重新生成失败，已保留上一次 AI 面试准备。${input.failureReason || "请稍后重试。"}`
    ]),
    updatedAt: input.now
  };
}

function mergeRiskNotes(existing: string[] | undefined, next: string[]) {
  return Array.from(new Set([...(existing ?? []), ...next].filter(Boolean)));
}

function buildBasicInterviewPrep(input: {
  record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>;
  prepId: string;
  now: string;
}): InterviewPrepRecord {
  const questions: InterviewQuestion[] = [
    {
      id: `${input.prepId}-q1`,
      questionText: "请准备一段 60 秒自我介绍，重点说明过往经历、目标岗位和最想展示的一项能力。",
      sourceType: "basic",
      favorite: false,
      answerDraft: ""
    },
    {
      id: `${input.prepId}-q2`,
      questionText: `为什么关注 ${input.record.company} 的 ${input.record.jobTitle}？请先补充 JD 或公司资料后再写具体答案。`,
      sourceType: "basic",
      favorite: false,
      answerDraft: ""
    },
    {
      id: `${input.prepId}-q3`,
      questionText: "作为 AI 产品经理，如何判断一个 AI 能力是否值得产品化？请按用户场景、技术可行性、成本和风险展开。",
      sourceType: "basic",
      favorite: false,
      answerDraft: ""
    }
  ];

  return {
    id: input.prepId,
    applicationRecordId: input.record.id,
    draftId: input.record.draftId,
    company: input.record.company,
    jobTitle: input.record.jobTitle,
    candidateName: "OfferYou 用户",
    selfIntroDraft: [
      `面试官您好，我正在准备 ${input.record.company} 的 ${input.record.jobTitle} 面试。`,
      "这是一版基础自我介绍框架，当前还缺少 JD、公司资料或简历快照。",
      "我会先补充岗位要求和公司信息，再把经历、能力和岗位匹配点讲具体。"
    ].join("\n"),
    questions,
    generationMode: "deterministic_fallback",
    riskNotes: [
      "未提供 JD、公司资料或简历快照，系统没有调用模型生成岗位深度问题；当前只保留基础面试准备题。",
      "要生成可信的岗位问题，需要补充 JD、公司资料，或接入联网研究结果。"
    ],
    createdAt: input.now,
    updatedAt: input.now
  };
}

type InterviewEvidenceState = {
  canUseModel: boolean;
  hasJD: boolean;
  hasSnapshot: boolean;
  hasMasterFacts: boolean;
  hasSubstantialNotes: boolean;
};

function getInterviewEvidenceState(input: {
  record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>;
  draft: Awaited<ReturnType<typeof readWorkspaceDraft>>;
  snapshot: ResumeDocument | null;
}): InterviewEvidenceState {
  const hasJD = Boolean(input.draft?.jdInsight?.coreAbilities?.length);
  const hasSnapshot = Boolean(input.snapshot?.sections.some((section) => section.items.length > 0));
  const hasMasterFacts = Boolean(input.draft?.masterFactsUsed?.length);
  const hasSubstantialNotes = hasUsefulInterviewNotes(getRecordInterviewContext(input.record));

  return {
    canUseModel: hasJD || hasSnapshot || hasMasterFacts || hasSubstantialNotes,
    hasJD,
    hasSnapshot,
    hasMasterFacts,
    hasSubstantialNotes
  };
}

function hasUsefulInterviewNotes(notes: string | undefined) {
  const normalized = notes?.trim() ?? "";
  if (normalized.length >= 120) {
    return true;
  }

  return /JD|岗位要求|任职要求|工作职责|公司信息|公司资料|产品|业务|官网|招聘/i.test(normalized) && normalized.length >= 40;
}

function getRecordInterviewContext(record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>) {
  return [
    record.interviewContextText ? `用户补充资料：\n${record.interviewContextText}` : "",
    record.interviewResearch?.status === "ready" ? `联网研究摘要：\n${record.interviewResearch.summary}` : "",
    record.interviewNotes ? `面试备注：\n${record.interviewNotes}` : ""
  ].filter(Boolean).join("\n\n").trim();
}

function shouldRegenerateUnsafePrep(prep: InterviewPrepRecord, evidence: InterviewEvidenceState) {
  if (evidence.canUseModel) {
    return false;
  }

  if (prep.generationMode === "model" || prep.generationMode === "model_repaired") {
    return true;
  }

  return prep.questions.some((question) => question.sourceType !== "basic");
}

function sanitizeModelQuestions(questions: InterviewQuestion[], evidence: InterviewEvidenceState): InterviewQuestion[] {
  return questions.map((question) => {
    if (question.sourceType === "snapshot" && !evidence.hasSnapshot) {
      return { ...question, sourceType: "inferred", sourceRef: "未绑定简历快照，已降级为推断" };
    }

    if (question.sourceType === "master_fact" && !evidence.hasMasterFacts) {
      return { ...question, sourceType: "inferred", sourceRef: "未绑定事实资料，已降级为推断" };
    }

    if (question.sourceType === "jd" && !evidence.hasJD && !evidence.hasSubstantialNotes) {
      return { ...question, sourceType: "inferred", sourceRef: "未提供 JD，已降级为推断" };
    }

    return question;
  });
}

export async function saveInterviewPrep(prep: InterviewPrepRecord) {
  await executeSqlParams(
    `INSERT INTO interview_preps (id, application_record_id, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       application_record_id = excluded.application_record_id,
       payload_json = excluded.payload_json,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
    [prep.id, prep.applicationRecordId, JSON.stringify(prep), prep.createdAt, prep.updatedAt]
  );
}

export function buildInterviewPrepExportText(prep: InterviewPrepRecord) {
  const favoriteQuestions = prep.questions.filter((question) => question.favorite);
  const answeredQuestions = prep.questions.filter((question) => question.answerDraft.trim().length > 0);

  return [
    "# 面试准备复盘卡",
    "",
    `- 公司：${prep.company}`,
    `- 岗位：${prep.jobTitle}`,
    `- 候选人：${prep.candidateName}`,
    `- 投递记录：${prep.applicationRecordId}`,
    `- 问题总数：${prep.questions.length}`,
    `- 收藏问题：${favoriteQuestions.length}`,
    `- 已填写答案：${answeredQuestions.length}`,
    "",
    "## 自我介绍草稿",
    prep.selfIntroDraft.trim() || "（暂无）",
    "",
    "## 收藏问题",
    favoriteQuestions.length > 0
      ? favoriteQuestions
          .map((question, index) => {
            const lines = [
              `${index + 1}. ${question.questionText}`,
              `   来源：${renderInterviewQuestionSourceLabel(question.sourceType)}${question.sourceRef ? ` · ${question.sourceRef}` : ""}`
            ];

            if (question.answerDraft.trim()) {
              lines.push(`   答案草稿：${question.answerDraft.trim()}`);
            }

            return lines.join("\n");
          })
          .join("\n\n")
      : "（暂无收藏问题）",
    "",
    "## 已填写答案草稿",
    answeredQuestions.length > 0
      ? answeredQuestions
          .map((question, index) =>
            [
              `${index + 1}. ${question.questionText}`,
              `   答案草稿：${question.answerDraft.trim()}`,
              `   来源：${renderInterviewQuestionSourceLabel(question.sourceType)}${question.sourceRef ? ` · ${question.sourceRef}` : ""}`
            ].join("\n")
          )
          .join("\n\n")
      : "（暂无答案草稿）"
  ].join("\n");
}

export function buildInterviewPrepReviewChecklist(prep: InterviewPrepRecord) {
  const favoriteCount = prep.questions.filter((question) => question.favorite).length;
  const answeredCount = prep.questions.filter((question) => question.answerDraft.trim().length > 0).length;

  return [
    `核对公司与岗位是否一致：${prep.company} · ${prep.jobTitle}`,
    `确认自我介绍是否已更新：${prep.selfIntroDraft.trim() ? "已填写" : "未填写"}`,
    `确认收藏问题是否已标记：${favoriteCount} 题`,
    `确认答案草稿是否已补齐：${answeredCount} 题`
  ];
}

export async function readInterviewPrep(prepId: string): Promise<InterviewPrepRecord | null> {
  const rows = await querySqlParams<{ payload_json: string }>(
    "SELECT payload_json FROM interview_preps WHERE id = ? LIMIT 1",
    [prepId]
  );

  if (rows.length === 0) {
    return null;
  }

  const parsed = parseJsonPayload<Partial<InterviewPrepRecord>>(rows[0].payload_json, "面试准备");
  return parsed.ok ? normalizeInterviewPrep(parsed.value) : null;
}

export async function readInterviewPrepForRecord(recordId: string): Promise<InterviewPrepRecord | null> {
  const rows = await querySqlParams<{ payload_json: string }>(
    "SELECT payload_json FROM interview_preps WHERE application_record_id = ? LIMIT 1",
    [recordId]
  );

  if (rows.length === 0) {
    return null;
  }

  const parsed = parseJsonPayload<Partial<InterviewPrepRecord>>(rows[0].payload_json, "面试准备");
  return parsed.ok ? normalizeInterviewPrep(parsed.value) : null;
}

function buildInterviewQuestions(
  input: {
    record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>;
    draft: Awaited<ReturnType<typeof readWorkspaceDraft>>;
    snapshot: ResumeDocument | null;
  },
  prepId: string
): InterviewQuestion[] {
  const strengths = input.draft?.analysis?.strengths ?? [];
  const masterFacts = input.draft?.masterFactsUsed ?? [];
  const questions: Array<Omit<InterviewQuestion, "id">> = [];

  questions.push({
    questionText: `请用 1 分钟介绍自己，并说明为什么关注 ${input.record.jobTitle}。`,
    sourceType: "jd",
    sourceRef: input.record.jobTitle,
    favorite: false,
    answerDraft: ""
  });

  for (const ability of (input.draft?.jdInsight?.coreAbilities ?? []).slice(0, 3)) {
    questions.push({
      questionText: `JD 里要求「${ability}」，请用已确认简历快照中的事实说明匹配度。`,
      sourceType: "jd",
      sourceRef: ability,
      favorite: false,
      answerDraft: ""
    });
  }

  if (!input.draft?.jdInsight?.coreAbilities?.length) {
    questions.push({
      questionText: `目前还没有补充 JD，请先说明自己对 ${input.record.company} 和 ${input.record.jobTitle} 的理解，以及为什么适合这个方向。`,
      sourceType: "inferred",
      sourceRef: input.record.company,
      favorite: false,
      answerDraft: ""
    });
    questions.push({
      questionText: `如果面试官要求补充岗位相关案例，会优先讲哪一段经历？请按背景、动作、结果、复盘组织答案。`,
      sourceType: "inferred",
      sourceRef: input.record.jobTitle,
      favorite: false,
      answerDraft: ""
    });
  }

  if (strengths.length > 0) {
    questions.push({
      questionText: `请说明简历里最能支撑 ${input.record.jobTitle} 的一条优势，并结合事实展开。`,
      sourceType: "snapshot",
      sourceRef: strengths[0],
      favorite: false,
      answerDraft: ""
    });
  }

  const firstFact = masterFacts[0];
  if (firstFact) {
    questions.push({
      questionText: `围绕「${firstFact.title}」讲一个亲自推动结果的例子。`,
      sourceType: "master_fact",
      sourceRef: firstFact.id,
      favorite: false,
      answerDraft: ""
    });
  }

  questions.push({
    questionText: `如果 ${input.record.company} 这类岗位遇到需求不清晰，会如何拆解成下一步？`,
    sourceType: "inferred",
    sourceRef: input.record.company,
    favorite: false,
    answerDraft: ""
  });

  questions.push({
    questionText: "面试官追问协作中的具体贡献时，通常如何区分团队成果和个人贡献？",
    sourceType: "inferred",
    sourceRef: input.record.jobTitle,
    favorite: false,
    answerDraft: ""
  });

  if (input.snapshot?.sections.length) {
    const leadSection = input.snapshot.sections.find((section) => section.items.length > 0);
    if (leadSection) {
      questions.push({
        questionText: `请围绕「${leadSection.title}」部分，讲一个最有说服力的例子。`,
        sourceType: "snapshot",
        sourceRef: leadSection.id,
        favorite: false,
        answerDraft: ""
      });
    }
  }

  questions.push({
    questionText: `如果要在前三个月为 ${input.record.company} 交付结果，优先级通常会如何安排？`,
    sourceType: "jd",
    sourceRef: input.record.company,
    favorite: false,
    answerDraft: ""
  });

  return dedupeQuestions(questions).slice(0, 8).map((question, index) => ({
    ...question,
    id: `${prepId}-q${index + 1}`
  }));
}

function buildSelfIntroDraft(input: {
  company: string;
  jobTitle: string;
  draft: Awaited<ReturnType<typeof readWorkspaceDraft>>;
  snapshot: ResumeDocument | null;
}) {
  const firstStrength = input.draft?.analysis?.strengths?.[0];
  const facts = input.draft?.masterFactsUsed ?? [];
  const leadingFact = facts[0];
  const snapshotEvidence = extractSnapshotLeadEvidence(input.snapshot);
  const leadAbility = input.draft?.jdInsight?.coreAbilities?.[0];
  const name = input.snapshot?.header.name ?? "OfferYou 用户";

  const lines = [
    `我是 ${name}，最近主要在把真实经历整理成可投递、可解释的岗位快照。`,
    leadAbility ? `这次岗位最需要的能力之一是「${leadAbility}」，我会围绕这条主线说明匹配度。` : firstStrength ? `我的一个核心优势是：${trimSentence(firstStrength)}。` : `我会优先把最能支撑目标岗位的经历讲清楚。`,
    snapshotEvidence ? `例如，已确认简历快照中有「${snapshotEvidence}」这类证据。` : leadingFact ? `例如，我会用「${leadingFact.title}」这类事实来说明我能做成什么。` : `我会用真实事实和清晰结果来证明自己。`,
    `这次我关注 ${input.company} 的 ${input.jobTitle}，因为这份岗位和我当前的能力主线匹配。`
  ];

  return lines.join("\n");
}

function buildFallbackRiskNotes(input: {
  modelResult: Awaited<ReturnType<typeof buildInterviewPrepWithModel>> | null;
  draft: Awaited<ReturnType<typeof readWorkspaceDraft>>;
  evidence: InterviewEvidenceState;
  modelFailureReason?: string;
}) {
  if (input.modelResult) {
    return undefined;
  }

  if (input.modelFailureReason) {
    if (input.evidence.hasSubstantialNotes || input.evidence.hasJD) {
      return [
        `模型调用失败，已临时生成基础准备版。${input.modelFailureReason}`,
        input.evidence.hasSnapshot ? "当前已绑定简历快照。" : "当前没有绑定简历快照，部分问题不会引用个人经历。"
      ];
    }

    return [`模型调用失败，已临时生成基础准备版。${input.modelFailureReason}`];
  }

  if (!input.draft) {
    return ["模型暂不可用，且当前手动面试记录还没有绑定简历快照；建议补充 JD、公司信息或绑定简历后再生成更精准的面试准备。"];
  }

  return ["模型暂不可用，已使用模板生成面试准备。"];
}

function extractSnapshotLeadEvidence(snapshot: ResumeDocument | null) {
  if (!snapshot) {
    return "";
  }

  for (const section of snapshot.sections) {
    for (const item of section.items) {
      if (item.type === "text" && item.text.trim()) {
        return trimLongEvidence(item.text);
      }

      if (item.type === "entry") {
        const parts = [
          item.heading,
          item.summary,
          ...(item.bullets ?? [])
        ].filter(Boolean);

        if (parts.length > 0) {
          return trimLongEvidence(parts.join("，"));
        }
      }
    }
  }

  return "";
}

function trimLongEvidence(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}...` : cleaned;
}

function dedupeQuestions(questions: Array<Omit<InterviewQuestion, "id">>) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = question.questionText.trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeInterviewPrep(prep: Partial<InterviewPrepRecord>): InterviewPrepRecord {
  return {
    id: prep.id ?? "",
    applicationRecordId: prep.applicationRecordId ?? "",
    draftId: prep.draftId ?? "",
    company: prep.company ?? "",
    jobTitle: prep.jobTitle ?? "",
    candidateName: prep.candidateName ?? "OfferYou 用户",
    selfIntroDraft: prep.selfIntroDraft ?? "",
    questions: (prep.questions ?? []).map((question, index) => ({
      id: question.id ?? `question-${index + 1}`,
      questionText: question.questionText ?? "",
      sourceType: question.sourceType ?? "inferred",
      sourceRef: question.sourceRef,
      favorite: question.favorite ?? false,
      answerDraft: question.answerDraft ?? ""
    })),
    generationMode: prep.generationMode,
    riskNotes: prep.riskNotes,
    modelProvider: prep.modelProvider,
    createdAt: prep.createdAt ?? "",
    updatedAt: prep.updatedAt ?? ""
  };
}

function trimSentence(text: string) {
  const cleaned = text.trim();
  if (!cleaned) {
    return cleaned;
  }

  return cleaned.endsWith("。") ? cleaned.slice(0, -1) : cleaned;
}

function renderInterviewQuestionSourceLabel(sourceType: InterviewQuestionSourceType) {
  switch (sourceType) {
    case "jd":
      return "JD";
    case "snapshot":
      return "快照";
    case "master_fact":
      return "事实";
    case "basic":
      return "基础题";
    default:
      return "推断";
  }
}
