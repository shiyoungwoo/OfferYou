import { randomUUID } from "node:crypto";
import { executeSql, querySql, sqlString } from "@/lib/db";
import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import {
  readApplicationRecord,
  updateApplicationRecordInterviewPrep
} from "@/lib/services/applications/application-record-service";
import { readSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import type { ResumeDocument } from "@/lib/document/resume-document";

export type InterviewQuestionSourceType = "jd" | "snapshot" | "master_fact" | "inferred";

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
  createdAt: string;
  updatedAt: string;
};

export async function createInterviewPrepFromRecord(recordId: string): Promise<InterviewPrepRecord> {
  const existing = await readInterviewPrepForRecord(recordId);
  if (existing) {
    await updateApplicationRecordInterviewPrep({
      recordId,
      interviewPrepId: existing.id,
      interviewStatus: "preparing"
    });
    return existing;
  }

  const record = await readApplicationRecord(recordId);
  if (!record) {
    throw new Error("Application record not found.");
  }

  const draft = await readWorkspaceDraft(record.draftId);
  if (!draft) {
    throw new Error("Workspace draft not found for the application record.");
  }
  const snapshot = await readSnapshotForDraft(record.draftId);
  const now = new Date().toISOString();
  const prep: InterviewPrepRecord = {
    id: `interview-${record.id}`,
    applicationRecordId: record.id,
    draftId: record.draftId,
    company: record.company,
    jobTitle: record.jobTitle,
    candidateName: snapshot?.header.name ?? "OfferYou 用户",
    selfIntroDraft: buildSelfIntroDraft({
      company: record.company,
      jobTitle: record.jobTitle,
      draft,
      snapshot
    }),
    questions: buildInterviewQuestions({
      record,
      draft,
      snapshot
    }, `interview-${record.id}`),
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

export async function saveInterviewPrep(prep: InterviewPrepRecord) {
  await executeSql(`
    INSERT INTO interview_preps (id, application_record_id, payload_json, created_at, updated_at)
    VALUES (
      ${sqlString(prep.id)},
      ${sqlString(prep.applicationRecordId)},
      ${sqlString(JSON.stringify(prep))},
      ${sqlString(prep.createdAt)},
      ${sqlString(prep.updatedAt)}
    )
    ON CONFLICT(id) DO UPDATE SET
      application_record_id = excluded.application_record_id,
      payload_json = excluded.payload_json,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  `);
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
  const rows = await querySql<{ payload_json: string }>(
    `SELECT payload_json FROM interview_preps WHERE id = ${sqlString(prepId)} LIMIT 1;`
  );

  if (rows.length === 0) {
    return null;
  }

  return normalizeInterviewPrep(JSON.parse(rows[0].payload_json) as Partial<InterviewPrepRecord>);
}

export async function readInterviewPrepForRecord(recordId: string): Promise<InterviewPrepRecord | null> {
  const rows = await querySql<{ payload_json: string }>(
    `SELECT payload_json FROM interview_preps WHERE application_record_id = ${sqlString(recordId)} LIMIT 1;`
  );

  if (rows.length === 0) {
    return null;
  }

  return normalizeInterviewPrep(JSON.parse(rows[0].payload_json) as Partial<InterviewPrepRecord>);
}

function buildInterviewQuestions(
  input: {
    record: NonNullable<Awaited<ReturnType<typeof readApplicationRecord>>>;
    draft: NonNullable<Awaited<ReturnType<typeof readWorkspaceDraft>>>;
    snapshot: ResumeDocument | null;
  },
  prepId: string
): InterviewQuestion[] {
  const strengths = input.draft.analysis?.strengths ?? [];
  const masterFacts = input.draft.masterFactsUsed ?? [];
  const questions: Array<Omit<InterviewQuestion, "id">> = [];

  questions.push({
    questionText: `请用 1 分钟介绍自己，并说明为什么关注 ${input.record.jobTitle}。`,
    sourceType: "jd",
    sourceRef: input.record.jobTitle,
    favorite: false,
    answerDraft: ""
  });

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
  draft: NonNullable<Awaited<ReturnType<typeof readWorkspaceDraft>>>;
  snapshot: ResumeDocument | null;
}) {
  const firstStrength = input.draft.analysis?.strengths?.[0];
  const facts = input.draft.masterFactsUsed ?? [];
  const leadingFact = facts[0];
  const name = input.snapshot?.header.name ?? "OfferYou 用户";

  const lines = [
    `我是 ${name}，最近主要在把真实经历整理成可投递、可解释的岗位快照。`,
    firstStrength ? `我的一个核心优势是：${trimSentence(firstStrength)}。` : `我会优先把最能支撑目标岗位的经历讲清楚。`,
    leadingFact ? `例如，我会用「${leadingFact.title}」这类事实来说明我能做成什么。` : `我会用真实事实和清晰结果来证明自己。`,
    `这次我关注 ${input.company} 的 ${input.jobTitle}，因为这份岗位和我当前的能力主线匹配。`
  ];

  return lines.join("\n");
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
    default:
      return "推断";
  }
}
