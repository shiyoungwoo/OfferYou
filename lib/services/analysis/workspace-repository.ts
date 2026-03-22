import { executeSql, querySql, sqlString } from "@/lib/db";

export type PersistedWorkspaceDraft = {
  id: string;
  userId: string;
  company: string;
  jobTitle: string;
  language: string;
  stage: "analysis_ready";
  status: "created";
  jdPreview: string;
  jdAsset: {
    storagePath: string;
    mimeType: string;
    originalFilename: string;
  };
  resumeSourceRef?: string;
  profilePhotoAssetRef?: string;
  resumeExtractedText: string;
  analysis: {
    fitScore: number;
    optimizationMode: "baseline_jd_match" | "talent_amplified";
    strengths: string[];
    gaps: string[];
    riskNotes: string[];
  };
  talentProfileUsed?: {
    id: string;
    headline: string;
    confidenceNote: string;
  };
  careerDirectionUsed?: {
    id: string;
    slug: string;
    label: string;
    rationale: string;
    watchOut: string;
  };
  masterFactsUsed: Array<{
    id: string;
    title: string;
    summary: string;
    blockType: "summary" | "experience" | "project" | "education" | "skill" | "certificate" | "other";
  }>;
  suggestions: Array<{
    id: string;
    section: string;
    title: string;
    beforeText: string;
    afterText: string;
    reasonText: string;
    status: "pending" | "accepted" | "rejected";
    sourceKind: "resume_baseline" | "master_fact" | "target_role_fit" | "revision";
    sourceLabel: string;
    parentSuggestionId?: string;
    revisionRound: number;
    userFeedbackType?: string;
    userFeedbackText?: string;
  }>;
  factSubmissions: Array<{
    id: string;
    relatedSuggestionId?: string;
    submissionText: string;
    factType?: string;
    sourceType: "user_feedback";
    truthConfirmed: boolean;
    reusableForMaster: boolean;
    status: "pending_confirmation" | "confirmed" | "rejected";
  }>;
};

export async function saveWorkspaceDraft(draft: PersistedWorkspaceDraft) {
  const payload = sqlString(JSON.stringify(draft));
  const company = sqlString(draft.company);
  const jobTitle = sqlString(draft.jobTitle);
  const userId = sqlString(draft.userId);

  await executeSql(`
    INSERT INTO workspace_drafts (id, user_id, company, job_title, payload_json, created_at, updated_at)
    VALUES (${sqlString(draft.id)}, ${userId}, ${company}, ${jobTitle}, ${payload}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      company = excluded.company,
      job_title = excluded.job_title,
      payload_json = excluded.payload_json,
      updated_at = CURRENT_TIMESTAMP;
  `);
}

export async function readWorkspaceDraft(draftId: string): Promise<PersistedWorkspaceDraft | null> {
  const rows = await querySql<{ payload_json: string }>(
    `SELECT payload_json FROM workspace_drafts WHERE id = ${sqlString(draftId)} LIMIT 1;`
  );

  if (rows.length === 0) {
    return null;
  }

  return JSON.parse(rows[0].payload_json) as PersistedWorkspaceDraft;
}

export async function listWorkspaceDrafts(): Promise<PersistedWorkspaceDraft[]> {
  const rows = await querySql<{ payload_json: string }>(
    "SELECT payload_json FROM workspace_drafts ORDER BY updated_at DESC;"
  );

  return rows.map((row) => JSON.parse(row.payload_json) as PersistedWorkspaceDraft);
}
