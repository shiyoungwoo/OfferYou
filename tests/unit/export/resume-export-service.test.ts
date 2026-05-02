import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeDocument } from "@/lib/document/resume-document";

const mocks = vi.hoisted(() => ({
  createApplicationRecord: vi.fn(),
  readSnapshotForDraft: vi.fn(),
  renderPdfFromHtml: vi.fn(),
  renderResumeDocumentHtml: vi.fn(),
  saveSnapshotDocument: vi.fn()
}));

vi.mock("@/lib/services/applications/application-record-service", () => ({
  createApplicationRecord: mocks.createApplicationRecord
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

import { exportResumeDocumentForDraft } from "@/lib/services/export/resume-export-service";

describe("exportResumeDocumentForDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createApplicationRecord.mockResolvedValue({
      id: "record-1"
    });
    mocks.renderPdfFromHtml.mockResolvedValue({
      storagePath: "/tmp/resume.pdf"
    });
    mocks.renderResumeDocumentHtml.mockReturnValue("<html></html>");
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
});
