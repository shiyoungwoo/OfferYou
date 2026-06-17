"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { buildCareerNavigation } from "@/lib/services/talent/career-navigation";
import {
  buildTalentProfile,
  type TalentExcavationTurn,
  type TalentPromptAnswers,
  type TalentProfile,
  normalizeTalentExcavationTurns
} from "@/lib/services/talent/talent-profile";
import type {
  CareerNavigationRecord,
  TalentExcavationDraftRecord,
  TalentProfileRecord
} from "@/lib/services/talent/talent-profile-service";

const fieldClassName =
  "w-full rounded-[1.4rem] border border-line bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-accent";
const excavationDraftStorageKey = "offeryou:talent-excavation-draft:v1";
const minExcavationTurnsToFinalize = 4;
const recommendedExcavationTurnsStart = 6;
const recommendedExcavationTurnsEnd = 8;
const maxExcavationTurns = 10;

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
type TalentExcavationAnchor = NonNullable<TalentExcavationTurn["requiredAnchor"]>;
type TalentExcavationQuestionResponse = {
  type: "question";
  question: string;
  reflection: string;
  requiredAnchor: TalentExcavationAnchor;
  progress: {
    current: number;
    max: number;
    canFinalize: boolean;
  };
  generationMode: "model" | "model_repaired" | "deterministic_fallback";
  modelProvider?: string;
  riskNotes?: string[];
};
type TalentExcavationFinalResponse = {
  type: "final";
  profile: TalentProfile;
  talentManual: string;
  generationMode: "model" | "model_repaired" | "deterministic_fallback";
  modelProvider?: string;
  riskNotes?: string[];
};

type TalentProfileWorkbenchProps = {
  initialConfirmedTalentProfile?: TalentProfileRecord | null;
  initialConfirmedCareerNavigation?: CareerNavigationRecord | null;
  initialExcavationDraft?: TalentExcavationDraftRecord | null;
};

type TalentExcavationDraft = {
  turns: TalentExcavationTurn[];
  talentManual?: string;
  profile?: TalentProfile;
  updatedAt: string;
};

export function TalentProfileWorkbench({
  initialConfirmedTalentProfile,
  initialConfirmedCareerNavigation,
  initialExcavationDraft
}: TalentProfileWorkbenchProps) {
  const initialMode = detectMode(initialConfirmedTalentProfile?.answers) ?? "radar";
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>(initialMode);
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
  const [excavationTurns, setExcavationTurns] = useState<TalentExcavationTurn[]>(
    () => normalizeTalentExcavationTurns(initialConfirmedTalentProfile?.answers.excavationTranscript)
  );
  const [currentExcavationQuestion, setCurrentExcavationQuestion] =
    useState<TalentExcavationQuestionResponse | null>(null);
  const [currentExcavationAnswer, setCurrentExcavationAnswer] = useState("");
  const [isQuestionLoading, setIsQuestionLoading] = useState(false);
  const [isManualGenerating, setIsManualGenerating] = useState(false);
  const [excavationRiskNotes, setExcavationRiskNotes] = useState<string[]>([]);
  const [isExcavationDraftHydrated, setIsExcavationDraftHydrated] = useState(false);
  const lastExcavationQuestionRequestKeyRef = useRef<string | null>(null);
  const [isSavingTalent, startSavingTalent] = useTransition();
  const [isSavingNavigation, startSavingNavigation] = useTransition();

  const careerNavigationPreview = useMemo(
    () => (confirmedTalentProfile ? buildCareerNavigation(confirmedTalentProfile.profile) : null),
    [confirmedTalentProfile]
  );
  const deepSummary = useMemo(() => buildDeepDiscoverySummary(activeAnswers, profile), [activeAnswers, profile]);
  const navigationToRender = confirmedCareerNavigation?.navigation ?? careerNavigationPreview;
  const canFinalizeExcavation =
    excavationTurns.length >= minExcavationTurnsToFinalize ||
    Boolean(currentExcavationQuestion?.progress.canFinalize && excavationTurns.length >= minExcavationTurnsToFinalize);
  const excavationProgressLabel = buildExcavationProgressLabel(
    excavationTurns.length,
    Boolean(currentExcavationQuestion?.progress.canFinalize)
  );

  useEffect(() => {
    const draft = normalizeExcavationDraft(initialExcavationDraft) ?? readExcavationDraft();
    const hasServerTranscript = Boolean(initialConfirmedTalentProfile?.answers.excavationTranscript?.length);

    if (!hasServerTranscript && draft?.turns.length) {
      const nextAnswers: TalentPromptAnswers = {
        discoveryMode: "deep",
        excavationTranscript: draft.turns,
        talentManual: draft.talentManual
      };
      setDiscoveryMode("deep");
      setExcavationTurns(draft.turns);
      setAnswers((current) => ({
        ...current,
        ...nextAnswers
      }));
      setProfile(draft.profile ?? buildTalentProfile(nextAnswers));
      setCurrentExcavationQuestion(null);
      setStatusMessage("已恢复未保存的深度填写草稿。");
    }

    setIsExcavationDraftHydrated(true);
  }, [initialConfirmedTalentProfile?.answers.excavationTranscript, initialExcavationDraft]);

  useEffect(() => {
    if (!isExcavationDraftHydrated || discoveryMode !== "deep") {
      return;
    }

    if (excavationTurns.length === 0 && !profile.talentManual) {
      return;
    }

    writeExcavationDraft({
      turns: excavationTurns,
      talentManual: profile.talentManual,
      profile,
      updatedAt: new Date().toISOString()
    });
    void syncExcavationDraft({
      turns: excavationTurns,
      talentManual: profile.talentManual,
      profile,
      updatedAt: new Date().toISOString()
    });
  }, [discoveryMode, excavationTurns, isExcavationDraftHydrated, profile]);

  useEffect(() => {
    if (
      !isExcavationDraftHydrated ||
      discoveryMode !== "deep" ||
      currentExcavationQuestion ||
      isQuestionLoading ||
      excavationTurns.length >= maxExcavationTurns ||
      profile.talentManual
    ) {
      return;
    }

    const normalizedTurns = normalizeTalentExcavationTurns(excavationTurns);
    const requestKey = buildExcavationQuestionRequestKey(normalizedTurns);
    if (lastExcavationQuestionRequestKeyRef.current === requestKey) {
      return;
    }

    lastExcavationQuestionRequestKeyRef.current = requestKey;
    void requestNextExcavationQuestion(normalizedTurns);
  }, [
    currentExcavationQuestion,
    discoveryMode,
    excavationTurns,
    isExcavationDraftHydrated,
    isQuestionLoading,
    profile.talentManual
  ]);

  function updateAnswer(key: keyof TalentPromptAnswers, value: string) {
    setAnswers((current) => ({
      ...current,
      [key]: value,
      discoveryMode
    }));
  }

  function switchMode(mode: DiscoveryMode) {
    setDiscoveryMode(mode);
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

  async function requestNextExcavationQuestion(turns: TalentExcavationTurn[]) {
    const normalizedTurns = normalizeTalentExcavationTurns(turns);
    lastExcavationQuestionRequestKeyRef.current = buildExcavationQuestionRequestKey(normalizedTurns);
    setIsQuestionLoading(true);
    setExcavationRiskNotes([]);

    try {
      const response = await fetch("/api/talent/excavation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "next_question",
          turns: normalizedTurns
        })
      });
      const result = (await response.json()) as TalentExcavationQuestionResponse | { error?: unknown };

      if (!response.ok || !("type" in result) || result.type !== "question") {
        setExcavationRiskNotes(["深度追问启动失败，请稍后再试。"]);
        return;
      }

      if (!result.question) {
        setCurrentExcavationQuestion(null);
        setExcavationRiskNotes(result.riskNotes ?? ["模型暂不可用，无法进行深度追问。"]);
        return;
      }

      setCurrentExcavationQuestion(result);
      setCurrentExcavationAnswer("");
      setExcavationRiskNotes(result.riskNotes ?? []);
    } catch {
      setExcavationRiskNotes(["深度追问请求失败，请检查模型配置或稍后再试。"]);
    } finally {
      setIsQuestionLoading(false);
    }
  }

  async function handleSubmitExcavationAnswer() {
    if (!currentExcavationQuestion || currentExcavationAnswer.trim().length < 10) {
      setExcavationRiskNotes(["请先补充一段更具体的回答。"]);
      return;
    }

    const nextTurns = normalizeTalentExcavationTurns([
      ...excavationTurns,
      {
        question: currentExcavationQuestion.question,
        answer: currentExcavationAnswer.trim(),
        reflection: currentExcavationQuestion.reflection,
        requiredAnchor: currentExcavationQuestion.requiredAnchor
      }
    ]);
    const nextProfile = buildTalentProfile({
      discoveryMode: "deep",
      excavationTranscript: nextTurns
    });
    const nextDraft = {
      turns: nextTurns,
      talentManual: profile.talentManual,
      profile: nextProfile,
      updatedAt: new Date().toISOString()
    };

    setExcavationTurns(nextTurns);
    setAnswers((current) => ({
      ...current,
      discoveryMode: "deep",
      excavationTranscript: nextTurns
    }));
    setProfile(nextProfile);
    writeExcavationDraft(nextDraft);
    void syncExcavationDraft(nextDraft);
    setStatusMessage(null);

    if (nextTurns.length >= maxExcavationTurns) {
      setCurrentExcavationQuestion(null);
      setExcavationRiskNotes(["已经达到深度填写上限，可以生成天赋说明书。"]);
      return;
    }

    await requestNextExcavationQuestion(nextTurns);
  }

  async function handleFinalizeExcavation() {
    if (!canFinalizeExcavation) {
      setExcavationRiskNotes(["至少完成 4 轮关键问题后，再生成天赋说明书。"]);
      return;
    }

    setIsManualGenerating(true);
    setExcavationRiskNotes([]);

    try {
      const response = await fetch("/api/talent/excavation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "finalize",
          turns: excavationTurns
        })
      });
      const result = (await response.json()) as TalentExcavationFinalResponse | { error?: unknown };

      if (!response.ok || !("type" in result) || result.type !== "final") {
        setExcavationRiskNotes([formatExcavationError(result, "天赋说明书生成失败，请稍后再试。")]);
        return;
      }

      const nextAnswers: TalentPromptAnswers = {
        discoveryMode: "deep",
        excavationTranscript: excavationTurns,
        talentManual: result.talentManual
      };
      const nextProfile = {
        ...result.profile,
        talentManual: result.talentManual
      };
      setAnswers((current) => ({
        ...current,
        ...nextAnswers
      }));
      setProfile(nextProfile);
      writeExcavationDraft({
        turns: excavationTurns,
        talentManual: result.talentManual,
        profile: nextProfile,
        updatedAt: new Date().toISOString()
      });
      void syncExcavationDraft({
        turns: excavationTurns,
        talentManual: result.talentManual,
        profile: nextProfile,
        updatedAt: new Date().toISOString()
      });
      setStatusMessage("天赋说明书已生成，可以保存为当前优势档案。");
      setExcavationRiskNotes(result.riskNotes ?? []);
    } catch {
      setExcavationRiskNotes(["天赋说明书生成请求失败，请检查模型配置或稍后再试。"]);
    } finally {
      setIsManualGenerating(false);
    }
  }

  function handleConfirmTalentProfile() {
    startSavingTalent(async () => {
      setError(null);
      setStatusMessage(null);
      const answersToConfirm: TalentPromptAnswers =
        discoveryMode === "deep"
          ? {
              ...activeAnswers,
              discoveryMode: "deep",
              excavationTranscript: excavationTurns,
              talentManual: profile.talentManual
            }
          : activeAnswers;

      const response = await fetch("/api/talent/profile/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          answers: answersToConfirm
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
      if (discoveryMode === "deep") {
        clearExcavationDraft();
        void deleteSyncedExcavationDraft();
      }
      setStatusMessage(
        discoveryMode === "deep"
          ? "深度档案已保存。"
          : "优势档案已保存。"
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
      <div className="grid items-start gap-6">
        <form className="grid auto-rows-max content-start gap-5 rounded-[2rem] border border-line bg-white/90 p-7 shadow-card" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-accent">优势档案</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                {discoveryMode === "deep" ? "深度填写" : "快速填写"}
              </h2>
            </div>
            <div className="flex w-fit rounded-full border border-line bg-paper p-1">
              <TrackSwitchButton
                isActive={discoveryMode === "radar"}
                label="快速填写"
                onClick={() => switchMode("radar")}
              />
              <TrackSwitchButton
                isActive={discoveryMode === "deep"}
                label="深度填写"
                onClick={() => switchMode("deep")}
              />
            </div>
          </div>

          {discoveryMode === "radar" ? (
            <>
              <div>
                <h3 className="text-3xl font-semibold">回答 3 个问题，生成第一版优势档案。</h3>
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
                <h3 className="text-3xl font-semibold">逐轮回答问题，生成天赋说明书。</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  4 轮后可生成基础版，6 到 8 轮通常更稳，10 轮只是上限。
                </p>
              </div>

              {excavationTurns.length > 0 ? (
                <div className="grid gap-3 rounded-[1.5rem] border border-line bg-paper px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">已完成 {excavationTurns.length} 轮回答</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                      {excavationProgressLabel}
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {excavationTurns.slice(-3).map((turn, index) => (
                      <article key={`${turn.requiredAnchor ?? "turn"}-${index}`} className="rounded-[1.1rem] bg-white px-4 py-3">
                        <p className="text-xs font-semibold text-slate-500">上一轮问题</p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">{turn.question}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-900">{turn.answer}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {currentExcavationQuestion ? (
                <>
                  <div className="rounded-[1.5rem] border border-line bg-paper px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        第 {currentExcavationQuestion.progress.current} 轮追问
                      </p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                        {currentExcavationQuestion.generationMode === "deterministic_fallback" ? "基础追问" : "AI 深度追问"}
                      </span>
                    </div>
                    {currentExcavationQuestion.reflection ? (
                      <p className="mt-3 text-sm leading-6 text-slate-700">{currentExcavationQuestion.reflection}</p>
                    ) : null}
                    <p className="mt-4 text-lg font-semibold leading-8 text-slate-950">
                      {currentExcavationQuestion.question}
                    </p>
                  </div>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    回答
                    <textarea
                      className={`${fieldClassName} min-h-44 resize-y`}
                      name="currentExcavationAnswer"
                      onChange={(event) => setCurrentExcavationAnswer(event.target.value)}
                      value={currentExcavationAnswer}
                    />
                  </label>
                </>
              ) : null}

              {excavationRiskNotes.length > 0 ? (
                <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                  {excavationRiskNotes.map((note, index) => (
                    <p key={stableListKey("excavation-risk", note, index)}>{note}</p>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"
                  disabled={isQuestionLoading || isManualGenerating || !currentExcavationQuestion}
                  onClick={handleSubmitExcavationAnswer}
                  type="button"
                >
                  {isQuestionLoading ? "追问中..." : "提交并继续追问"}
                </button>
                <button
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-40"
                  disabled={isQuestionLoading || isManualGenerating || !canFinalizeExcavation}
                  onClick={handleFinalizeExcavation}
                  type="button"
                >
                  {isManualGenerating
                    ? "正在生成说明书..."
                    : canFinalizeExcavation ? "生成天赋说明书" : "完成 4 轮后生成"}
                </button>
              </div>
            </>
          )}

          {discoveryMode === "radar" ? (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
              <button
                className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                type="submit"
              >
                生成优势档案
              </button>
            </div>
          ) : null}
        </form>

        <section className="grid auto-rows-max content-start gap-5 rounded-[2rem] border border-slate-200 bg-[#fffdf8] p-7 shadow-card">
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
                disabled={isSavingTalent || (discoveryMode === "deep" && !profile.talentManual)}
                onClick={handleConfirmTalentProfile}
                type="button"
              >
                {isSavingTalent
                  ? "保存中..."
                  : discoveryMode === "deep"
                    ? profile.talentManual ? "保存为当前深度档案" : "先生成天赋说明书"
                    : "确认当前优势档案"}
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
                {deepSummary.clues.map((item, index) => (
                  <li key={stableListKey("deep-clue", item, index)} className="rounded-[1.1rem] bg-paper px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          {profile.talentManual ? (
            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <h4 className="text-sm uppercase tracking-[0.2em] text-slate-500">个人天赋使用说明书</h4>
              <TalentManualContent content={profile.talentManual} />
            </article>
          ) : null}

          <div className="grid items-start gap-5 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <h4 className="text-sm uppercase tracking-[0.2em] text-slate-500">已识别优势信号</h4>
              <div className="mt-4 grid gap-4">
                {profile.signals.length > 0 ? (
                  profile.signals.map((signal, signalIndex) => (
                    <div key={stableListKey("signal", signal.key, signalIndex)} className="rounded-[1.2rem] bg-paper px-4 py-4">
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
                {profile.workStyle.map((item, index) => (
                  <li key={stableListKey("work-style", item, index)} className="rounded-[1.1rem] bg-paper px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <h4 className="text-sm uppercase tracking-[0.2em] text-slate-500">方向线索</h4>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {profile.suitableDirections.map((item, index) => (
                  <li key={stableListKey("suitable-direction", item, index)} className="rounded-[1.1rem] bg-paper px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <h4 className="text-sm uppercase tracking-[0.2em] text-slate-500">验证提醒</h4>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {profile.cautionNotes.map((item, index) => (
                  <li key={stableListKey("caution-note", item, index)} className="rounded-[1.1rem] bg-paper px-4 py-3">
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
              <p className="text-sm uppercase tracking-[0.3em] text-accent">职业方向</p>
              <h2 className="mt-3 text-3xl font-semibold">推荐方向</h2>
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
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">方向列表</h3>
              {navigationToRender.directions.map((direction, directionIndex) => (
                <article key={stableListKey("career-direction", direction.slug, directionIndex)} className="rounded-[1.5rem] border border-line bg-paper p-5">
                  <h4 className="text-xl font-semibold text-slate-900">{direction.label}</h4>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{direction.rationale}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">注意：{direction.watchOut}</p>
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">岗位</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {direction.suggestedRoles.map((role, roleIndex) => (
                        <Link
                          key={stableListKey(`${direction.slug}-role`, role.title, roleIndex)}
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
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">依据</h3>
                <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                  {navigationToRender.whyTheseDirectionsFit.map((item, index) => (
                    <li key={stableListKey("direction-fit", item, index)} className="rounded-[1.1rem] bg-white px-4 py-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-[1.5rem] border border-line bg-paper p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">注意事项</h3>
                <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                  {navigationToRender.watchOuts.map((item, index) => (
                    <li key={stableListKey("direction-watchout", item, index)} className="rounded-[1.1rem] bg-white px-4 py-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-[1.5rem] border border-line bg-paper p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">操作</h3>
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
    discoveryMode: detectMode(answers) ?? "radar",
    excavationTranscript: normalizeTalentExcavationTurns(answers.excavationTranscript)
  };
}

function readExcavationDraft(): TalentExcavationDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(excavationDraftStorageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<TalentExcavationDraft>;
    if (!Array.isArray(parsed.turns)) {
      return null;
    }

    return {
      turns: normalizeTalentExcavationTurns(parsed.turns.filter(isTalentExcavationTurn)),
      talentManual: typeof parsed.talentManual === "string" ? parsed.talentManual : undefined,
      profile: isTalentProfile(parsed.profile) ? parsed.profile : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function normalizeExcavationDraft(draft?: TalentExcavationDraftRecord | TalentExcavationDraft | null): TalentExcavationDraft | null {
  if (!draft?.turns?.length) {
    return null;
  }

  return {
    turns: normalizeTalentExcavationTurns(draft.turns.filter(isTalentExcavationTurn)),
    talentManual: typeof draft.talentManual === "string" ? draft.talentManual : undefined,
    profile: isTalentProfile(draft.profile) ? draft.profile : undefined,
    updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : new Date().toISOString()
  };
}

function writeExcavationDraft(draft: TalentExcavationDraft) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(excavationDraftStorageKey, JSON.stringify(draft));
  } catch {
    // 本地草稿只是防刷新丢失的保护层，写入失败不阻断主流程。
  }
}

async function syncExcavationDraft(draft: TalentExcavationDraft) {
  if (typeof fetch !== "function") {
    return;
  }

  try {
    await fetch("/api/talent/excavation-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        turns: draft.turns,
        talentManual: draft.talentManual,
        profile: draft.profile
      })
    });
  } catch {
    // 服务端草稿失败时，本地草稿仍能保护刷新恢复。
  }
}

function clearExcavationDraft() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(excavationDraftStorageKey);
  } catch {
    // 忽略本地存储清理失败。
  }
}

async function deleteSyncedExcavationDraft() {
  if (typeof fetch !== "function") {
    return;
  }

  try {
    await fetch("/api/talent/excavation-draft", {
      method: "DELETE"
    });
  } catch {
    // 删除失败不会影响正式档案保存。
  }
}

function isTalentExcavationTurn(value: unknown): value is TalentExcavationTurn {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TalentExcavationTurn>;
  return typeof candidate.question === "string" && typeof candidate.answer === "string";
}

function isTalentProfile(value: unknown): value is TalentProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TalentProfile>;
  return (
    typeof candidate.headline === "string" &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.signals) &&
    Array.isArray(candidate.workStyle) &&
    Array.isArray(candidate.suitableDirections) &&
    Array.isArray(candidate.cautionNotes) &&
    typeof candidate.confidenceNote === "string"
  );
}

function formatExcavationError(result: unknown, fallback: string) {
  const payload = result && typeof result === "object" ? result as { error?: unknown; detail?: unknown } : {};
  const error = typeof payload.error === "string" ? payload.error.trim() : "";
  const detail = typeof payload.detail === "string" ? payload.detail.trim() : "";

  if (error && detail) {
    return `${error}${detail.endsWith("。") ? "" : "。"}${detail}`;
  }

  return error || detail || fallback;
}

function getAnswersForMode(mode: DiscoveryMode, answers: TalentPromptAnswers): TalentPromptAnswers {
  if (mode === "deep") {
    return {
      discoveryMode: "deep",
      excavationTranscript: normalizeTalentExcavationTurns(answers.excavationTranscript),
      talentManual: answers.talentManual
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

  if (answers.excavationTranscript?.length) {
    return "deep";
  }

  return "radar";
}

function buildDeepDiscoverySummary(answers: TalentPromptAnswers, profile: TalentProfile) {
  const transcriptClues = normalizeTalentExcavationTurns(answers.excavationTranscript).slice(-4).map((turn) => {
    const label = anchorLabel(turn.requiredAnchor);
    return `${label}：${shorten(turn.answer)}`;
  });
  const legacyClues = [
    answers.preConditioningMemory ? `早期线索：${shorten(answers.preConditioningMemory)}` : null,
    answers.adultUnconsciousCompetence ? `无意识胜任区：${shorten(answers.adultUnconsciousCompetence)}` : null,
    answers.energyRecharge ? `能量回流点：${shorten(answers.energyRecharge)}` : null,
    answers.jealousyDecode ? `向往方向：${shorten(answers.jealousyDecode)}` : null,
    answers.followUpNotes ? `还需要继续追问：${shorten(answers.followUpNotes)}` : null
  ].filter((item): item is string => Boolean(item));
  const clues = transcriptClues.length > 0 ? transcriptClues : legacyClues;

  return {
    story: `当前最强优势信号：${profile.signals[0]?.label ?? "尚未命名的优势信号"}。`,
    clues
  };
}

function shorten(value: string) {
  const cleaned = value.trim();
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
}

function buildExcavationProgressLabel(turnCount: number, aiCanFinalize: boolean) {
  if (turnCount >= maxExcavationTurns) {
    return "已到上限";
  }

  if (turnCount >= recommendedExcavationTurnsStart && turnCount <= recommendedExcavationTurnsEnd) {
    return aiCanFinalize ? "推荐收口" : "推荐区间";
  }

  if (turnCount >= minExcavationTurnsToFinalize) {
    return aiCanFinalize ? "可以收口" : "可生成";
  }

  return `还差 ${minExcavationTurnsToFinalize - turnCount} 轮`;
}

function buildExcavationQuestionRequestKey(turns: TalentExcavationTurn[]) {
  return normalizeTalentExcavationTurns(turns)
    .map((turn) => `${turn.requiredAnchor ?? "unknown"}:${turn.question}:${turn.answer}`)
    .join("|");
}

function TalentManualContent({ content }: { content: string }) {
  const sections = parseTalentManualSections(content);

  if (sections.length === 0) {
    return (
      <p className="mt-4 text-sm leading-7 text-slate-700">
        {content.trim()}
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-4">
      {sections.map((section, sectionIndex) => (
        <section
          key={stableListKey("talent-manual-section", section.title, sectionIndex)}
          className="rounded-[1.2rem] bg-paper px-4 py-4"
        >
          <h5 className="text-sm font-semibold text-slate-950">{section.title}</h5>
          <div className="mt-3 grid gap-2 text-sm leading-7 text-slate-700">
            {section.items.map((item, itemIndex) => (
              <p key={stableListKey("talent-manual-item", item, itemIndex)}>
                {item}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function parseTalentManualSections(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;

  for (const line of lines) {
    if (isManualDocumentTitle(line)) {
      continue;
    }

    const heading = normalizeManualHeading(line);
    if (heading) {
      if (current && current.items.length > 0) {
        sections.push(current);
      }
      current = { title: heading, items: [] };
      continue;
    }

    if (!current) {
      current = { title: "核心判断", items: [] };
    }
    current.items.push(line.replace(/^[-*•]\s*/, ""));
  }

  if (current && current.items.length > 0) {
    sections.push(current);
  }

  return sections;
}

function isManualDocumentTitle(line: string) {
  return /^《?个人天赋使用说明书》?$/.test(line.replace(/^#{1,4}\s*/, "").trim());
}

function normalizeManualHeading(line: string) {
  const cleaned = line
    .replace(/^#{1,4}\s*/, "")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .replace(/^[-*•]\s*/, "")
    .trim();

  if (cleaned.length > 32) {
    return "";
  }

  if (/[:：]$/.test(cleaned)) {
    return normalizeManualHeadingLabel(cleaned.replace(/[:：]$/, ""));
  }

  if (/^(\d+|[一二三四五六七八九十]+)[.、]\s*/.test(cleaned)) {
    return normalizeManualHeadingLabel(cleaned.replace(/^(\d+|[一二三四五六七八九十]+)[.、]\s*/, ""));
  }

  if (/^(底层天赋|证据|适合环境|适合的?工作环境|不适合环境|不适合的?工作环境|职业方向|使用提醒|核心判断|优势假设|风险提醒)/.test(cleaned)) {
    return normalizeManualHeadingLabel(cleaned);
  }

  return "";
}

function normalizeManualHeadingLabel(value: string) {
  if (/^适合的?工作环境$/.test(value)) {
    return "适合环境";
  }

  if (/^不适合的?工作环境$/.test(value)) {
    return "不适合环境";
  }

  if (value === "职业方向建议") {
    return "职业方向";
  }

  return value;
}

function stableListKey(scope: string, value: string, index: number) {
  return `${scope}-${index}-${value.slice(0, 24)}`;
}

function anchorLabel(anchor?: TalentExcavationAnchor) {
  const labels: Record<TalentExcavationAnchor, string> = {
    early_memory: "早期线索",
    unconscious_competence: "无意识胜任区",
    energy_audit: "能量回流点",
    jealousy_signal: "向往方向",
    follow_up: "继续追问"
  };

  return anchor ? labels[anchor] : "深度回答";
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
