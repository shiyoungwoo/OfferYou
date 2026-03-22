import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisSummaryPanel } from "@/components/applications/analysis-summary-panel";

describe("AnalysisSummaryPanel", () => {
  it("renders a fit verdict and confidence line", () => {
    render(
      <AnalysisSummaryPanel
        careerDirectionUsed={{
          id: "nav-1",
          slug: "customer-success",
          label: "Customer success and relationship-led roles",
          rationale: "Rationale",
          watchOut: "Watch-out"
        }}
        masterFactsUsed={[
          {
            id: "fact-1",
            title: "Workflow instrumentation rollout",
            summary: "Led the post-launch instrumentation rollout for workflow analytics.",
            blockType: "project"
          }
        ]}
        summary={{
          fitScore: 82,
          optimizationMode: "talent_amplified",
          strengths: ["Strong workflow fit."],
          gaps: ["Needs clearer outcome metrics."],
          riskNotes: ["Stay factual."]
        }}
        talentProfileUsed={{
          id: "talent-1",
          headline: "Strengths profile headline",
          confidenceNote: "Confidence note"
        }}
      />
    );

    expect(screen.getAllByText("Fit verdict").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Viable fit").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/incorporates your confirmed strengths profile/i).length).toBeGreaterThan(0);
  });
});
