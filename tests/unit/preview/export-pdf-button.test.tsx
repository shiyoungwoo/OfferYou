import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportPdfButton } from "@/components/preview/export-pdf-button";

describe("ExportPdfButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("requires explicit confirmation before export", () => {
    render(<ExportPdfButton draftId="draft-1" />);

    expect(screen.getByRole("button", { name: "确认无误后导出 PDF" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByLabelText(/我已经确认当前简历内容无误/i));

    expect(screen.getByRole("button", { name: "确认无误后导出 PDF" })).toHaveProperty("disabled", false);
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

    fireEvent.click(screen.getByLabelText(/我已经确认当前简历内容无误/i));
    fireEvent.click(screen.getByRole("button", { name: "确认无误后导出 PDF" }));

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

    fireEvent.click(screen.getByLabelText(/我已经确认当前简历内容无误/i));
    fireEvent.click(screen.getByRole("button", { name: "确认无误后导出 PDF" }));

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

  it("shows a page warning when the document is over two pages", () => {
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

    expect(screen.getByText("两页版本，建议保留重点")).toBeTruthy();
  });
});
