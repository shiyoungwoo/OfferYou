import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressStageBar } from "@/components/applications/progress-stage-bar";

describe("ProgressStageBar", () => {
  it("renders the current stage label", () => {
    render(<ProgressStageBar stage="analysis_ready" />);
    expect(screen.getAllByText("analysis_ready").length).toBeGreaterThan(0);
  });
});
