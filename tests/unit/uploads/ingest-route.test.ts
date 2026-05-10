import { describe, expect, it } from "vitest";
import { isAllowedUploadType } from "@/lib/services/ingestion/upload-type";

describe("upload ingest type guard", () => {
  it("allows a PDF only when extension and MIME type match", () => {
    expect(isAllowedUploadType("resume.pdf", "application/pdf")).toBe(true);
    expect(isAllowedUploadType("resume.pdf", "application/octet-stream")).toBe(false);
  });

  it("rejects an executable even when the MIME type is spoofed as PDF", () => {
    expect(isAllowedUploadType("resume.exe", "application/pdf")).toBe(false);
  });

  it("requires image extensions to match their MIME type", () => {
    expect(isAllowedUploadType("avatar.png", "image/png")).toBe(true);
    expect(isAllowedUploadType("avatar.png", "image/jpeg")).toBe(false);
    expect(isAllowedUploadType("avatar.jpg", "image/jpeg")).toBe(true);
  });

  it("allows only explicit text/plain for text uploads", () => {
    expect(isAllowedUploadType("resume.txt", "text/plain")).toBe(true);
    expect(isAllowedUploadType("resume.txt", "application/octet-stream")).toBe(false);
  });
});
