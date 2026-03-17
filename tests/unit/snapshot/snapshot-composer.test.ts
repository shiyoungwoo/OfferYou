import { describe, expect, it } from "vitest";
import { composeSnapshotDocument } from "@/lib/services/snapshot/snapshot-composer";

describe("composeSnapshotDocument", () => {
  it("includes accepted suggestions but excludes rejected suggestions", () => {
    const document = composeSnapshotDocument({
      id: "draft-1",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI Product Manager",
      language: "en",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "preview",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: "baseline",
      analysis: {
        fitScore: 81,
        strengths: ["workflow fit"],
        gaps: ["metrics"],
        riskNotes: ["stay factual"]
      },
      suggestions: [
        {
          id: "s1",
          section: "project",
          title: "Accepted",
          beforeText: "Before",
          afterText: "Built AI product workflow",
          reasonText: "Reason",
          status: "accepted",
          revisionRound: 0
        },
        {
          id: "s2",
          section: "project",
          title: "Rejected",
          beforeText: "Before",
          afterText: "Ignored text",
          reasonText: "Reason",
          status: "rejected",
          revisionRound: 0
        }
      ],
      factSubmissions: []
    });

    expect(JSON.stringify(document)).toContain("Built AI product workflow");
    expect(JSON.stringify(document)).not.toContain("Ignored text");
  });
});
