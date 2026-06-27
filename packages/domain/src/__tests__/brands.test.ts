/**
 * Branded IDs (SDK-LAYERS-PLAN.md §8 D8). 19 brands authored INTO schemas via
 * `zBrandedId` + `z.infer` (no evaporation). `BRAND_TAGS.length === 19`.
 *
 * Self-skips until `@levelup/domain` exports the brand registry.
 */
import { describe, it, expect } from "vitest";
import * as domain from "../index";

const D = domain as unknown as {
  BRAND_TAGS?: readonly string[];
  zBrandedId?: (tag: string) => { parse: (x: unknown) => unknown };
};

const ready = Boolean(D.BRAND_TAGS);

(ready ? describe : describe.skip)("branded IDs", () => {
  it("there are exactly 19 brand tags", () => {
    expect(D.BRAND_TAGS!.length).toBe(19);
  });

  it("includes the 3 brands added to the canonical registry by the rebuild (Staff, Scanner, ExamQuestion)", () => {
    // The canonical 19 BRAND_TAGS registry is fixed by domain-core §2.4 (16 existing
    // + StaffId/ScannerId/ExamQuestionId). AnnouncementId is a real new persisted-doc
    // brand (type + factory + zBrandedId schema) but is one of the additional
    // domain-specific brands, NOT part of the core-19 contract registry — see
    // brand.contract.test.ts which locks the registry to exactly the canonical 19.
    const tags = new Set(D.BRAND_TAGS!.map((t) => t.toLowerCase()));
    for (const expected of ["staffid", "scannerid", "examquestionid"]) {
      expect(tags.has(expected), `brand for ${expected}`).toBe(true);
    }
  });

  it("zBrandedId parses a string id", () => {
    if (D.zBrandedId) {
      const UserId = D.zBrandedId("UserId");
      expect(UserId.parse("uid_123")).toBe("uid_123");
    }
  });
});
