import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportPdfButton } from "@/components/preview/export-pdf-button";

describe("ExportPdfButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the combined confirmation and export action", () => {
    render(<ExportPdfButton draftId="draft-1" />);

    expect(screen.getByRole("button", { name: "确认内容并导出 PDF" })).toHaveProperty("disabled", false);
  });

  it("shows the record link after successful export", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          storagePath: "/tmp/resume.pdf",
          recordPath: "/applications/draft-1/record"
        })
      })
    );

    render(<ExportPdfButton draftId="draft-1" />);

    fireEvent.click(screen.getByRole("button", { name: "确认内容并导出 PDF" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "查看这次简历记录" }).getAttribute("href")).toBe(
        "/applications/draft-1/record"
      );
    });
  });

  it("sends the edited document when exporting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        storagePath: "/tmp/resume.pdf",
        recordPath: "/applications/draft-1/record"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ExportPdfButton
        document={{
          templateKey: "professional-cn",
          header: {
            name: "王小明",
            title: "产品经理",
            meta: []
          },
          sections: []
        }}
        draftId="draft-1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "确认内容并导出 PDF" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/drafts/draft-1/export",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            document: {
              templateKey: "professional-cn",
              header: {
                name: "王小明",
                title: "产品经理",
                meta: []
              },
              sections: []
            }
          })
        })
      );
    });
  });

  it("still renders the export action without the old page-warning copy", () => {
    const sections = Array.from({ length: 25 }, (_, index) => ({
      id: `s${index + 1}`,
      title: `第 ${index + 1} 段`,
      items: [{ type: "text" as const, text: String(index + 1) }]
    }));

    render(
      <ExportPdfButton
        document={{
          templateKey: "professional-cn",
          header: {
            name: "王小明",
            title: "产品经理",
            meta: []
          },
          sections
        }}
        draftId="draft-1"
      />
    );

    expect(screen.getByRole("button", { name: "确认内容并导出 PDF" })).toHaveProperty("disabled", false);
    expect(screen.queryByText("两页版本，建议保留重点")).toBeNull();
  });
});
