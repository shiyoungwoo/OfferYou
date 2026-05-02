import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { readWorkspaceDraft, saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { generateSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";

export const dynamic = "force-dynamic";

export type SuggestionActionInput = {
  draftId: string;
  suggestionId: string;
  action: "accept" | "reject" | "revise";
  afterText?: string;
  reasonText?: string;
  feedbackType?: "too_generic" | "too_aggressive" | "not_my_style" | "fact_inaccurate" | "wrong_focus" | "adding_new_fact" | "custom";
  feedbackText?: string;
};

export async function applySuggestionAction(input: SuggestionActionInput) {
  const draft = await readWorkspaceDraft(input.draftId);

  if (!draft) {
    throw new Error("Draft not found.");
  }

  const suggestion = draft.suggestions.find((item) => item.id === input.suggestionId);

  if (!suggestion) {
    throw new Error("Suggestion not found.");
  }

  if (input.action === "accept") {
    suggestion.status = "accepted";
    if (input.afterText?.trim()) {
      suggestion.afterText = input.afterText.trim();
      suggestion.acceptedAfterText = input.afterText.trim();
    }
    if (input.reasonText?.trim()) {
      suggestion.reasonText = input.reasonText.trim();
      suggestion.acceptedReasonText = input.reasonText.trim();
    }
    await saveWorkspaceDraft(draft);

    try {
      await generateSnapshotForDraft(input.draftId);
      revalidatePath(`/applications/${input.draftId}`);
      revalidatePath(`/applications/${input.draftId}/preview`);
      return { status: suggestion.status, suggestion, snapshotSynced: true as const };
    } catch (error) {
      return {
        status: suggestion.status,
        suggestion,
        snapshotSynced: false as const,
        snapshotSyncReason: error instanceof Error ? error.message : "自动同步预览失败。"
      };
    }
  }

  if (input.action === "reject") {
    suggestion.status = "rejected";
    await saveWorkspaceDraft(draft);

    try {
      await generateSnapshotForDraft(input.draftId);
      revalidatePath(`/applications/${input.draftId}`);
      revalidatePath(`/applications/${input.draftId}/preview`);
      return { status: suggestion.status, suggestion, snapshotSynced: true as const };
    } catch (error) {
      return {
        status: suggestion.status,
        suggestion,
        snapshotSynced: false as const,
        snapshotSyncReason: error instanceof Error ? error.message : "自动同步预览失败。"
      };
    }
  }

  suggestion.userFeedbackType = input.feedbackType;
  suggestion.userFeedbackText = input.feedbackText;

  const childSuggestion = {
    id: `revision-${randomUUID()}`,
    section: suggestion.section,
    title: suggestion.title,
    beforeText: suggestion.beforeText,
    afterText: reviseAfterText(suggestion.afterText, input.feedbackType, input.feedbackText),
    reasonText: buildRevisionReason(input.feedbackType, input.feedbackText),
    status: "pending" as const,
    sourceKind: "revision" as const,
    sourceLabel: `Revision of ${suggestion.sourceLabel}`,
    candidateId: suggestion.candidateId,
    jdAbility: suggestion.jdAbility,
    factAnchors: suggestion.factAnchors,
    verification: suggestion.verification,
    generationMode: suggestion.generationMode,
    modelProvider: suggestion.modelProvider,
    parentSuggestionId: suggestion.id,
    revisionRound: (suggestion.revisionRound ?? 0) + 1,
    userFeedbackType: input.feedbackType,
    userFeedbackText: input.feedbackText
  };

  draft.suggestions.push(childSuggestion);

  if (input.feedbackType === "adding_new_fact" && input.feedbackText) {
    draft.factSubmissions.push({
      id: `fact-submission-${randomUUID()}`,
      relatedSuggestionId: suggestion.id,
      submissionText: input.feedbackText,
      sourceType: "user_feedback",
      truthConfirmed: false,
      reusableForMaster: false,
      status: "pending_confirmation"
    });
  }

  await saveWorkspaceDraft(draft);

  return {
    status: "needs_revision" as const,
    suggestion,
    childSuggestion
  };
}

function reviseAfterText(afterText: string, feedbackType?: SuggestionActionInput["feedbackType"], feedbackText?: string) {
  if (feedbackType === "too_generic") {
    return `${afterText}\n请把结果、动作和证据写得更具体，但不要新增未经确认的事实。`;
  }

  if (feedbackType === "too_aggressive") {
    return `${afterText}\n请降低表述强度，更贴近原始经历中的可核验事实。`;
  }

  if (feedbackType === "adding_new_fact" && feedbackText) {
    return `${afterText}\n待事实确认后，可补入这条新材料：${feedbackText}`;
  }

  if (feedbackText) {
    return `${afterText}\n微调要求：${feedbackText}`;
  }

  return `${afterText}\n请在不改变事实的前提下，调整为更适合投递的表达。`;
}

function buildRevisionReason(feedbackType?: SuggestionActionInput["feedbackType"], feedbackText?: string) {
  if (feedbackType && feedbackText) {
    return `用户要求微调：${feedbackType}，补充说明：${feedbackText}`;
  }

  if (feedbackType) {
    return `用户要求微调：${feedbackType}。`;
  }

  return "用户要求继续微调。";
}
