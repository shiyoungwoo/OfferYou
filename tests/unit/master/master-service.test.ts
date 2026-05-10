import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canCreateMasterFact, createMasterFact, listMasterFacts, listMasterInsights, saveMasterInsight } from "@/lib/services/master/master-service";

let tempDir: string;
let previousCwd: string;

describe("canCreateMasterFact", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-master-service-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires the integrity notice to be confirmed", () => {
    expect(
      canCreateMasterFact({
        integrityNoticeConfirmedAt: null
      })
    ).toBe(false);
  });

  it("persists confirmed facts into the master fact store", async () => {
    await createMasterFact({
      userId: "default-user",
      title: "Workflow instrumentation rollout",
      summary: "Led the post-launch instrumentation rollout for workflow analytics.",
      blockType: "project",
      integrityNoticeConfirmedAt: new Date().toISOString()
    });

    const facts = await listMasterFacts("default-user");
    expect(facts).toHaveLength(1);
    expect(facts[0]?.title).toBe("Workflow instrumentation rollout");
  });

  it("stores and lists confirmed master insights", async () => {
    const insight = await saveMasterInsight({
      userId: "default-user",
      title: "结构化梳理能力",
      insightText: "能快速把混乱的需求拆成可执行的下一步。",
      evidenceFactIds: ["fact-1"],
      status: "confirmed"
    });

    expect(insight.id).toBeTruthy();
    expect(insight.status).toBe("confirmed");

    const insights = await listMasterInsights("default-user");
    expect(insights).toHaveLength(1);
    expect(insights[0]?.title).toBe("结构化梳理能力");
    expect(insights[0]?.insightText).toContain("混乱的需求");
    expect(insights[0]?.evidenceFactIds).toContain("fact-1");
  });

  it("returns empty array when no insights exist for user", async () => {
    const insights = await listMasterInsights("nonexistent-user");
    expect(insights).toHaveLength(0);
  });

  it("skips corrupted insight payloads gracefully", async () => {
    const { executeSql, sqlString } = await import("@/lib/db");
    await executeSql(`
      INSERT INTO master_insights (id, user_id, status, payload_json, created_at, updated_at)
      VALUES (
        'broken-insight',
        'default-user',
        'confirmed',
        '{"id":',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `);

    const insights = await listMasterInsights("default-user");
    expect(insights).toHaveLength(0);
  });
});
