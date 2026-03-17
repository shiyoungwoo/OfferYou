import { describe, expect, it } from "vitest";
import { LocalStorageAdapter } from "@/lib/storage/local-storage-adapter";

describe("LocalStorageAdapter", () => {
  it("stores a file under a user-scoped path", async () => {
    const adapter = new LocalStorageAdapter("/tmp/offeryou-test-storage");
    const stored = await adapter.put({
      userId: "default-user",
      kind: "resume_source",
      filename: "resume.txt",
      buffer: Buffer.from("resume"),
      mimeType: "text/plain"
    });

    expect(stored.storagePath).toContain("default-user");
    expect(stored.mimeType).toBe("text/plain");
  });
});
