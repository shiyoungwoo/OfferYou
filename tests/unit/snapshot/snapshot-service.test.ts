import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSql, sqlString } from "@/lib/db";
import { readSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";

vi.mock("@/lib/services/export/pdf-export-service", () => ({
  measureResumeHtmlPageCount: vi.fn(async () => 1),
  renderPdfFromHtml: vi.fn()
}));

let tempDir: string;
let previousCwd: string;

describe("snapshot-service", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-snapshot-service-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns null for corrupted snapshot payloads", async () => {
    await executeSql(`
      INSERT INTO snapshots (draft_id, template_key, payload_json, created_at, updated_at)
      VALUES (
        'draft-1',
        'professional-cn',
        ${sqlString('{"draft":')},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `);

    const snapshot = await readSnapshotForDraft("draft-1");

    expect(snapshot).toBeNull();
  });
});
