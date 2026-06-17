import { describe, expect, it } from "vitest";
import { buildParseHardSignals, extractTextFromUploadedBuffer } from "@/lib/services/ingestion/extract-text";

describe("extractTextFromUploadedBuffer", () => {
  it("extracts plain text uploads fully", async () => {
    const result = await extractTextFromUploadedBuffer({
      buffer: Buffer.from("Customer workflow coordination"),
      mimeType: "text/plain",
      filename: "jd.txt"
    });

    expect(result.extractedText).toContain("Customer workflow coordination");
    expect(result.extractionState).toBe("full_text");
  });

  it("extracts readable fragments from simple pdf text operators", async () => {
    const result = await extractTextFromUploadedBuffer({
      buffer: Buffer.from("%PDF-1.4\nBT\n(Customer Success Lead) Tj\n(Workflow coordination) Tj\nET", "latin1"),
      mimeType: "application/pdf",
      filename: "resume.pdf"
    });

    expect(result.extractedText).toContain("Customer Success Lead");
    expect(result.extractedText).toContain("Workflow coordination");
    expect(result.extractionState).toBe("partial_text");
  });

  it("does not use missing resume sections as a hard rejection signal", () => {
    const signals = buildParseHardSignals({
      engine: "liteparse",
      text: [
        "示例候选人",
        "13800000000",
        "candidate@example.com",
        "项目经历",
        "OfferYou AI 求职助手 2026.03 - 至今",
        "独立完成 AI 简历优化工作流设计，并验证 PDF 导出和面试准备链路。"
      ].join("\n")
    });

    expect(signals.detectedSections).toContain("personal_info");
    expect(signals.detectedSections).toContain("project");
    expect(signals.missingCriticalSections).toContain("education");
    expect(signals.mustReject).toBe(false);
  });

  it("hard-rejects empty or unreadable extraction before AI review", () => {
    const signals = buildParseHardSignals({
      engine: "liteparse",
      text: "������"
    });

    expect(signals.mustReject).toBe(true);
  });
});
