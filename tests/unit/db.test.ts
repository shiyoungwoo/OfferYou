import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeSql, executeSqlParams, querySql, querySqlParams, sqlString } from "@/lib/db";

let tempDir: string;
let previousCwd: string;

describe("SQLite database access", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-db-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("handles concurrent writes without surfacing transient database locks", async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        executeSql(`
          INSERT INTO master_facts (id, user_id, title, summary, block_type, created_at, updated_at)
          VALUES (
            ${sqlString(`fact-${index}`)},
            'default-user',
            ${sqlString(`标题 ${index}`)},
            'summary',
            'project',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          );
        `)
      )
    );

    const rows = await querySql<{ count: number }>("SELECT COUNT(*) as count FROM master_facts;");

    expect(rows[0]?.count).toBe(8);
  });

  it("supports parameterized insert and query with quotes", async () => {
    await executeSqlParams(
      "INSERT INTO master_facts (id, user_id, title, summary, block_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      ["fact-param-1", "user-1", "O'Reilly 项目", "包含 ' 单引号", "project"]
    );

    const rows = await querySqlParams<{ title: string; summary: string }>(
      "SELECT title, summary FROM master_facts WHERE id = ?",
      ["fact-param-1"]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("O'Reilly 项目");
    expect(rows[0]?.summary).toBe("包含 ' 单引号");
  });
});
