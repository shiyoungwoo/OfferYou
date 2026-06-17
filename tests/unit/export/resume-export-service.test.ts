import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeDocument } from "@/lib/document/resume-document";

const mocks = vi.hoisted(() => ({
  readSnapshotForDraft: vi.fn(),
  renderPdfFromHtml: vi.fn(),
  renderResumeDocumentHtml: vi.fn(),
  saveResumeVersionForDraft: vi.fn(),
  saveSnapshotDocument: vi.fn()
}));

vi.mock("@/lib/services/export/pdf-export-service", () => ({
  renderPdfFromHtml: mocks.renderPdfFromHtml
}));

vi.mock("@/lib/services/export/preview-renderer", () => ({
  buildResumePdfFilename: vi.fn(() => "resume.pdf"),
  renderResumeDocumentHtml: mocks.renderResumeDocumentHtml
}));

vi.mock("@/lib/services/snapshot/snapshot-service", () => ({
  readSnapshotForDraft: mocks.readSnapshotForDraft,
  saveSnapshotDocument: mocks.saveSnapshotDocument
}));

vi.mock("@/lib/services/resume/resume-version-service", () => ({
  saveResumeVersionForDraft: mocks.saveResumeVersionForDraft
}));

import { exportResumeDocumentForDraft } from "@/lib/services/export/resume-export-service";

describe("exportResumeDocumentForDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.renderPdfFromHtml.mockResolvedValue({
      storagePath: "/tmp/resume.pdf"
    });
    mocks.renderResumeDocumentHtml.mockReturnValue("<html></html>");
    mocks.saveResumeVersionForDraft.mockResolvedValue({ id: "resume-1" });
  });

  it("uses the explicitly selected template when rendering and saving the export document", async () => {
    const document: ResumeDocument = {
      templateKey: "professional-cn",
      header: {
        name: "王小明",
        title: "产品经理",
        meta: []
      },
      sections: []
    };

    await exportResumeDocumentForDraft({
      draftId: "draft-1",
      document,
      templateKey: "ats-clean"
    });

    expect(mocks.saveSnapshotDocument).toHaveBeenCalledWith(
      "draft-1",
      expect.objectContaining({
        templateKey: "ats-clean"
      })
    );
    expect(mocks.renderResumeDocumentHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "ats-clean"
      })
    );
  });

  it("falls back to the saved snapshot template when no explicit template is sent", async () => {
    mocks.readSnapshotForDraft.mockResolvedValue({
      templateKey: "ats-clean",
      header: {
        name: "王小明",
        title: "产品经理",
        meta: []
      },
      sections: []
    } satisfies ResumeDocument);

    await exportResumeDocumentForDraft({
      draftId: "draft-1"
    });

    expect(mocks.renderResumeDocumentHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "ats-clean"
      })
    );
  });

  it("exports a PDF without creating an application record", async () => {
    mocks.readSnapshotForDraft.mockResolvedValue({
      templateKey: "professional-cn",
      header: {
        name: "王小明",
        title: "产品经理",
        meta: []
      },
      sections: []
    } satisfies ResumeDocument);

    const result = await exportResumeDocumentForDraft({
      draftId: "draft-1"
    });

    expect(result.storagePath).toBe("/tmp/resume.pdf");
    expect(mocks.saveResumeVersionForDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "draft-1",
        sourceType: "pdf_export",
        pdfStoragePath: "/tmp/resume.pdf"
      })
    );
  });
});
