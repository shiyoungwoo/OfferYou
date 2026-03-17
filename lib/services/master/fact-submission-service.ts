import { listWorkspaceDrafts, readWorkspaceDraft, saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import type { FactSubmissionCardData } from "@/components/master/fact-submission-review-card";

type ApplyFactSubmissionActionInput = {
  submissionId: string;
  action: "confirm" | "reject";
};

export async function listPendingFactSubmissions(): Promise<FactSubmissionCardData[]> {
  const drafts = await listWorkspaceDrafts();

  return drafts.flatMap((draft) =>
    draft.factSubmissions
      .filter((submission) => submission.status === "pending_confirmation")
      .map((submission) => ({
        id: submission.id,
        submissionText: submission.submissionText,
        sourceType: submission.sourceType,
        relatedSuggestionId: submission.relatedSuggestionId,
        status: submission.status
      }))
  );
}

export async function applyFactSubmissionAction(input: ApplyFactSubmissionActionInput) {
  const drafts = await listWorkspaceDrafts();

  for (const persistedDraft of drafts) {
    const draft = await readWorkspaceDraft(persistedDraft.id);

    if (!draft) {
      continue;
    }

    const submission = draft.factSubmissions.find((item) => item.id === input.submissionId);

    if (!submission) {
      continue;
    }

    submission.status = input.action === "confirm" ? "confirmed" : "rejected";
    await saveWorkspaceDraft(draft);

    return {
      submissionId: input.submissionId,
      status: submission.status
    };
  }

  throw new Error("Fact submission not found.");
}
