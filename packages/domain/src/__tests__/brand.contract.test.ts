/**
 * Branded IDs — domain-core.md §2 + §9 row "Brand count + tags" (REVIEW D8).
 *
 * Locks: BRAND_TAGS is exactly the canonical 19; the 3 rebuild-added brands
 * (Staff/Scanner/ExamQuestion) are present; every core tag has a matching `as*`
 * trust-boundary factory AND a `z<Id>` zod schema; `zBrandedId` produces a brand
 * via `.transform` (z.infer is the brand) so brands reach INTO schemas; the id
 * regex/length rules reject path-bearing and empty ids.
 *
 * Concrete-path imports so the test runs against the real implementation today.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import {
  BRAND_TAGS,
  type BrandTag,
  asTenantId,
  asStaffId,
  asScannerId,
  asExamQuestionId,
  type SpaceId,
} from "../primitives/brand.js";
import * as brand from "../primitives/brand.js";
import {
  zBrandedId,
  zSpaceId,
  zStaffId,
  zScannerId,
  zExamQuestionId,
} from "../primitives/branded-id.zod.js";
import * as zbrand from "../primitives/branded-id.zod.js";

const CANONICAL_19 = [
  "TenantId",
  "ClassId",
  "StudentId",
  "TeacherId",
  "ParentId",
  "SpaceId",
  "StoryPointId",
  "ItemId",
  "ExamId",
  "SubmissionId",
  "UserId",
  "SessionId",
  "AgentId",
  "AcademicSessionId",
  "NotificationId",
  "QuestionBankItemId",
  "StaffId",
  "ScannerId",
  "ExamQuestionId",
] as const;

describe("BRAND_TAGS registry (the canonical 19)", () => {
  it("has exactly 19 tags", () => {
    expect(BRAND_TAGS.length).toBe(19);
  });

  it("is exactly the canonical 19 set (no missing / extra)", () => {
    expect([...BRAND_TAGS].sort()).toEqual([...CANONICAL_19].sort());
  });

  it("includes the 3 rebuild-added brands (Staff, Scanner, ExamQuestion)", () => {
    for (const added of ["StaffId", "ScannerId", "ExamQuestionId"] as const) {
      expect(BRAND_TAGS).toContain(added);
    }
  });

  it("has no duplicate tags", () => {
    expect(new Set(BRAND_TAGS).size).toBe(BRAND_TAGS.length);
  });
});

describe("every core tag has a matching as*() factory and a z<Id> schema", () => {
  it.each(CANONICAL_19)("%s → as<Id> factory exists and is identity-cast", (tag) => {
    const factoryName = `as${tag}`;
    const factory = (brand as Record<string, unknown>)[factoryName];
    expect(typeof factory, `${factoryName} factory`).toBe("function");
    // factory is a trust-boundary cast: returns the same string value
    expect((factory as (s: string) => string)("x_123")).toBe("x_123");
  });

  it.each(CANONICAL_19)("%s → z<Id> schema exists and parses", (tag) => {
    const schemaName = `z${tag}`;
    const schema = (zbrand as Record<string, unknown>)[schemaName] as
      | { parse: (x: unknown) => unknown }
      | undefined;
    expect(schema?.parse, `${schemaName} schema`).toBeTypeOf("function");
    expect(schema!.parse("id_123")).toBe("id_123");
  });
});

describe("zBrandedId helper (the brands-INTO-schemas bridge)", () => {
  it("parses a non-empty id and returns the raw value (transform-to-brand)", () => {
    const UserIdSchema = zBrandedId("UserId");
    expect(UserIdSchema.parse("uid_abc")).toBe("uid_abc");
  });

  it("rejects empty ids", () => {
    expect(zBrandedId("SpaceId").safeParse("").success).toBe(false);
  });

  it('rejects ids containing a "/" (Firestore path separator)', () => {
    expect(zBrandedId("SpaceId").safeParse("a/b").success).toBe(false);
  });

  it("rejects ids longer than 1500 chars", () => {
    expect(zBrandedId("SpaceId").safeParse("x".repeat(1501)).success).toBe(false);
    expect(zBrandedId("SpaceId").safeParse("x".repeat(1500)).success).toBe(true);
  });

  it("rejects non-string inputs", () => {
    expect(zBrandedId("SpaceId").safeParse(123).success).toBe(false);
    expect(zBrandedId("SpaceId").safeParse(null).success).toBe(false);
  });
});

describe("the 3 new brands: factory + schema parity", () => {
  it("asStaffId/asScannerId/asExamQuestionId cast strings", () => {
    expect(asStaffId("s1")).toBe("s1");
    expect(asScannerId("sc1")).toBe("sc1");
    expect(asExamQuestionId("eq1")).toBe("eq1");
  });

  it("zStaffId/zScannerId/zExamQuestionId parse", () => {
    expect(zStaffId.parse("s1")).toBe("s1");
    expect(zScannerId.parse("sc1")).toBe("sc1");
    expect(zExamQuestionId.parse("eq1")).toBe("eq1");
  });
});

describe("brand types are nominal (compile-time)", () => {
  it("z.infer<typeof zSpaceId> is assignable to SpaceId; brands are not bare string", () => {
    type Inferred = import("zod").z.infer<typeof zSpaceId>;
    expectTypeOf<Inferred>().toEqualTypeOf<SpaceId>();
    // a SpaceId is assignable to string, but a bare string is NOT a SpaceId
    expectTypeOf<SpaceId>().toMatchTypeOf<string>();
    expectTypeOf<string>().not.toMatchTypeOf<SpaceId>();
    // distinct brands are not cross-assignable
    expectTypeOf(asTenantId("t")).not.toMatchTypeOf<SpaceId>();
  });
});
