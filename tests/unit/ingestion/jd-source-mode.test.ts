import { describe, expect, it } from "vitest";
import { resolveJdRecognitionMode } from "@/lib/services/ingestion/jd-source-mode";

describe("jd-source-mode", () => {
  it("uses standard AI for reliable text JD by default", () => {
    expect(
      resolveJdRecognitionMode({
        sourceType: "text",
        hasReliableText: true
      })
    ).toMatchObject({
      mode: "standard_ai",
      canAutoProceed: true,
      requiresUserConfirmation: false
    });
  });

  it("requires user confirmation for screenshot JD even in standard AI mode", () => {
    expect(
      resolveJdRecognitionMode({
        sourceType: "image",
        hasOcrLayoutBlocks: true,
        hasVisionModel: true
      })
    ).toMatchObject({
      mode: "standard_ai",
      canAutoProceed: true,
      requiresUserConfirmation: true
    });
  });

  it("blocks screenshot JD when only OCR text is available and no vision model exists", () => {
    expect(
      resolveJdRecognitionMode({
        sourceType: "image",
        hasOcrLayoutBlocks: true,
        hasVisionModel: false
      })
    ).toMatchObject({
      mode: "standard_ai",
      canAutoProceed: false,
      requiresUserConfirmation: true
    });
  });

  it("does not generate AI interpretation in basic mode", () => {
    expect(
      resolveJdRecognitionMode({
        sourceType: "text",
        requestedMode: "basic",
        hasReliableText: true
      })
    ).toMatchObject({
      mode: "basic",
      canAutoProceed: false,
      requiresUserConfirmation: true
    });
  });

  it("uses high quality AI for screenshot JD when a vision model is available", () => {
    expect(
      resolveJdRecognitionMode({
        sourceType: "image",
        requestedMode: "high_quality_ai",
        hasVisionModel: true
      })
    ).toMatchObject({
      mode: "high_quality_ai",
      canAutoProceed: true,
      requiresUserConfirmation: false
    });
  });
});
