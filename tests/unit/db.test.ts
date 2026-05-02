import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeSql, querySql, sqlString } from "@/lib/db";

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
});
