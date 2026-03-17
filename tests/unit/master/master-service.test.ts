import { describe, expect, it } from "vitest";
import { canCreateMasterFact } from "@/lib/services/master/master-service";

describe("canCreateMasterFact", () => {
  it("requires the integrity notice to be confirmed", () => {
    expect(
      canCreateMasterFact({
        integrityNoticeConfirmedAt: null
      })
    ).toBe(false);
  });
});
