import { listWorkspaceDrafts, readWorkspaceDraft, saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import type { FactSubmissionCardData } from "@/components/master/fact-submission-review-card";
import { DEFAULT_USER_ID } from "@/lib/default-user";
import { createMasterFact } from "@/lib/services/master/master-service";

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
    submission.truthConfirmed = input.action === "confirm";
    submission.reusableForMaster = input.action === "confirm";

    if (input.action === "confirm") {
      const fact = buildMasterFactFromSubmission(submission.submissionText);
      await createMasterFact({
        userId: DEFAULT_USER_ID,
        title: fact.title,
        summary: fact.summary,
        blockType: fact.blockType,
        integrityNoticeConfirmedAt: new Date().toISOString()
      });
    }

    await saveWorkspaceDraft(draft);

    return {
      submissionId: input.submissionId,
      status: submission.status
    };
  }

  throw new Error("Fact submission not found.");
}

function buildMasterFactFromSubmission(submissionText: string) {
  const normalized = submissionText.replace(/\s+/g, " ").trim();
  const summary = normalized.endsWith(".") ? normalized : `${normalized}.`;
  const titleSource = normalized
    .replace(/^[Ii]\s+also\s+/, "")
    .replace(/^[Ii]\s+/, "")
    .replace(/[.?!].*$/, "");
  const title = toTitleCase(titleSource || "User confirmed fact");

  return {
    title,
    summary,
    blockType: "project" as const
  };
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
