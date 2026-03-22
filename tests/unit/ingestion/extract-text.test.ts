import { describe, expect, it } from "vitest";
import { extractTextFromUploadedBuffer } from "@/lib/services/ingestion/extract-text";

describe("extractTextFromUploadedBuffer", () => {
  it("extracts plain text uploads fully", () => {
    const result = extractTextFromUploadedBuffer({
      buffer: Buffer.from("Customer workflow coordination"),
      mimeType: "text/plain",
      filename: "jd.txt"
    });

    expect(result.extractedText).toContain("Customer workflow coordination");
    expect(result.extractionState).toBe("full_text");
  });

  it("extracts readable fragments from simple pdf text operators", () => {
    const result = extractTextFromUploadedBuffer({
      buffer: Buffer.from("%PDF-1.4\nBT\n(Customer Success Lead) Tj\n(Workflow coordination) Tj\nET", "latin1"),
      mimeType: "application/pdf",
      filename: "resume.pdf"
    });

    expect(result.extractedText).toContain("Customer Success Lead");
    expect(result.extractedText).toContain("Workflow coordination");
    expect(result.extractionState).toBe("partial_text");
  });
});
