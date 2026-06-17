import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";

describe("getStorageRoot", () => {
  const originalEnv = process.env.OFFERYOU_STORAGE_DIR;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.OFFERYOU_STORAGE_DIR;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OFFERYOU_STORAGE_DIR;
    } else {
      process.env.OFFERYOU_STORAGE_DIR = originalEnv;
    }
  });

  it("returns OFFERYOU_STORAGE_DIR when configured", async () => {
    process.env.OFFERYOU_STORAGE_DIR = "/tmp/offeryou-data";
    const { getStorageRoot } = await import("@/lib/runtime/storage-root");
    expect(getStorageRoot()).toBe(path.resolve("/tmp/offeryou-data"));
  });

  it("falls back to process.cwd()/storage when not configured", async () => {
    const { getStorageRoot } = await import("@/lib/runtime/storage-root");
    expect(getStorageRoot()).toBe(path.join(process.cwd(), "storage"));
  });

  it("trims whitespace from env var", async () => {
    process.env.OFFERYOU_STORAGE_DIR = "  /tmp/offeryou-data  ";
    const { getStorageRoot } = await import("@/lib/runtime/storage-root");
    expect(getStorageRoot()).toBe(path.resolve("/tmp/offeryou-data"));
  });

  it("always returns an absolute path", async () => {
    process.env.OFFERYOU_STORAGE_DIR = "relative/path";
    const { getStorageRoot } = await import("@/lib/runtime/storage-root");
    expect(path.isAbsolute(getStorageRoot())).toBe(true);
  });
});
