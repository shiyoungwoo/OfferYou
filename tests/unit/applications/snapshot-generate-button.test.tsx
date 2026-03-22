import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SnapshotGenerateButton } from "@/components/applications/snapshot-generate-button";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push
  })
}));

describe("SnapshotGenerateButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it("renders the confirmation-oriented generate copy", () => {
    render(<SnapshotGenerateButton acceptedSuggestionCount={2} draftId="draft-1" totalSuggestionCount={5} />);

    expect(screen.getByText(/当前已确认 2 \/ 5 条修改建议/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "确认并生成简历初版" })).toBeTruthy();
  });

  it("navigates to preview after successful generation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({})
      })
    );

    render(<SnapshotGenerateButton acceptedSuggestionCount={1} draftId="draft-1" totalSuggestionCount={3} />);

    fireEvent.click(screen.getByRole("button", { name: "确认并生成简历初版" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/applications/draft-1/preview");
    });
  });
});
