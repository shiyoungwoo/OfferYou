import { executeSqlParams, querySqlParams } from "@/lib/db";
import { composeSnapshotDocument } from "@/lib/services/snapshot/snapshot-composer";
import { readWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import type { ResumeDocument } from "@/lib/document/resume-document";
import { estimateResumePageCount, renderResumeDocumentHtml } from "@/lib/services/export/preview-renderer";
import { measureResumeHtmlPageCount } from "@/lib/services/export/pdf-export-service";
import { generateFinalResumeDraft } from "@/lib/services/snapshot/final-resume-draft-service";
import { parseJsonPayload } from "@/lib/services/persistence/json-payload";

export async function generateSnapshotForDraft(draftId: string) {
  const draft = await readWorkspaceDraft(draftId);

  if (!draft) {
    throw new Error("Draft not found.");
  }

  const acceptedSuggestions = draft.suggestions.filter((suggestion) => suggestion.status === "accepted");
  const document = draft.calibratedResume
    ? await generateFinalResumeDraft({
        calibratedResume: draft.calibratedResume,
        jdText: draft.jdPreview ?? "",
        acceptedSuggestions,
        company: draft.company,
        jobTitle: draft.jobTitle,
        resumeExtractedText: draft.resumeExtractedText
      })
    : await composeSnapshotDocument(draft);
  await saveSnapshotDocument(draftId, document);
  const pageEstimate = await estimateSnapshotPageCount(document);

  return {
    draftId,
    templateKey: document.templateKey,
    snapshotPath: `sqlite://snapshots/${draftId}`,
    pageEstimate,
    document
  };
}

export async function readSnapshotForDraft(draftId: string): Promise<ResumeDocument | null> {
  const rows = await querySqlParams<{ payload_json: string }>(
    "SELECT payload_json FROM snapshots WHERE draft_id = ? LIMIT 1;",
    [draftId]
  );

  if (rows.length === 0) {
    return null;
  }

  const parsed = parseJsonPayload<ResumeDocument>(rows[0].payload_json, "简历快照");
  return parsed.ok ? parsed.value : null;
}

export async function saveSnapshotDocument(draftId: string, document: ResumeDocument) {
  await executeSqlParams(
    `INSERT INTO snapshots (draft_id, template_key, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(draft_id) DO UPDATE SET
       template_key = excluded.template_key,
       payload_json = excluded.payload_json,
       updated_at = CURRENT_TIMESTAMP;`,
    [draftId, document.templateKey, JSON.stringify(document)]
  );
}

async function estimateSnapshotPageCount(document: ResumeDocument) {
  try {
    const html = renderResumeDocumentHtml(document);
    return await measureResumeHtmlPageCount(html);
  } catch (error) {
    if (process.env.OFFERYOU_DEBUG_EXPORT === "1") {
      console.warn(
        "[OfferYou Snapshot] Chromium page measurement failed; falling back to rough page estimate.",
        error instanceof Error ? error.message : error
      );
    }

    return estimateResumePageCount(document);
  }
}
