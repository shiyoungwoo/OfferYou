import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderPdfFromHtml } from "@/lib/services/export/pdf-export-service";

let tempDir: string;
let previousCwd: string;

describe("renderPdfFromHtml", () => {
  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "offeryou-export-"));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns a stored PDF asset reference", async () => {
    const result = await renderPdfFromHtml({
      userId: "default-user",
      draftId: "draft-1",
      html: "<html><body><main>Resume</main></body></html>"
    });

    const pdf = await readFile(result.storagePath);

    expect(result.assetType).toBe("export_pdf");
    expect(result.storagePath.endsWith(".pdf")).toBe(true);
    expect(pdf.byteLength).toBeGreaterThan(100);
  });
});
