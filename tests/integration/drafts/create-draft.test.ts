import { describe, expect, it } from "vitest";
import { createDraftInputSchema } from "@/lib/validation/drafts";

describe("createDraftInputSchema", () => {
  it("requires company, jobTitle, and jd content", () => {
    const result = createDraftInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
