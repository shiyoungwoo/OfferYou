import { describe, expect, it } from "vitest";
import { parseJsonPayload } from "@/lib/services/persistence/json-payload";

describe("parseJsonPayload", () => {
  it("parses valid JSON payloads", () => {
    const result = parseJsonPayload<{ id: string }>('{"id":"draft-1"}', "简历草稿");

    expect(result).toEqual({
      ok: true,
      value: {
        id: "draft-1"
      }
    });
  });

  it("returns a readable reason for invalid JSON payloads", () => {
    const result = parseJsonPayload<{ id: string }>("{\"id\":", "简历草稿");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("简历草稿");
      expect(result.reason).toContain("已损坏");
      expect(result.reason).not.toContain("{\"id\":");
    }
  });
});
