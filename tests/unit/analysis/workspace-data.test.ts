import { describe, expect, it, vi } from "vitest";
import { cleanGeneratedResumeText } from "@/lib/services/analysis/text-cleaner";

const { readWorkspaceDraft, rewriteFactForJd } = vi.hoisted(() => ({
  readWorkspaceDraft: vi.fn(),
  rewriteFactForJd: vi.fn(() => {
    throw new Error("rewriteFactForJd should not be called when workspace data is loaded.");
  })
}));

vi.mock("@/lib/services/analysis/workspace-repository", () => ({
  readWorkspaceDraft
}));

vi.mock("@/lib/services/analysis/suggestion-generator", () => ({
  rewriteFactForJd
}));

import { getAnalysisWorkspaceData } from "@/lib/services/analysis/workspace-data";

describe("workspace-data", () => {
  it("reads suggestions from storage without rewriting them on load", async () => {
    readWorkspaceDraft.mockResolvedValue({
      id: "draft-1",
      userId: "default-user",
      company: "OfferYou",
      jobTitle: "AI 产品经理",
      language: "zh",
      stage: "analysis_ready",
      status: "created",
      jdPreview: "AI 产品经理 JD",
      jdAsset: {
        storagePath: "/tmp/jd.txt",
        mimeType: "text/plain",
        originalFilename: "jd.txt"
      },
      resumeExtractedText: "原始简历",
      analysis: {
        fitScore: 84,
        optimizationMode: "baseline_jd_match",
        strengths: ["结构清晰"],
        gaps: ["量化表达"],
        riskNotes: ["保持事实准确"]
      },
      masterFactsUsed: [],
      suggestions: [
        {
          id: "s1",
          section: "project",
          title: "项目经历",
          beforeText: "O'erYou 项目",
          afterText: "这段经历与目标 JD 相关性较弱，当前仅保留时间及岗位。 继续保留数据库中的原始文本。",
          reasonText: "Reason",
          status: "pending",
          sourceKind: "master_fact",
          sourceLabel: "master fact",
          revisionRound: 0
        }
      ],
      factSubmissions: []
    } as any);

    const result = await getAnalysisWorkspaceData("draft-1");

    expect(rewriteFactForJd).not.toHaveBeenCalled();
    expect(result.suggestions[0]?.afterText).toBe(
      cleanGeneratedResumeText(
        "这段经历与目标 JD 相关性较弱，当前仅保留时间及岗位。 继续保留数据库中的原始文本。"
      )
    );
    expect(result.suggestions[0]?.beforeText).toBe("OfferYou 项目");
  });
});
