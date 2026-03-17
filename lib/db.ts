import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

function getDatabasePath() {
  return path.join(process.cwd(), "storage", "offeryou.sqlite");
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

export async function ensureDatabase() {
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
  `;

  await execFileAsync("sqlite3", [getDatabasePath(), schema]);
}

export async function executeSql(sql: string) {
  await ensureDatabase();
  await execFileAsync("sqlite3", [getDatabasePath(), sql]);
}

export async function querySql<T>(sql: string): Promise<T[]> {
  await ensureDatabase();
  const { stdout } = await execFileAsync("sqlite3", ["-json", getDatabasePath(), sql]);

  if (!stdout.trim()) {
    return [];
  }

  return JSON.parse(stdout) as T[];
}

export function sqlString(value: string) {
  return `'${escapeSql(value)}'`;
}
