import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);
const SQLITE_BUSY_TIMEOUT_MS = 5000;
const SQLITE_MAX_ATTEMPTS = 3;
let databaseReadyPromise: Promise<void> | null = null;
let databaseReadyPath: string | null = null;

function getDatabasePath() {
  return path.join(process.cwd(), "storage", "offeryou.sqlite");
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function isSqliteBusyError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("database is locked") || error.message.includes("SQLITE_BUSY");
}

async function waitForRetry(attempt: number) {
  await new Promise((resolve) => setTimeout(resolve, attempt * 150));
}

async function runSqlite(args: string[]) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= SQLITE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await execFileAsync("sqlite3", ["-cmd", `.timeout ${SQLITE_BUSY_TIMEOUT_MS}`, ...args]);
    } catch (error) {
      lastError = error;
      if (!isSqliteBusyError(error) || attempt === SQLITE_MAX_ATTEMPTS) {
        throw error;
      }

      await waitForRetry(attempt);
    }
  }

  throw lastError;
}

async function initializeDatabase() {
  await mkdir(path.join(process.cwd(), "storage"), { recursive: true });

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
    CREATE TABLE IF NOT EXISTS master_facts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      block_type TEXT NOT NULL,
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

  await runSqlite([getDatabasePath(), schema]);
}

export async function ensureDatabase() {
  const databasePath = getDatabasePath();

  if (databaseReadyPath !== databasePath) {
    databaseReadyPath = databasePath;
    databaseReadyPromise = null;
  }

  databaseReadyPromise ??= initializeDatabase().catch((error) => {
    databaseReadyPromise = null;
    databaseReadyPath = null;
    throw error;
  });

  await databaseReadyPromise;
}

export async function executeSql(sql: string) {
  await ensureDatabase();
  await runSqlite([getDatabasePath(), sql]);
}

export async function querySql<T>(sql: string): Promise<T[]> {
  await ensureDatabase();
  const { stdout } = await runSqlite(["-json", getDatabasePath(), sql]);

  if (!stdout.trim()) {
    return [];
  }

  try {
    return JSON.parse(stdout) as T[];
  } catch {
    throw new Error("数据库查询结果无法解析，请检查 SQLite 输出。");
  }
}

export function sqlString(value: string) {
  return `'${escapeSql(value)}'`;
}
