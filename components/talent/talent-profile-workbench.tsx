"use client";

import Link from "next/link";
import React, { useMemo, useState, useTransition } from "react";
import { buildCareerNavigation } from "@/lib/services/talent/career-navigation";
import { buildTalentProfile, type TalentPromptAnswers, type TalentProfile } from "@/lib/services/talent/talent-profile";
import type {
  CareerNavigationRecord,
  TalentProfileRecord
} from "@/lib/services/talent/talent-profile-service";

const fieldClassName =
  "w-full rounded-[1.4rem] border border-line bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-accent";

const quickStarterAnswers: TalentPromptAnswers = {
  discoveryMode: "radar",
  unconsciousCompetence:
    "工作里我很自然会做的一件事，是把别人觉得很乱的信息快速整理清楚。很多人会觉得事情太多太杂，但我会很快看出重点和下一步。",
  energyAudit:
    "过去半年里，最让我累但又停不下来的，是和人一起把一个复杂问题逐步拆开、推进到落地。身体会累，但脑子会越来越兴奋。",
  jealousySignal:
    "我会羡慕那些能把复杂事情讲清楚、带着团队往前走的人。不是羡慕职位头衔，而是羡慕他们能真正影响别人、让事情发生。"
};

const deepStarterAnswers: TalentPromptAnswers = {
  discoveryMode: "deep",
  preConditioningMemory:
    "16 岁以前，我会很自然地去整理别人说不清楚的事情，也总喜欢追着问为什么。别人有时候觉得我太较真，但我其实只是想把事情弄明白。",
  adultUnconsciousCompetence:
    "成年后我最常低估的一点，是我能很快看懂复杂局面，然后帮别人把混乱重新理顺。我以前一直以为这只是常识，但后来发现很多人并不具备。",
  energyRecharge:
    "最让我累但又想继续做下去的，是和人一起拆解复杂问题、推动真实进展的过程。尤其是当我既要想清楚，也要把大家重新对齐时，我会很有状态。",
  jealousyDecode:
    "我会羡慕那些既有判断力、又能把别人带起来的人。我不是羡慕他们被看见，而是羡慕他们真的活在自己擅长的位置上。",
  followUpNotes:
    "如果继续追问，我想进一步确认的是：我到底更适合在复杂协作中担任推进者，还是更适合站在更上游做结构判断和方向收敛。"
};

type DiscoveryMode = "radar" | "deep";
type DeepStepDefinition = {
  key: keyof TalentPromptAnswers;
  title: string;
  question: string;
  helper: string;
  minHeightClassName?: string;
};

type TalentProfileWorkbenchProps = {
  initialConfirmedTalentProfile?: TalentProfileRecord | null;
  initialConfirmedCareerNavigation?: CareerNavigationRecord | null;
};

export function TalentProfileWorkbench({
  initialConfirmedTalentProfile,
  initialConfirmedCareerNavigation
}: TalentProfileWorkbenchProps) {
  const initialMode = detectMode(initialConfirmedTalentProfile?.answers) ?? "radar";
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>(initialMode);
  const [deepStep, setDeepStep] = useState(0);
  const [answers, setAnswers] = useState<TalentPromptAnswers>(() =>
    initialConfirmedTalentProfile?.answers
      ? normalizeAnswers(initialConfirmedTalentProfile.answers)
      : {
          ...quickStarterAnswers,
          ...deepStarterAnswers,
          discoveryMode: initialMode
        }
  );

  const activeAnswers = useMemo(
    () => getAnswersForMode(discoveryMode, answers),
    [answers, discoveryMode]
  );

  const [profile, setProfile] = useState<TalentProfile>(() =>
    initialConfirmedTalentProfile?.profile ?? buildTalentProfile(activeAnswers)
  );
  const [confirmedTalentProfile, setConfirmedTalentProfile] = useState<TalentProfileRecord | null>(
    initialConfirmedTalentProfile ?? null
  );
  const [confirmedCareerNavigation, setConfirmedCareerNavigation] = useState<CareerNavigationRecord | null>(
    initialConfirmedCareerNavigation ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSavingTalent, startSavingTalent] = useTransition();
  const [isSavingNavigation, startSavingNavigation] = useTransition();

  const careerNavigationPreview = useMemo(
    () => (confirmedTalentProfile ? buildCareerNavigation(confirmedTalentProfile.profile) : null),
    [confirmedTalentProfile]
  );
  const deepSummary = useMemo(() => buildDeepDiscoverySummary(activeAnswers, profile), [activeAnswers, profile]);
  const navigationToRender = confirmedCareerNavigation?.navigation ?? careerNavigationPreview;
  const deepSteps = useMemo<DeepStepDefinition[]>(
    () => [
      {
        key: "preConditioningMemory",
        title: "第 1 题 / 早期线索",
        question: "16 岁以前，在没人要求你的情况下，你会反复去做什么？或者你总因为什么“固执的毛病”被说？",
        helper: "先不要急着讲道理，尽量写具体场景、动作和别人对你的反馈。",
        minHeightClassName: "min-h-40"
      },
      {
        key: "adultUnconsciousCompetence",
        title: "第 2 题 / 无意识胜任区",
        question: "成年后，你有什么一直以为只是常识，但别人其实并不擅长的能力？",
        helper: "可以写一段你以为很普通，但别人明显做不到的事。",
        minHeightClassName: "min-h-40"
      },
      {
        key: "energyRecharge",
        title: "第 3 题 / 能量回血",
        question: "什么活动会让你累，但又像回血一样，做完还想再来一次？",
        helper: "我们想区分“你会做”和“你做完之后真的更有生命力”的差别。",
        minHeightClassName: "min-h-40"
      },
      {
        key: "jealousyDecode",
        title: "第 4 题 / 嫉妒信号",
        question: "你真正会被哪种人生状态刺到？具体是什么让你心里冒出“我也想这样”？",
        helper: "不用正确，只要诚实。嫉妒很多时候是在提醒你，某种天赋还没有被你活出来。",
        minHeightClassName: "min-h-40"
      },
      {
        key: "followUpNotes",
        title: "第 5 题 / 继续追问",
        question: "如果继续追问，你最想搞清楚自己的哪个问题？",
        helper: "这一题帮助我们决定，后面要往哪个方向继续深入。",
        minHeightClassName: "min-h-32"
      }
    ],
    []
  );
  const currentDeepStep = deepSteps[deepStep];
  const currentDeepAnswer =
    discoveryMode === "deep" ? String(answers[currentDeepStep.key] ?? "") : "";
  const deepReflection =
    discoveryMode === "deep" ? buildDeepStepReflection(currentDeepStep.key, currentDeepAnswer) : null;
  const dynamicFollowUp =
    discoveryMode === "deep" ? buildDynamicFollowUpPrompt(answers, profile) : null;

  function updateAnswer(key: keyof TalentPromptAnswers, value: string) {
    setAnswers((current) => ({
      ...current,
      [key]: value,
      discoveryMode
    }));
  }

  function switchMode(mode: DiscoveryMode) {
    setDiscoveryMode(mode);
    setDeepStep(0);
    setError(null);
    setStatusMessage(null);
    const nextAnswers = getAnswersForMode(mode, answers);
    setAnswers((current) => ({
      ...current,
      discoveryMode: mode
    }));
    setProfile(buildTalentProfile(nextAnswers));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);
    setProfile(buildTalentProfile(activeAnswers));
  }

  function handleNextDeepStep() {
    setDeepStep((current) => Math.min(current + 1, deepSteps.length - 1));
  }

  function handlePreviousDeepStep() {
    setDeepStep((current) => Math.max(current - 1, 0));
  }

  function handleConfirmTalentProfile() {
    startSavingTalent(async () => {
      setError(null);
      setStatusMessage(null);

      const response = await fetch("/api/talent/profile/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          answers: activeAnswers
        })
      });

      const result = (await response.json()) as TalentProfileRecord | { error?: unknown };

      if (!response.ok || !("id" in result)) {
        setError("优势档案保存失败了，请检查回答后再试一次。");
        return;
      }

      setConfirmedTalentProfile(result);
      setProfile(result.profile);
      setConfirmedCareerNavigation(null);
      setStatusMessage(
        discoveryMode === "deep"
          ? "深度挖掘结果已沉淀为当前优势档案，下一步可以继续确认职业方向。"
          : "初步挖掘结果已确认，下一步可以继续看职业方向建议。"
      );
    });
  }

  function handleConfirmCareerNavigation() {
    if (!confirmedTalentProfile) {
      return;
    }

    startSavingNavigation(async () => {
      setError(null);
      setStatusMessage(null);

      const response = await fetch("/api/talent/navigation/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          talentProfileId: confirmedTalentProfile.id
        })
      });

      const result = (await response.json()) as CareerNavigationRecord | { error?: unknown };

      if (!response.ok || !("id" in result)) {
        setError("职业方向确认失败了，请稍后再试。");
        return;
      }

      setConfirmedCareerNavigation(result);
      setStatusMessage("职业方向已确认，你现在可以从合适方向进入岗位匹配。");
    });
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[1.75rem] border border-line bg-white/90 p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">发现自己结构</p>
            <h2 className="mt-3 text-2xl font-semibold">先做初步挖掘，再决定要不要进入深度挖掘。</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
              初步挖掘适合 5 分钟快速识别优势信号；深度挖掘适合愿意花 30 到 60 分钟，认真梳理底层天赋、职业方向和长期资料的人。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <TrackSwitchButton
              isActive={discoveryMode === "radar"}
              label="初步挖掘"
              onClick={() => switchMode("radar")}
            />
            <TrackSwitchButton
              isActive={discoveryMode === "deep"}
              label="深度挖掘"
              onClick={() => switchMode("deep")}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-white/90 p-6 shadow-card">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">发现自己流程</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <StageCard
            description={discoveryMode === "deep" ? "进入深度对话，先找底层线索。" : "用 3 个问题快速建立第一版判断。"}
            isDone
            title={discoveryMode === "deep" ? "1. 深度对话" : "1. 初步雷达"}
          />
          <StageCard
            description="把答案整理成一版当前优势档案。"
            isDone={Boolean(confirmedTalentProfile)}
            title="2. 优势档案"
          />
          <StageCard
            description="从优势和能量状态，收敛到更现实的职业方向。"
            isDone={Boolean(confirmedCareerNavigation)}
            title="3. 方向建议"
          />
          <StageCard
            description="带着方向回到岗位匹配，再验证判断是否成立。"
            isDone={Boolean(confirmedCareerNavigation)}
            title="4. 岗位验证"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <form className="grid gap-5 rounded-[2rem] border border-line bg-white/90 p-7 shadow-card" onSubmit={handleSubmit}>
          {discoveryMode === "radar" ? (
            <>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-accent">初步挖掘</p>
                <h2 className="mt-3 text-3xl font-semibold">3 个问题，先快速看到你的优势轮廓。</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">
                  这一档参考的是 `Talent Radar`。目标不是做完整自我分析，而是在 5 分钟内捕捉到足够信号，帮助后面的岗位匹配和简历优化更贴近你。
                </p>
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                1. 在工作或日常生活里，你有什么事情做起来毫不费力，但别人却觉得并不简单？
                <textarea
                  className={`${fieldClassName} min-h-32 resize-y`}
                  name="unconsciousCompetence"
                  onChange={(event) => updateAnswer("unconsciousCompetence", event.target.value)}
                  value={answers.unconsciousCompetence ?? ""}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                2. 回想最近半年，什么事情会让你身体很累，但脑子反而越来越兴奋？
                <textarea
                  className={`${fieldClassName} min-h-32 resize-y`}
                  name="energyAudit"
                  onChange={(event) => updateAnswer("energyAudit", event.target.value)}
                  value={answers.energyAudit ?? ""}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                3. 你会羡慕哪种人？不是嫉妒对方拥有资源，而是那种“我也想活成那样”的刺痛感。
                <textarea
                  className={`${fieldClassName} min-h-32 resize-y`}
                  name="jealousySignal"
                  onChange={(event) => updateAnswer("jealousySignal", event.target.value)}
                  value={answers.jealousySignal ?? ""}
                />
              </label>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-accent">深度挖掘</p>
                <h2 className="mt-3 text-3xl font-semibold">认真挖一次，把那些一直存在但没被命名的天赋找出来。</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">
                  这一档参考的是 `Talent Excavation`。它不只是问你现在会做什么，而是回到更早的倾向、成年后的无意识胜任区、真正回血的状态，以及你羡慕背后的未满足方向。
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-line bg-paper px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{currentDeepStep.title}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                    {deepStep + 1} / {deepSteps.length}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{currentDeepStep.helper}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${((deepStep + 1) / deepSteps.length) * 100}%` }}
                  />
                </div>
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                {currentDeepStep.question}
                <textarea
                  className={`${fieldClassName} ${currentDeepStep.minHeightClassName ?? "min-h-32"} resize-y`}
                  name={String(currentDeepStep.key)}
                  onChange={(event) => updateAnswer(currentDeepStep.key, event.target.value)}
                  value={String(answers[currentDeepStep.key] ?? "")}
                />
              </label>

              {deepReflection ? (
                <div className="rounded-[1.35rem] border border-line bg-paper px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">即时反思</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{deepReflection}</p>
                </div>
              ) : null}

              {dynamicFollowUp && deepStep >= 3 ? (
                <div className="rounded-[1.35rem] border border-dashed border-line bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">系统追问方向</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{dynamicFollowUp}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-40"
                  disabled={deepStep === 0}
                  onClick={handlePreviousDeepStep}
                  type="button"
                >
                  上一题
                </button>
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-40"
                  disabled={deepStep === deepSteps.length - 1}
                  onClick={handleNextDeepStep}
                  type="button"
                >
                  下一题
                </button>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-line bg-paper px-5 py-4">
            <p className="max-w-2xl text-sm leading-6 text-slate-700">
              {discoveryMode === "deep"
                ? "深度挖掘这一版先搭骨架：你可以真实填写、生成结果、保存优势档案，并继续走到职业方向建议。后面我们再逐步把追问质量和说明书做深。"
                : "这是一版轻量雷达，不是给你下最终定义，而是先为后面的职业判断和简历优化补上更贴身的上下文。"}
            </p>
            <button
              className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              type="submit"
            >
              {discoveryMode === "deep" ? "生成深度挖掘结果" : "生成优势档案"}
            </button>
          </div>
        </form>

        <section className="grid gap-5 rounded-[2rem] border border-slate-200 bg-[#fffdf8] p-7 shadow-card">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              {discoveryMode === "deep" ? "深度挖掘结果" : "优势档案"}
            </p>
            <h3 className="mt-3 text-2xl font-semibold leading-tight">{profile.headline}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-700">{profile.summary}</p>
            <p className="mt-4 text-sm font-medium text-slate-600">{profile.confidenceNote}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                disabled={isSavingTalent}
                onClick={handleConfirmTalentProfile}
                type="button"
              >
                {isSavingTalent ? "保存中..." : discoveryMode === "deep" ? "保存为当前深度档案" : "确认当前优势档案"}
              </button>
              {confirmedTalentProfile ? (
                <span className="text-sm font-medium text-emerald-700">已保存为你当前的优势档案。</span>
              ) : null}
            </div>
          </div>

          {discoveryMode === "deep" ? (
            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <h4 className="text-sm uppercase tracking-[0.2em] text-slate-500">深度挖掘摘要</h4>
              <p className="mt-4 text-sm leading-7 text-slate-700">{deepSummary.story}</p>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {deepSummary.clues.map((item) => (
                  <li key={item} className="rounded-[1.1rem] bg-paper px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <h4 className="text-sm uppercase tracking-[0.2em] text-slate-500">已识别优势信号</h4>
              <div className="mt-4 grid gap-4">
                {profile.signals.length > 0 ? (
                  profile.signals.map((signal) => (
                    <div key={signal.key} className="rounded-[1.2rem] bg-paper px-4 py-4">
                      <p className="text-base font-semibold text-slate-900">{signal.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{signal.description}</p>
                      <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                        {signal.evidence.map((item, index) => (
                          <li key={`${signal.key}-${index}`}>"{item}"</li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate-600">再补充更完整的例子，系统才能更稳定地识别你的重复优势。</p>
                )}
              </div>
            </article>

            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <h4 className="text-sm uppercase tracking-[0.2em] text-slate-500">更适合的工作状态</h4>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {profile.workStyle.map((item) => (
                  <li key={item} className="rounded-[1.1rem] bg-paper px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <h4 className="text-sm uppercase tracking-[0.2em] text-slate-500">当前更值得优先尝试的方向</h4>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {profile.suitableDirections.map((item) => (
                  <li key={item} className="rounded-[1.1rem] bg-paper px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <h4 className="text-sm uppercase tracking-[0.2em] text-slate-500">现在先不要太早下结论</h4>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {profile.cautionNotes.map((item) => (
                  <li key={item} className="rounded-[1.1rem] bg-paper px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      </div>

      {confirmedTalentProfile && navigationToRender ? (
        <section className="rounded-[2rem] border border-line bg-white/90 p-7 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accent">职业方向建议</p>
              <h2 className="mt-3 text-3xl font-semibold">把当前结果，继续收敛成更现实的方向建议。</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">{navigationToRender.summary}</p>
            </div>
            <button
              className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
              disabled={isSavingNavigation}
              onClick={handleConfirmCareerNavigation}
              type="button"
            >
              {isSavingNavigation ? "保存中..." : "确认职业方向"}
            </button>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">更适合优先尝试的方向</h3>
              {navigationToRender.directions.map((direction) => (
                <article key={direction.slug} className="rounded-[1.5rem] border border-line bg-paper p-5">
                  <h4 className="text-xl font-semibold text-slate-900">{direction.label}</h4>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{direction.rationale}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">先提醒一句：{direction.watchOut}</p>
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">可以先从这些岗位试水</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {direction.suggestedRoles.map((role) => (
                        <Link
                          key={`${direction.slug}-${role.title}`}
                          className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent"
                          href={`/applications/new?lane=${direction.slug}&role=${encodeURIComponent(role.title)}`}
                        >
                          {role.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                  {confirmedCareerNavigation ? (
                    <Link
                      className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                      href={`/applications/new?lane=${direction.slug}`}
                    >
                      去这个方向做岗位匹配
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="grid gap-4">
              <article className="rounded-[1.5rem] border border-line bg-paper p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">为什么会推荐这些方向</h3>
                <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                  {navigationToRender.whyTheseDirectionsFit.map((item) => (
                    <li key={item} className="rounded-[1.1rem] bg-white px-4 py-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-[1.5rem] border border-line bg-paper p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">当前需要特别留意的地方</h3>
                <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                  {navigationToRender.watchOuts.map((item) => (
                    <li key={item} className="rounded-[1.1rem] bg-white px-4 py-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-[1.5rem] border border-line bg-paper p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">下一步动作</h3>
                <div className="mt-4 grid gap-3">
                  <Link
                    className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                    href="/applications/new"
                  >
                    回到修改简历
                  </Link>
                  <Link
                    className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent"
                    href="/me"
                  >
                    去我的页面查看长期资料
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>
      ) : null}

      {statusMessage ? <p className="text-sm font-medium text-emerald-700">{statusMessage}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}

function normalizeAnswers(answers: TalentPromptAnswers): TalentPromptAnswers {
  return {
    ...quickStarterAnswers,
    ...deepStarterAnswers,
    ...answers,
    discoveryMode: detectMode(answers) ?? "radar"
  };
}

function getAnswersForMode(mode: DiscoveryMode, answers: TalentPromptAnswers): TalentPromptAnswers {
  if (mode === "deep") {
    return {
      discoveryMode: "deep",
      preConditioningMemory: answers.preConditioningMemory ?? deepStarterAnswers.preConditioningMemory,
      adultUnconsciousCompetence:
        answers.adultUnconsciousCompetence ?? deepStarterAnswers.adultUnconsciousCompetence,
      energyRecharge: answers.energyRecharge ?? deepStarterAnswers.energyRecharge,
      jealousyDecode: answers.jealousyDecode ?? deepStarterAnswers.jealousyDecode,
      followUpNotes: answers.followUpNotes ?? deepStarterAnswers.followUpNotes
    };
  }

  return {
    discoveryMode: "radar",
    unconsciousCompetence: answers.unconsciousCompetence ?? quickStarterAnswers.unconsciousCompetence,
    energyAudit: answers.energyAudit ?? quickStarterAnswers.energyAudit,
    jealousySignal: answers.jealousySignal ?? quickStarterAnswers.jealousySignal
  };
}

function detectMode(answers?: TalentPromptAnswers | null): DiscoveryMode | null {
  if (!answers) {
    return null;
  }

  if (answers.discoveryMode) {
    return answers.discoveryMode;
  }

  if (answers.preConditioningMemory || answers.adultUnconsciousCompetence || answers.energyRecharge || answers.jealousyDecode) {
    return "deep";
  }

  return "radar";
}

function buildDeepDiscoverySummary(answers: TalentPromptAnswers, profile: TalentProfile) {
  const clues = [
    answers.preConditioningMemory ? `早期线索：${shorten(answers.preConditioningMemory)}` : null,
    answers.adultUnconsciousCompetence ? `无意识胜任区：${shorten(answers.adultUnconsciousCompetence)}` : null,
    answers.energyRecharge ? `能量回流点：${shorten(answers.energyRecharge)}` : null,
    answers.jealousyDecode ? `向往方向：${shorten(answers.jealousyDecode)}` : null,
    answers.followUpNotes ? `还需要继续追问：${shorten(answers.followUpNotes)}` : null
  ].filter((item): item is string => Boolean(item));

  return {
    story: `这次深度挖掘不是在判断你“适合什么职位名”，而是在回看你更早的倾向、成年后的无意识能力，以及真正让你回血的状态。当前结果显示，你的底层优势更可能来自“${profile.signals[0]?.label ?? "尚未命名的优势信号"}”，接下来最值得做的，是把这些线索继续带回真实岗位验证。`,
    clues
  };
}

function shorten(value: string) {
  const cleaned = value.trim();
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
}

function buildDeepStepReflection(key: keyof TalentPromptAnswers, answer: string) {
  const cleaned = answer.trim();

  if (cleaned.length < 24) {
    return "这里的线索还比较薄。再写具体一点，后面的判断会更稳。";
  }

  if (key === "preConditioningMemory") {
    return "这题不是在找“小时候做过什么”，而是在找你很早就出现、后来一直没消失的倾向。";
  }

  if (key === "adultUnconsciousCompetence") {
    return "如果这件事你总觉得“这不是常识吗”，它往往就不是普通技能，而是你容易低估的底层优势。";
  }

  if (key === "energyRecharge") {
    return cleaned.includes("累") || cleaned.includes("消耗")
      ? "这里已经出现了“累但愿意继续”的信号，这通常比“我会做”更值得重视。"
      : "再试着区分一下：你是因为擅长而完成它，还是做完之后真的更有能量。";
  }

  if (key === "jealousyDecode") {
    return "嫉妒感通常不是坏信号，它常常在提醒你：有一部分自己，还没有真正被活出来。";
  }

  if (key === "followUpNotes") {
    return "这题很重要，它决定了后面深挖时要继续追哪条线，而不是平均用力。";
  }

  return "这里已经有一些可用信号了，继续保持具体，会比抽象概括更有帮助。";
}

function buildDynamicFollowUpPrompt(answers: TalentPromptAnswers, profile: TalentProfile) {
  const signalLabel = profile.signals[0]?.label;
  const joined = [
    answers.preConditioningMemory,
    answers.adultUnconsciousCompetence,
    answers.energyRecharge,
    answers.jealousyDecode,
    answers.followUpNotes
  ]
    .filter(Boolean)
    .join(" ");

  if (!joined.trim()) {
    return null;
  }

  if (joined.includes("团队") || joined.includes("协作") || joined.includes("客户")) {
    return `你前面的回答反复提到了人与人之间的推进关系。下一步最值得继续追问的是：当你在帮助别人推进时，你真正最擅长的是建立信任、理清结构，还是推动决策？${signalLabel ? ` 目前更像在指向“${signalLabel}”。` : ""}`;
  }

  if (joined.includes("分析") || joined.includes("判断") || joined.includes("为什么")) {
    return `你前面的线索里，结构判断和规律提炼比较明显。下一步最值得追问的是：你是更享受自己想明白，还是更享受把别人也带到同一个判断上？${signalLabel ? ` 目前更像在指向“${signalLabel}”。` : ""}`;
  }

  if (joined.includes("推进") || joined.includes("落地") || joined.includes("主导")) {
    return `你前面的回答里，主动推进和把事情带到结果的倾向比较强。下一步可以继续追问：你更适合做前台牵引的人，还是做后台把结构搭稳的人？${signalLabel ? ` 当前线索优先指向“${signalLabel}”。` : ""}`;
  }

  return `当前最值得继续追问的是：这些经历里，哪一种状态最让你感觉“这才是我本来的样子”？${signalLabel ? ` 现阶段最强线索是“${signalLabel}”。` : ""}`;
}

function TrackSwitchButton({
  label,
  isActive,
  onClick
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        isActive
          ? "bg-ink text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:border-accent hover:text-accent"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function StageCard({
  title,
  description,
  isDone
}: {
  title: string;
  description: string;
  isDone: boolean;
}) {
  return (
    <article className="rounded-[1.25rem] border border-line bg-paper px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isDone ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500"
          }`}
        >
          {isDone ? "已完成" : "进行中"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{description}</p>
    </article>
  );
}
