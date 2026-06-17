import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportPdfButton } from "@/components/preview/export-pdf-button";

describe("ExportPdfButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("renders the combined confirmation and export action", () => {
    render(<ExportPdfButton draftId="draft-1" />);

    expect(screen.getByRole("button", { name: "确认内容并导出 PDF" })).toHaveProperty("disabled", false);
  });

  it("shows the PDF download link after successful export", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          storagePath: "/tmp/resume.pdf",
          downloadPath: "/api/drafts/draft-1/export?path=%2Ftmp%2Fresume.pdf"
        })
      })
    );

    render(<ExportPdfButton draftId="draft-1" />);

    fireEvent.click(screen.getByRole("button", { name: "确认内容并导出 PDF" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "重新下载 PDF" }).getAttribute("href")).toBe(
        "/api/drafts/draft-1/export?path=%2Ftmp%2Fresume.pdf"
      );
    });
  });

  it("sends the edited document when exporting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        storagePath: "/tmp/resume.pdf",
        downloadPath: "/api/drafts/draft-1/export?path=%2Ftmp%2Fresume.pdf"
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
            },
            templateKey: "professional-cn"
          })
        })
      );
    });
  });

  it("sends the selected ATS Clean template explicitly when exporting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        storagePath: "/tmp/resume.pdf",
        downloadPath: "/api/drafts/draft-1/export?path=%2Ftmp%2Fresume.pdf"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ExportPdfButton
        document={{
          templateKey: "ats-clean",
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
              templateKey: "ats-clean",
              header: {
                name: "王小明",
                title: "产品经理",
                meta: []
              },
              sections: []
            },
            templateKey: "ats-clean"
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
