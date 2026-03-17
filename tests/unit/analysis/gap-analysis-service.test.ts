import { describe, expect, it } from "vitest";
import { analyzeDraft } from "@/lib/services/analysis/gap-analysis-service";

describe("analyzeDraft", () => {
  it("returns strengths, gaps, and fit score", async () => {
    const result = await analyzeDraft({
      jdText: "Need AI product management and workflow design with user impact and metrics.",
      facts: [{ text: "Designed an AI workflow product with user-facing flow improvements." }]
    });

    expect(result.fitScore).toBeGreaterThanOrEqual(0);
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
