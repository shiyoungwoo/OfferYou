import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createApplicationRecord,
  updateApplicationRecordInterviewPrep
} from "@/lib/services/applications/application-record-service";
import { saveWorkspaceDraft } from "@/lib/services/analysis/workspace-repository";
import { generateSnapshotForDraft } from "@/lib/services/snapshot/snapshot-service";
import { executeSql } from "@/lib/db";
import { readApplicationRecord } from "@/lib/services/applications/application-record-service";

let tempDir: string;
let previousCwd: string;

describe("createApplicationRecord", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-record-"));
    process.chdir(tempDir);

    await saveWorkspaceDraft({
      id: "draft-1",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI Product Manager",
      language: "en",
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
      masterFactsUsed: [
        {
          id: "fact-1",
          title: "Workflow instrumentation rollout",
          summary: "Led the post-launch instrumentation rollout for workflow analytics.",
          blockType: "project"
        }
      ],
      suggestions: [
        {
          id: "s1",
          section: "project",
          title: "Accepted",
          beforeText: "Before",
          afterText: "Built AI product workflow",
          reasonText: "Reason",
          status: "accepted",
          sourceKind: "master_fact",
          sourceLabel: "Master fact: Workflow instrumentation rollout",
          revisionRound: 0
        }
      ],
      factSubmissions: []
    });

    await generateSnapshotForDraft("draft-1");
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates a record linked to a draft and snapshot", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    expect(record.company).toBe("OfferYou");
    expect(record.snapshotId).toBe("draft-1-snapshot");
    expect(record.reusedMasterFacts).toHaveLength(1);
    expect(record.reusedMasterFacts[0]?.title).toBe("Workflow instrumentation rollout");
    expect(record.interviewStatus).toBe("none");
    expect(record.interviewPrepId).toBeUndefined();
  });

  it("normalizes older records without interview fields", async () => {
    await executeSql(`
      INSERT INTO application_records (id, draft_id, company, job_title, payload_json, applied_at, created_at)
      VALUES (
        'legacy-record-1',
        'draft-legacy',
        'Legacy Co',
        'Legacy Role',
        '{"id":"legacy-record-1","draftId":"draft-legacy","snapshotId":"draft-legacy-snapshot","company":"Legacy Co","jobTitle":"Legacy Role","appliedAt":"2026-04-23T00:00:00.000Z","acceptedSuggestionCount":2,"reusedMasterFacts":[]}',
        '2026-04-23T00:00:00.000Z',
        CURRENT_TIMESTAMP
      );
    `);

    const record = await readApplicationRecord("legacy-record-1");

    expect(record).not.toBeNull();
    expect(record?.interviewStatus).toBe("none");
    expect(record?.interviewPrepId).toBeUndefined();
  });

  it("updates interview prep status on an existing record", async () => {
    const record = await createApplicationRecord({
      draftId: "draft-1",
      exportStoragePath: "/tmp/export.pdf"
    });

    const updated = await updateApplicationRecordInterviewPrep({
      recordId: record.id,
      interviewPrepId: "interview-record-1",
      interviewStatus: "preparing"
    });

    expect(updated.interviewPrepId).toBe("interview-record-1");
    expect(updated.interviewStatus).toBe("preparing");
  });
});
