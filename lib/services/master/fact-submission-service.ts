import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readWorkspaceDraft, saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import type { FactSubmissionCardData } from "@/components/master/fact-submission-review-card";

type ApplyFactSubmissionActionInput = {
  submissionId: string;
  action: "confirm" | "reject";
};

export async function listPendingFactSubmissions(): Promise<FactSubmissionCardData[]> {
  const draftsDir = path.join(process.cwd(), "storage", "drafts");

  try {
    const files = await readdir(draftsDir);
    const drafts = await Promise.all(
      files.map(async (file) => {
        const contents = await readFile(path.join(draftsDir, file), "utf8");
        return JSON.parse(contents) as Awaited<ReturnType<typeof readWorkspaceDraft>> extends infer T ? Exclude<T, null> : never;
      })
    );

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
  } catch {
    return [];
  }
}

export async function applyFactSubmissionAction(input: ApplyFactSubmissionActionInput) {
  const draftsDir = path.join(process.cwd(), "storage", "drafts");
  const files = await readdir(draftsDir);

  for (const file of files) {
    const draftId = file.replace(/\.json$/, "");
    const draft = await readWorkspaceDraft(draftId);

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
