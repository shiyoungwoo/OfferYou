import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ResumeDocument } from "@/lib/document/resume-document";
import {
  listResumeVersions,
  readResumeVersionByDraft,
  saveResumeVersionForDraft
} from "@/lib/services/resume/resume-version-service";

let tempDir: string;
let previousCwd: string;

const document: ResumeDocument = {
  templateKey: "professional-cn",
  header: {
    name: "示例候选人",
    title: "AI 产品经理",
    meta: []
  },
  sections: [
    {
      id: "summary",
      title: "个人优势",
      items: [{ type: "text", text: "擅长把业务问题转成 AI 产品方案。" }]
    }
  ]
};

describe("resume-version-service", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-resume-version-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves finished resume versions independently from application records", async () => {
    const version = await saveResumeVersionForDraft({
      userId: "default-user",
      draftId: "draft-1",
      document,
      sourceType: "manual_save"
    });

    expect(version.title).toBe("示例候选人 · AI 产品经理");

    const versions = await listResumeVersions("default-user");
    expect(versions).toHaveLength(1);
    expect(versions[0]?.draftId).toBe("draft-1");
    expect(versions[0]?.document.header.name).toBe("示例候选人");
  });

  it("updates the existing draft version instead of creating duplicates", async () => {
    await saveResumeVersionForDraft({
      userId: "default-user",
      draftId: "draft-1",
      document,
      sourceType: "manual_save"
    });

    await saveResumeVersionForDraft({
      userId: "default-user",
      draftId: "draft-1",
      document: {
        ...document,
        header: {
          ...document.header,
          title: "金融 AI 产品经理"
        }
      },
      sourceType: "pdf_export",
      pdfStoragePath: "/tmp/resume.pdf"
    });

    const versions = await listResumeVersions("default-user");
    const version = await readResumeVersionByDraft("draft-1");

    expect(versions).toHaveLength(1);
    expect(version?.targetTitle).toBe("金融 AI 产品经理");
    expect(version?.sourceType).toBe("pdf_export");
    expect(version?.pdfStoragePath).toBe("/tmp/resume.pdf");
  });
});
