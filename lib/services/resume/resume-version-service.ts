import { randomUUID } from "node:crypto";
import type { ResumeDocument, ResumeTemplateKey } from "@/lib/document/resume-document";
import { executeSql, executeSqlParams, querySqlParams } from "@/lib/db";
import { parseJsonPayload } from "@/lib/services/persistence/json-payload";

export type ResumeVersionSourceType = "manual_save" | "pdf_export" | "snapshot_generation";

export type ResumeVersion = {
  id: string;
  userId: string;
  draftId: string;
  title: string;
  targetTitle: string;
  templateKey: ResumeTemplateKey;
  sourceType: ResumeVersionSourceType;
  document: ResumeDocument;
  pdfStoragePath?: string;
  createdAt: string;
  updatedAt: string;
};

export async function saveResumeVersionForDraft(input: {
  userId: string;
  draftId: string;
  document: ResumeDocument;
  sourceType: ResumeVersionSourceType;
  pdfStoragePath?: string;
}): Promise<ResumeVersion> {
  await ensureResumeVersionsTable();
  const existing = await readResumeVersionByDraft(input.draftId);
  const now = new Date().toISOString();
  const version: ResumeVersion = {
    id: existing?.id ?? `resume-${randomUUID()}`,
    userId: input.userId,
    draftId: input.draftId,
    title: buildResumeVersionTitle(input.document),
    targetTitle: input.document.header.title?.trim() || "未填写目标岗位",
    templateKey: input.document.templateKey,
    sourceType: input.sourceType,
    document: input.document,
    pdfStoragePath: input.pdfStoragePath ?? existing?.pdfStoragePath,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  await executeSqlParams(
    `INSERT INTO resume_versions (
       id,
       user_id,
       draft_id,
       title,
       target_title,
       template_key,
       source_type,
       document_json,
       pdf_storage_path,
       created_at,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(draft_id) DO UPDATE SET
       user_id = excluded.user_id,
       title = excluded.title,
       target_title = excluded.target_title,
       template_key = excluded.template_key,
       source_type = excluded.source_type,
       document_json = excluded.document_json,
       pdf_storage_path = excluded.pdf_storage_path,
       updated_at = excluded.updated_at;`,
    [
      version.id,
      version.userId,
      version.draftId,
      version.title,
      version.targetTitle,
      version.templateKey,
      version.sourceType,
      JSON.stringify(version.document),
      version.pdfStoragePath ?? null,
      version.createdAt,
      version.updatedAt
    ]
  );

  return version;
}

export async function readResumeVersionByDraft(draftId: string): Promise<ResumeVersion | null> {
  await ensureResumeVersionsTable();
  const rows = await querySqlParams<ResumeVersionRow>(
    "SELECT * FROM resume_versions WHERE draft_id = ? LIMIT 1;",
    [draftId]
  );

  return rows[0] ? rowToResumeVersion(rows[0]) : null;
}

export async function listResumeVersions(userId: string, limit = 20): Promise<ResumeVersion[]> {
  await ensureResumeVersionsTable();
  await backfillResumeVersionsFromSnapshots(userId);
  const rows = await querySqlParams<ResumeVersionRow>(
    `SELECT * FROM resume_versions
     WHERE user_id = ?
     ORDER BY updated_at DESC, created_at DESC
     LIMIT ?;`,
    [userId, limit]
  );

  return rows.map(rowToResumeVersion).filter((version): version is ResumeVersion => Boolean(version));
}

async function backfillResumeVersionsFromSnapshots(userId: string) {
  const rows = await querySqlParams<{
    draft_id: string;
    user_id: string | null;
    payload_json: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT
       s.draft_id,
       w.user_id,
       s.payload_json,
       s.created_at,
       s.updated_at
     FROM snapshots s
     LEFT JOIN workspace_drafts w ON w.id = s.draft_id
     LEFT JOIN resume_versions rv ON rv.draft_id = s.draft_id
     WHERE rv.draft_id IS NULL
       AND COALESCE(w.user_id, ?) = ?
     ORDER BY s.updated_at DESC, s.created_at DESC;`,
    [userId, userId]
  );

  for (const row of rows) {
    const parsed = parseJsonPayload<ResumeDocument>(row.payload_json, "历史简历快照");
    if (!parsed.ok) {
      continue;
    }

    const document = parsed.value;
    await executeSqlParams(
      `INSERT INTO resume_versions (
         id,
         user_id,
         draft_id,
         title,
         target_title,
         template_key,
         source_type,
         document_json,
         pdf_storage_path,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(draft_id) DO NOTHING;`,
      [
        `resume-${randomUUID()}`,
        row.user_id ?? userId,
        row.draft_id,
        buildResumeVersionTitle(document),
        document.header.title?.trim() || "未填写目标岗位",
        document.templateKey,
        "snapshot_generation",
        JSON.stringify(document),
        null,
        row.created_at,
        row.updated_at
      ]
    );
  }
}

async function ensureResumeVersionsTable() {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS resume_versions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      draft_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      target_title TEXT NOT NULL,
      template_key TEXT NOT NULL,
      source_type TEXT NOT NULL,
      document_json TEXT NOT NULL,
      pdf_storage_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function buildResumeVersionTitle(document: ResumeDocument) {
  const name = document.header.name?.trim();
  const targetTitle = document.header.title?.trim();
  return [name, targetTitle].filter(Boolean).join(" · ") || "未命名简历";
}

type ResumeVersionRow = {
  id: string;
  user_id: string;
  draft_id: string;
  title: string;
  target_title: string;
  template_key: ResumeTemplateKey;
  source_type: ResumeVersionSourceType;
  document_json: string;
  pdf_storage_path: string | null;
  created_at: string;
  updated_at: string;
};

function rowToResumeVersion(row: ResumeVersionRow): ResumeVersion | null {
  const parsed = parseJsonPayload<ResumeDocument>(row.document_json, "成品简历版本");
  if (!parsed.ok) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    draftId: row.draft_id,
    title: row.title,
    targetTitle: row.target_title,
    templateKey: row.template_key,
    sourceType: row.source_type,
    document: parsed.value,
    pdfStoragePath: row.pdf_storage_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
