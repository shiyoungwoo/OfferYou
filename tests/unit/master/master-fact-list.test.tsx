import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MasterFactList } from "@/components/master/master-fact-list";

describe("MasterFactList", () => {
  it("shows application impact counts for confirmed facts", () => {
    render(
      <MasterFactList
        facts={[
          {
            id: "fact-1",
            title: "Workflow instrumentation rollout",
            summary: "Led the post-launch instrumentation rollout for workflow analytics.",
            blockType: "project",
            impactedApplicationCount: 2,
            latestUsage: {
              company: "OfferYou",
              jobTitle: "AI Product Manager",
              appliedAt: "2026-03-20T12:00:00.000Z"
            }
          }
        ]}
      />
    );

    expect(screen.getAllByText("Workflow instrumentation rollout").length).toBeGreaterThan(0);
    expect(screen.getAllByText("已用于 2 次申请").length).toBeGreaterThan(0);
    expect(screen.getAllByText("最近一次用于 OfferYou · AI Product Manager").length).toBeGreaterThan(0);
  });
});
