import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/ingestion/command-runner", () => ({
  runCommand: vi.fn(async (command: string, args: string[]) => {
    if (!command.endsWith("opendataloader-pdf")) {
      return { stdout: "", stderr: "" };
    }

    const outputDirIndex = args.indexOf("--output-dir");
    const outputDir = outputDirIndex >= 0 ? args[outputDirIndex + 1] : null;
    if (!outputDir) {
      throw new Error("Missing output dir");
    }

    const outputFile = path.join(outputDir, "document.md");
    const fs = await import("node:fs");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      outputFile,
      "# OpenDataLoader PDF\n\n## Experience\n- Built a workflow.\n- Coordinated cross-team delivery.\n"
    );

    return { stdout: "", stderr: "" };
  })
}));

let tempDir: string;
let previousCwd: string;

describe("OpenDataLoader PDF integration", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-opendataloader-test-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("prefers opendataloader-pdf markdown output when available", async () => {
    const { extractTextFromUploadedBuffer } = await import("@/lib/services/ingestion/extract-text");

    const result = await extractTextFromUploadedBuffer({
      buffer: Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${"0".repeat(4096)}\nxref\nstartxref\n%%EOF\n`,
        "latin1"
      ),
      mimeType: "application/pdf",
      filename: "resume.pdf"
    });

    expect(result.extractedText).toContain("OpenDataLoader PDF");
    expect(result.extractedText).toContain("cross-team delivery");
    expect(result.extractionState).toBe("full_text");
  });
});
