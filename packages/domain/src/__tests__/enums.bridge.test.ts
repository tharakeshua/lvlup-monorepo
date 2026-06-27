/**
 * Shared enums + the as-const→zod bridge — domain-core.md §7.1/§7.2.
 *
 * Locks: zEnum(tuple) accepts exactly the tuple members and rejects anything else
 * (members are guaranteed identical to the as-const type — no second source of
 * truth); the rebuild's content-enum cardinalities (15 question types, 7 material
 * types, 4 story-point types, 7 item types) and the AUTO/AI evaluatable partition
 * (every QuestionType is in exactly one bucket); and the status-enum membership
 * decisions (exam drops 'completed', submission drops OCR, story-point drops 'test').
 */
import { describe, it, expect } from "vitest";
import { zEnum } from "../enums/enum.js";
import {
  ITEM_TYPES,
  zItemType,
  QUESTION_TYPES,
  zQuestionType,
  MATERIAL_TYPES,
  zMaterialType,
  STORY_POINT_TYPES,
  zStoryPointType,
  AUTO_EVALUATABLE_TYPES,
  AI_EVALUATABLE_TYPES,
  type QuestionType,
} from "../enums/content.js";
import { SPACE_STATUSES, zSpaceStatus } from "../enums/space.js";
import { EXAM_STATUSES } from "../enums/exam.js";
import { SUBMISSION_PIPELINE_STATUSES } from "../enums/submission.js";
import { TENANT_ROLES } from "../enums/tenant.js";

describe("zEnum bridge — members identical to the as-const tuple", () => {
  it("accepts every tuple member and rejects a non-member", () => {
    const TUPLE = ["x", "y", "z"] as const;
    const schema = zEnum(TUPLE);
    for (const m of TUPLE) expect(schema.parse(m)).toBe(m);
    expect(schema.safeParse("w").success).toBe(false);
  });

  it("zItemType ⇄ ITEM_TYPES (no drift between schema and tuple)", () => {
    for (const t of ITEM_TYPES) expect(zItemType.safeParse(t).success).toBe(true);
    expect(zItemType.safeParse("not-a-type").success).toBe(false);
  });

  it("zSpaceStatus ⇄ SPACE_STATUSES", () => {
    for (const s of SPACE_STATUSES) expect(zSpaceStatus.safeParse(s).success).toBe(true);
    expect(zSpaceStatus.safeParse("paused").success).toBe(false);
  });
});

describe("content-enum cardinalities (the rebuild content model)", () => {
  it("7 item types", () => {
    expect(ITEM_TYPES.length).toBe(7);
    expect([...ITEM_TYPES].sort()).toEqual(
      [
        "assessment",
        "checkpoint",
        "discussion",
        "interactive",
        "material",
        "project",
        "question",
      ].sort()
    );
  });

  it("15 question types", () => {
    expect(QUESTION_TYPES.length).toBe(15);
    expect(new Set(QUESTION_TYPES).size).toBe(15);
    for (const qt of QUESTION_TYPES) expect(zQuestionType.safeParse(qt).success).toBe(true);
  });

  it("7 material types", () => {
    expect(MATERIAL_TYPES.length).toBe(7);
    for (const mt of MATERIAL_TYPES) expect(zMaterialType.safeParse(mt).success).toBe(true);
  });

  it("4 story-point types (synonym 'test' dropped)", () => {
    expect(STORY_POINT_TYPES.length).toBe(4);
    expect(STORY_POINT_TYPES).not.toContain("test");
    expect(zStoryPointType.safeParse("test").success).toBe(false);
  });
});

describe("AUTO/AI evaluatable partition of the 15 question types", () => {
  it("the two buckets are disjoint", () => {
    const auto = new Set<string>(AUTO_EVALUATABLE_TYPES);
    for (const t of AI_EVALUATABLE_TYPES) expect(auto.has(t)).toBe(false);
  });

  it("every question type is in exactly one bucket (no orphans)", () => {
    const union = new Set<QuestionType>([...AUTO_EVALUATABLE_TYPES, ...AI_EVALUATABLE_TYPES]);
    expect(union.size).toBe(QUESTION_TYPES.length);
    for (const qt of QUESTION_TYPES)
      expect(union.has(qt), `question type ${qt} unbucketed`).toBe(true);
  });

  it("the buckets together cover exactly the 15 types", () => {
    expect(AUTO_EVALUATABLE_TYPES.length + AI_EVALUATABLE_TYPES.length).toBe(QUESTION_TYPES.length);
  });
});

describe("status-enum membership decisions (REVIEW open-Qs)", () => {
  it("EXAM_STATUSES drops 'completed'", () => {
    expect(EXAM_STATUSES).not.toContain("completed");
  });

  it("SUBMISSION_PIPELINE_STATUSES drops OCR stages", () => {
    expect(SUBMISSION_PIPELINE_STATUSES).not.toContain("ocr_processing");
    expect(SUBMISSION_PIPELINE_STATUSES).not.toContain("ocr_failed");
  });

  it("TENANT_ROLES is the canonical role set (incl. new staff + scanner)", () => {
    for (const r of [
      "staff",
      "scanner",
      "superAdmin",
      "tenantAdmin",
      "teacher",
      "student",
      "parent",
    ]) {
      expect(TENANT_ROLES).toContain(r);
    }
  });
});
