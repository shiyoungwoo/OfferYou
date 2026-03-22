import { randomUUID } from "node:crypto";
import { readWorkspaceDraft, saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";

export type SuggestionActionInput = {
  draftId: string;
  suggestionId: string;
  action: "accept" | "reject" | "revise";
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
    await saveWorkspaceDraft(draft);
    return { status: suggestion.status, suggestion };
  }

  if (input.action === "reject") {
    suggestion.status = "rejected";
    await saveWorkspaceDraft(draft);
    return { status: suggestion.status, suggestion };
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
    parentSuggestionId: suggestion.id,
    revisionRound: suggestion.revisionRound + 1,
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
    return `${afterText} Make the impact more concrete and specific.`;
  }

  if (feedbackType === "too_aggressive") {
    return `${afterText} Reduce claim intensity and stay closer to the original evidence.`;
  }

  if (feedbackType === "adding_new_fact" && feedbackText) {
    return `${afterText} Integrate the new confirmed source material once it passes fact review: ${feedbackText}`;
  }

  if (feedbackText) {
    return `${afterText} Revision note: ${feedbackText}`;
  }

  return `${afterText} Revise the phrasing while keeping the evidence unchanged.`;
}

function buildRevisionReason(feedbackType?: SuggestionActionInput["feedbackType"], feedbackText?: string) {
  if (feedbackType && feedbackText) {
    return `Revision requested due to ${feedbackType}: ${feedbackText}`;
  }

  if (feedbackType) {
    return `Revision requested due to ${feedbackType}.`;
  }

  return "Revision requested by user feedback.";
}
