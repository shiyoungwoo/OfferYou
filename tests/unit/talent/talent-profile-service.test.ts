import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSql } from "@/lib/db";
import { buildCareerNavigation } from "@/lib/services/talent/career-navigation";
import {
  confirmCareerNavigation,
  confirmTalentProfile,
  deleteTalentExcavationDraft,
  getTalentExcavationDraft,
  getLatestConfirmedCareerNavigationForTalentProfile,
  getLatestConfirmedTalentProfile,
  saveTalentExcavationDraft
} from "@/lib/services/talent/talent-profile-service";
import { listMasterInsights } from "@/lib/services/master/master-service";

vi.mock("@/lib/ai/model-gateway", () => ({
  callModelJSON: vi.fn()
}));

vi.mock("@/lib/services/master/master-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/master/master-service")>();
  return {
    ...actual,
    saveMasterInsight: vi.fn(actual.saveMasterInsight)
  };
});

let tempDir: string;
let previousCwd: string;

describe("talent-profile-service", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-talent-service-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves and retrieves the latest confirmed talent profile", async () => {
    const record = await confirmTalentProfile({
      userId: "default-user",
      answers: {
        proudMoment: "I led a messy workflow recovery and restored customer confidence through clearer structure.",
        trustedProblem:
          "People rely on me to clarify ambiguous work because I can organize the moving parts and explain the next step.",
        energyPattern: "I gain energy from solving complex problems with people and taking ownership of the path forward."
      }
    });

    const latest = await getLatestConfirmedTalentProfile("default-user");

    expect(latest?.id).toBe(record.id);
    expect(latest?.profile.headline).toContain("你最容易发光的状态");
  });

  it("builds and confirms career navigation against a confirmed talent profile", async () => {
    const talent = await confirmTalentProfile({
      userId: "default-user",
      answers: {
        proudMoment: "I clarified a client process and helped two teams align on the plan.",
        trustedProblem:
          "People rely on me when work is confusing because I can coordinate teams and build trust fast.",
        energyPattern: "I gain energy from solving ambiguous problems with people and owning delivery."
      }
    });

    const preview = buildCareerNavigation(talent.profile);
    const record = await confirmCareerNavigation({
      userId: "default-user",
      talentProfileId: talent.id
    });
    const latest = await getLatestConfirmedCareerNavigationForTalentProfile("default-user", talent.id);

    expect(preview.directions.length).toBeGreaterThan(0);
    expect(record.navigation.directions[0]?.slug).toBeTruthy();
    expect(latest?.id).toBe(record.id);
  });

  it("returns null when the latest confirmed talent profile payload is corrupted", async () => {
    await executeSql(`
      INSERT INTO talent_profiles (id, user_id, status, payload_json, confirmed_at, created_at, updated_at)
      VALUES (
        'talent-broken-1',
        'default-user',
        'confirmed',
        '{"id":',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `);

    const latest = await getLatestConfirmedTalentProfile("default-user");

    expect(latest).toBeNull();
  });

  it("returns null when the latest confirmed career navigation payload is corrupted", async () => {
    await executeSql(`
      INSERT INTO career_navigation_profiles (id, user_id, talent_profile_id, status, payload_json, confirmed_at, created_at, updated_at)
      VALUES (
        'career-nav-broken-1',
        'default-user',
        'talent-profile-1',
        'confirmed',
        '{"id":',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `);

    const latest = await getLatestConfirmedCareerNavigationForTalentProfile("default-user", "talent-profile-1");

    expect(latest).toBeNull();
  });

  it("saves, retrieves, and deletes a deep excavation draft", async () => {
    await saveTalentExcavationDraft({
      userId: "default-user",
      turns: [
        {
          question: "第一轮问题",
          answer: "第一轮回答里有非常具体的经历。",
          requiredAnchor: "early_memory"
        }
      ],
      updatedAt: "2026-06-15T00:00:00.000Z"
    });

    const draft = await getTalentExcavationDraft("default-user");

    expect(draft?.turns).toHaveLength(1);
    expect(draft?.turns[0]?.answer).toContain("具体的经历");

    await deleteTalentExcavationDraft("default-user");

    expect(await getTalentExcavationDraft("default-user")).toBeNull();
  });

  it("uses model output when available and saves high-confidence insights", async () => {
    const { callModelJSON } = await import("@/lib/ai/model-gateway");
    const { saveMasterInsight } = await import("@/lib/services/master/master-service");
    vi.mocked(saveMasterInsight).mockImplementation(await vi.importActual<typeof import("@/lib/services/master/master-service")>("@/lib/services/master/master-service").then((actual) => actual.saveMasterInsight));
    vi.mocked(callModelJSON).mockResolvedValueOnce({
      provider: "openai_compatible",
      data: {
        headline: "你最容易发光的状态，是作为「结构化梳理者」。",
        summary: "模型生成的天赋画像。",
        signals: [
          { key: "clarity_builder", label: "结构化梳理者", description: "能把混乱信息理清。", evidence: ["梳理了复杂流程", "整理了需求文档"] },
          { key: "ownership_runner", label: "主动推进者", description: "不会等条件完美才行动。", evidence: ["主动发起项目", "推动团队对齐"] }
        ],
        workStyle: ["需要自主空间"],
        suitableDirections: ["运营、项目推进类方向"],
        cautionNotes: ["继续保持验证"],
        confidenceNote: "当前可信度为中等。"
      },
      generationMode: "model"
    });

    const record = await confirmTalentProfile({
      userId: "default-user",
      answers: {
        proudMoment: "I led a messy workflow recovery and clarified the next steps."
      }
    });

    expect(record.generationMode).toBe("model");
    expect(record.modelProvider).toBe("openai_compatible");
    expect(record.profile.headline).toContain("结构化梳理者");
    expect(record.riskNotes).toBeUndefined();

    const insights = await listMasterInsights("default-user");
    expect(insights.length).toBeGreaterThanOrEqual(1);
    expect(insights.some((i) => i.title === "结构化梳理者")).toBe(true);
  });

  it("keeps a visible risk note when saving talent insights fails", async () => {
    const { callModelJSON } = await import("@/lib/ai/model-gateway");
    const { saveMasterInsight } = await import("@/lib/services/master/master-service");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.mocked(saveMasterInsight).mockRejectedValueOnce(new Error("database locked"));
    vi.mocked(callModelJSON).mockResolvedValueOnce({
      provider: "openai_compatible",
      data: {
        headline: "你最容易发光的状态，是作为「结构化梳理者」。",
        summary: "模型生成的天赋画像。",
        signals: [
          { key: "clarity_builder", label: "结构化梳理者", description: "能把混乱信息理清。", evidence: ["梳理了复杂流程", "整理了需求文档"] }
        ],
        workStyle: ["需要自主空间"],
        suitableDirections: ["运营、项目推进类方向"],
        cautionNotes: [],
        confidenceNote: "当前可信度为中等。"
      },
      generationMode: "model"
    });

    const record = await confirmTalentProfile({
      userId: "default-user",
      answers: {
        proudMoment: "I led a messy workflow recovery and clarified the next steps."
      }
    });

    expect(record.riskNotes?.join(" ")).toContain("天赋洞察未能写入事实主档");
    expect(consoleWarn).toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it("falls back to deterministic profile with risk note when model fails", async () => {
    const { callModelJSON } = await import("@/lib/ai/model-gateway");
    vi.mocked(callModelJSON).mockRejectedValueOnce(new Error("Model timeout"));

    const record = await confirmTalentProfile({
      userId: "default-user",
      answers: {
        proudMoment: "I led a messy client onboarding, clarified the workflow, and organized the team around a plan the customer trusted.",
        trustedProblem: "People rely on me when cross-team work is confusing because I can listen, coordinate, and turn ambiguity into clear next steps.",
        energyPattern: "I gain energy from solving complex problems with people and owning the path forward."
      }
    });

    expect(record.generationMode).toBe("deterministic_fallback");
    expect(record.riskNotes).toBeDefined();
    expect(record.riskNotes!.join(" ")).toContain("模型暂不可用");
    expect(record.profile.signals.length).toBeGreaterThan(0);
  });
});
