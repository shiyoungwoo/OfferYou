import Link from "next/link";
import { revalidatePath } from "next/cache";
import { BookOpen, CheckCircle2, Sparkles, Star } from "lucide-react";
import { InterviewPrepExportCard } from "@/components/interview/interview-prep-export-card";
import { getDefaultUserContext } from "@/lib/default-user";
import {
  buildInterviewPrepExportText,
  buildInterviewPrepReviewChecklist,
  createInterviewPrepFromRecord,
  readInterviewPrep,
  saveInterviewPrep
} from "@/lib/services/interview/interview-prep-service";
import { listApplicationRecords, readApplicationRecord } from "@/lib/services/applications/application-record-service";

export const dynamic = "force-dynamic";

type InterviewPrepPageProps = {
  searchParams?: Promise<{
    recordId?: string;
  }>;
};

export default async function InterviewPrepPage({ searchParams }: InterviewPrepPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const recordId = resolvedSearchParams?.recordId;
  const { userId } = getDefaultUserContext();

  if (!recordId) {
    const records = await listApplicationRecords();

    return (
      <main className="min-h-screen bg-[#f5f1e8] px-6 py-10 md:px-10">
        <section className="mx-auto flex max-w-6xl flex-col gap-6">
          <header className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card">
            <p className="text-sm uppercase tracking-[0.28em] text-accent">MVP / 面试准备</p>
            <h1 className="mt-3 text-4xl font-semibold text-slate-950">从投递记录进入面试准备</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
              这里会自动带入公司、岗位、快照和已确认事实，只保留问题、答案草稿和自我介绍草稿的编辑入口。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                href="/applications/new"
              >
                先去岗位定制
              </Link>
              <Link
                className="inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                href="/talent"
              >
                看天赋发现
              </Link>
            </div>
          </header>

          {records.length > 0 ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {records.slice(0, 6).map((record) => (
                <article key={record.id} className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-card">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">可用记录</p>
                  <h2 className="mt-3 text-xl font-semibold text-slate-950">{record.company}</h2>
                  <p className="mt-2 text-sm text-accent">{record.jobTitle}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    该记录已经具备投递上下文，可以直接进入面试准备。
                  </p>
                  <Link
                    className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                    href={`/prep?recordId=${record.id}`}
                  >
                    打开准备页
                  </Link>
                </article>
              ))}
            </section>
          ) : (
            <section className="rounded-[1.75rem] border border-dashed border-line bg-white/85 p-6 shadow-card">
              <p className="text-sm leading-7 text-slate-700">
                当前还没有投递记录。先完成一次岗位定制并导出 PDF，面试准备会自动接上。
              </p>
            </section>
          )}
        </section>
      </main>
    );
  }

  const record = await readApplicationRecord(recordId);

  if (!record) {
    const records = await listApplicationRecords();

    return (
      <main className="min-h-screen bg-[#f5f1e8] px-6 py-10 md:px-10">
        <section className="mx-auto flex max-w-6xl flex-col gap-6">
          <section className="rounded-[1.75rem] border border-dashed border-line bg-white/85 p-6 shadow-card">
            <p className="text-sm leading-7 text-slate-700">未找到对应的投递记录，请从已有记录重新进入面试准备。</p>
          </section>

          {records.length > 0 ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {records.slice(0, 6).map((item) => (
                <Link
                  key={item.id}
                  className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-card transition hover:border-accent"
                  href={`/prep?recordId=${item.id}`}
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">可用记录</p>
                  <h2 className="mt-3 text-xl font-semibold text-slate-950">{item.company}</h2>
                  <p className="mt-2 text-sm text-accent">{item.jobTitle}</p>
                </Link>
              ))}
            </section>
          ) : null}
        </section>
      </main>
    );
  }

  const prep = await createInterviewPrepFromRecord(record.id);
  const exportText = buildInterviewPrepExportText(prep);
  const checklistItems = buildInterviewPrepReviewChecklist(prep);
  const favoriteQuestionCount = prep.questions.filter((question) => question.favorite).length;
  const answeredQuestionCount = prep.questions.filter((question) => question.answerDraft.trim().length > 0).length;

  async function saveSelfIntroAction(formData: FormData) {
    "use server";

    const prepId = String(formData.get("prepId") ?? "");
    const recordIdValue = String(formData.get("recordId") ?? "");
    const selfIntroDraft = String(formData.get("selfIntroDraft") ?? "");
    const latestPrep = (await readInterviewPrep(prepId)) ?? (await createInterviewPrepFromRecord(recordIdValue));

    latestPrep.selfIntroDraft = selfIntroDraft.trim();
    latestPrep.updatedAt = new Date().toISOString();

    await saveInterviewPrep(latestPrep);
    revalidatePath("/prep");
  }

  async function saveAnswerAction(formData: FormData) {
    "use server";

    const prepId = String(formData.get("prepId") ?? "");
    const recordIdValue = String(formData.get("recordId") ?? "");
    const questionId = String(formData.get("questionId") ?? "");
    const answerDraft = String(formData.get("answerDraft") ?? "");
    const latestPrep = (await readInterviewPrep(prepId)) ?? (await createInterviewPrepFromRecord(recordIdValue));

    latestPrep.questions = latestPrep.questions.map((question) =>
      question.id === questionId ? { ...question, answerDraft: answerDraft.trim() } : question
    );
    latestPrep.updatedAt = new Date().toISOString();

    await saveInterviewPrep(latestPrep);
    revalidatePath("/prep");
  }

  async function toggleFavoriteAction(formData: FormData) {
    "use server";

    const prepId = String(formData.get("prepId") ?? "");
    const recordIdValue = String(formData.get("recordId") ?? "");
    const questionId = String(formData.get("questionId") ?? "");
    const latestPrep = (await readInterviewPrep(prepId)) ?? (await createInterviewPrepFromRecord(recordIdValue));

    latestPrep.questions = latestPrep.questions.map((question) =>
      question.id === questionId ? { ...question, favorite: !question.favorite } : question
    );
    latestPrep.updatedAt = new Date().toISOString();

    await saveInterviewPrep(latestPrep);
    revalidatePath("/prep");
  }

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-6 py-10 md:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card">
          <p className="text-sm uppercase tracking-[0.28em] text-accent">MVP / 面试准备</p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-950">{record.company} · {record.jobTitle}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
            这里会自动带入公司、岗位、快照和已确认事实，只保留问题、答案草稿和自我介绍草稿的编辑入口。
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-700">
            <span className="rounded-full border border-line bg-paper px-4 py-2">用户：{userId}</span>
            <span className="rounded-full border border-line bg-paper px-4 py-2">投递记录：{record.id}</span>
            <span className="rounded-full border border-line bg-paper px-4 py-2">状态：{renderInterviewStatus(record.interviewStatus)}</span>
            <span className="rounded-full border border-line bg-paper px-4 py-2">快照：{record.snapshotId}</span>
          </div>
        </header>

        <InterviewPrepExportCard
          answeredQuestionCount={answeredQuestionCount}
          checklistItems={checklistItems}
          company={prep.company}
          exportText={exportText}
          favoriteQuestionCount={favoriteQuestionCount}
          jobTitle={prep.jobTitle}
        />

        <div className="grid gap-6 xl:grid-cols-[1fr_1.12fr]">
          <section className="rounded-[1.75rem] border border-line bg-white/90 p-6 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">自我介绍草稿</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">先把开场讲顺</h2>
              </div>
              <div className="rounded-full border border-line bg-paper px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                4 句结构
              </div>
            </div>

            <form action={saveSelfIntroAction} className="mt-5 grid gap-4">
              <input type="hidden" name="prepId" value={prep.id} />
              <input type="hidden" name="recordId" value={record.id} />
              <textarea
                className="min-h-56 rounded-[1.2rem] border border-line bg-paper px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-accent"
                name="selfIntroDraft"
                defaultValue={prep.selfIntroDraft}
              />
              <button
                className="inline-flex w-fit rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                type="submit"
              >
                保存自我介绍
              </button>
            </form>

            <div className="mt-6 rounded-[1.35rem] border border-line bg-paper p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles size={16} className="text-accent" />
                生成结果说明
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                当前版本只保留问题准备、自我介绍和答案草稿，不包含视频模拟或语音模拟。
              </p>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-line bg-white/90 p-6 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">问题清单</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">基于快照生成的面试问题</h2>
              </div>
              <div className="rounded-full border border-line bg-paper px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                {prep.questions.length} 题
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {prep.questions.map((question, index) => (
                <article key={question.id} className="rounded-[1.5rem] border border-line bg-paper p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-[75%]">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Question {index + 1}</p>
                      <h3 className="mt-2 text-base font-semibold leading-7 text-slate-950">{question.questionText}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-line bg-white px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {renderSourceLabel(question.sourceType)}
                      </span>
                      <form action={toggleFavoriteAction}>
                        <input type="hidden" name="prepId" value={prep.id} />
                        <input type="hidden" name="recordId" value={record.id} />
                        <input type="hidden" name="questionId" value={question.id} />
                        <button
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            question.favorite
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-line bg-white text-slate-600 hover:border-accent hover:text-accent"
                          }`}
                          type="submit"
                        >
                          <Star size={12} fill={question.favorite ? "currentColor" : "none"} />
                          {question.favorite ? "已收藏" : "收藏"}
                        </button>
                      </form>
                    </div>
                  </div>

                  <form action={saveAnswerAction} className="mt-4 grid gap-3">
                    <input type="hidden" name="prepId" value={prep.id} />
                    <input type="hidden" name="recordId" value={record.id} />
                    <input type="hidden" name="questionId" value={question.id} />
                    <textarea
                      className="min-h-28 rounded-[1.2rem] border border-line bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-accent"
                      defaultValue={question.answerDraft}
                      name="answerDraft"
                      placeholder="写下答案草稿，尽量保持事实准确、表达简洁。"
                    />
                    <button
                      className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                      type="submit"
                    >
                      <CheckCircle2 size={16} />
                      保存答案草稿
                    </button>
                  </form>

                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    来源：{renderSourceLabel(question.sourceType)}
                    {question.sourceRef ? ` · ${question.sourceRef}` : ""}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-[1.35rem] border border-line bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <BookOpen size={16} className="text-accent" />
                说明
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                问题、收藏和答案草稿都挂在同一条投递记录上，后续可以继续扩展为复盘和提醒。
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function renderInterviewStatus(status?: string) {
  switch (status) {
    case "preparing":
      return "准备中";
    case "scheduled":
      return "已安排";
    case "finished":
      return "已完成";
    default:
      return "未开始";
  }
}

function renderSourceLabel(sourceType: string) {
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
