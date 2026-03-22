import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canCreateMasterFact, createMasterFact, listMasterFacts } from "@/lib/services/master/master-service";

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
});
