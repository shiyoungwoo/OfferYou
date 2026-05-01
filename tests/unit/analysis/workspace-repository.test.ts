import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeSql, sqlString } from "@/lib/db";
import { saveWorkspaceDraft, readWorkspaceDraft, listWorkspaceDrafts } from "@/lib/services/analysis/workspace-repository";

let tempDir: string;
let previousCwd: string;

describe("workspace-repository", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-workspace-repository-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns null for corrupted draft payloads", async () => {
    await executeSql(`
      INSERT INTO workspace_drafts (id, user_id, company, job_title, payload_json, created_at, updated_at)
      VALUES (
        'broken-draft',
        'default-user',
        'Broken Co',
        'Broken Role',
        ${sqlString('{"id":')},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `);

    const draft = await readWorkspaceDraft("broken-draft");

    expect(draft).toBeNull();
  });

  it("filters corrupted draft payloads from listings", async () => {
    await saveWorkspaceDraft({
      id: "valid-draft",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI Product Manager",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "preview",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: "baseline",
      analysis: {
        fitScore: 81,
        optimizationMode: "baseline_jd_match",
        strengths: ["workflow fit"],
        gaps: ["metrics"],
        riskNotes: ["stay factual"]
      },
      masterFactsUsed: [],
      suggestions: [],
      factSubmissions: []
    });

    await executeSql(`
      INSERT INTO workspace_drafts (id, user_id, company, job_title, payload_json, created_at, updated_at)
      VALUES (
        'broken-draft',
        'default-user',
        'Broken Co',
        'Broken Role',
        ${sqlString('{"id":')},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `);

    const drafts = await listWorkspaceDrafts();

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.id).toBe("valid-draft");
  });
});
