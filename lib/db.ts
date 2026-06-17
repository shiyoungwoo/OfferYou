import { mkdir } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { getStorageRoot } from "@/lib/runtime/storage-root";

const SQLITE_BUSY_TIMEOUT_MS = 5000;
let dbInstance: Database.Database | null = null;
let databaseReadyPromise: Promise<void> | null = null;
let databaseReadyPath: string | null = null;

function getDatabasePath() {
  return path.join(getStorageRoot(), "offeryou.sqlite");
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call ensureDatabase() first.");
  }
  return dbInstance;
}

async function initializeDatabase() {
  await mkdir(getStorageRoot(), { recursive: true });

  const db = new Database(getDatabasePath());
  db.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
  db.pragma("journal_mode = WAL");

  const schema = `
    CREATE TABLE IF NOT EXISTS workspace_drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      company TEXT NOT NULL,
      job_title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      draft_id TEXT PRIMARY KEY,
      template_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
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
    CREATE TABLE IF NOT EXISTS application_records (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      company TEXT NOT NULL,
      job_title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS interview_preps (
      id TEXT PRIMARY KEY,
      application_record_id TEXT NOT NULL UNIQUE,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS interview_schedules (
      id TEXT PRIMARY KEY,
      application_record_id TEXT UNIQUE,
      user_id TEXT NOT NULL,
      company TEXT NOT NULL,
      job_title TEXT NOT NULL,
      interview_at TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS master_facts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      block_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS master_insights (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS talent_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      confirmed_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS talent_excavation_drafts (
      user_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS career_navigation_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      talent_profile_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      confirmed_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(schema);
  dbInstance = db;
}

export async function ensureDatabase() {
  const databasePath = getDatabasePath();

  if (databaseReadyPath !== databasePath) {
    databaseReadyPath = databasePath;
    databaseReadyPromise = null;
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
  }

  databaseReadyPromise ??= initializeDatabase().catch((error) => {
    databaseReadyPromise = null;
    databaseReadyPath = null;
    dbInstance = null;
    throw error;
  });

  await databaseReadyPromise;
}

export type SqlParam = string | number | null | boolean;

export async function executeSqlParams(sql: string, params: SqlParam[] = []) {
  await ensureDatabase();
  getDb().prepare(sql).run(...params);
}

export async function querySqlParams<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
  await ensureDatabase();
  return getDb().prepare(sql).all(...params) as T[];
}

export async function executeSql(sql: string) {
  await ensureDatabase();
  getDb().exec(sql);
}

export async function querySql<T>(sql: string): Promise<T[]> {
  await ensureDatabase();
  const stmt = getDb().prepare(sql);
  return stmt.all() as T[];
}

/** @deprecated 仅限测试使用。生产代码请用 executeSqlParams / querySqlParams。 */
export function sqlString(value: string) {
  return `'${escapeSql(value)}'`;
}
