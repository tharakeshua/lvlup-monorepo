/**
 * Per-entity schema fixtures — domain-core.md §5 + §9 ("each entity schema accepts a
 * valid fixture + rejects malformed"). Each entity is exercised on three paths:
 *   (happy)   a complete valid fixture parses;
 *   (strict)  an unknown extra field is rejected (REVIEW D9/.strict());
 *   (failure) a malformed required field (bad enum / bad timestamp / wrong type) is
 *             rejected.
 *
 * Covers the rebuild-relevant entities: identity Student/Teacher/Parent/Staff/Scanner
 * /Class/AcademicSession + content UnifiedItem/AnswerKey (⚷ server-only)/StoredEvaluation.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  StudentSchema,
  TeacherSchema,
  ParentSchema,
  StaffSchema,
  ScannerSchema,
} from "../entities/identity/profiles.js";
import { ClassSchema, AcademicSessionSchema } from "../entities/identity/class.js";
import { UnifiedItemSchema } from "../entities/content/item.js";
import { AnswerKeySchema } from "../entities/content/answer-key.js";
import { StoredEvaluationSchema } from "../entities/content/stored-evaluation.js";

const TS = "2026-01-01T00:00:00.000Z";
const audit = { createdAt: TS, updatedAt: TS, createdBy: "uid_admin", updatedBy: "uid_admin" };

/** Helper: run happy + strict + a custom malformed mutation against a schema. */
function entityCase(
  schema: z.ZodTypeAny,
  valid: Record<string, unknown>,
  malformed: Record<string, unknown>
) {
  return { schema, valid, malformed };
}

const STUDENT = entityCase(
  StudentSchema,
  {
    id: "student_1",
    tenantId: "tenant_1",
    authUid: "uid_s1",
    firstName: "Sam",
    rollNumber: "R-001",
    classIds: ["class_1"],
    status: "active",
    ...audit,
  },
  { status: "enrolled" } // not an EntityStatus
);

const TEACHER = entityCase(
  TeacherSchema,
  {
    id: "teacher_1",
    tenantId: "tenant_1",
    firstName: "Alice",
    lastName: "Teacher",
    classIds: ["class_1"],
    status: "active",
    lastLogin: null,
    ...audit,
  },
  { firstName: 123 } // required string
);

const PARENT = entityCase(
  ParentSchema,
  {
    id: "parent_1",
    tenantId: "tenant_1",
    firstName: "Pat",
    lastName: "Parent",
    studentIds: ["student_1"],
    status: "active",
    lastLogin: null,
    ...audit,
  },
  { status: "inactive" } // not an EntityStatus (active|archived)
);

const STAFF = entityCase(
  StaffSchema,
  {
    id: "staff_1",
    tenantId: "tenant_1",
    firstName: "Stu",
    lastName: "Aff",
    status: "active",
    ...audit,
  },
  { id: "staff/1" } // path-bearing id — brand schema rejects "/"
);

const SCANNER = entityCase(
  ScannerSchema,
  {
    id: "scanner_1",
    tenantId: "tenant_1",
    authUid: "uid_scanner", // REQUIRED on Scanner (D11)
    name: "Front Desk Scanner",
    status: "active",
    ...audit,
  },
  { status: "offline" } // not an EntityStatus (missing-authUid case has its own test)
);

const CLASS = entityCase(
  ClassSchema,
  {
    id: "class_1",
    tenantId: "tenant_1",
    name: "Grade 10A",
    grade: "10",
    teacherIds: ["teacher_1"],
    studentIds: ["student_1"],
    studentCount: 1,
    status: "active",
    ...audit,
  },
  { studentCount: 1.5 } // must be int
);

const ACADEMIC_SESSION = entityCase(
  AcademicSessionSchema,
  {
    id: "as_1",
    tenantId: "tenant_1",
    name: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    isCurrent: true,
    status: "active",
    ...audit,
  },
  { startDate: "2026-04-01T00:00:00Z" } // ISO_DATE is date-only, no time
);

const ITEM = entityCase(
  UnifiedItemSchema,
  {
    id: "item_1",
    spaceId: "space_1",
    storyPointId: "sp_1",
    tenantId: "tenant_1",
    type: "question",
    payload: {
      type: "question",
      questionData: { questionType: "mcq", options: [{ id: "a", text: "A" }] },
    },
    orderIndex: 0,
    createdAt: TS,
    updatedAt: TS,
    createdBy: "uid_admin",
    updatedBy: "uid_admin",
    archivedAt: null,
  },
  { type: "lecture" } // not an ITEM_TYPE; also mismatches the payload discriminant
);

const ANSWER_KEY = entityCase(
  AnswerKeySchema,
  {
    id: "ak_1",
    itemId: "item_1",
    questionType: "mcq",
    correctAnswer: "a",
    acceptableAnswers: ["a"],
    evaluationGuidance: "full marks for a",
    modelAnswer: "a",
    createdAt: TS,
    updatedAt: TS,
  },
  { questionType: "essay" } // not a QuestionType
);

const STORED_EVAL = entityCase(
  StoredEvaluationSchema,
  {
    score: 8,
    maxScore: 10,
    correctness: 0.8,
    percentage: 80,
    strengths: ["clear"],
    weaknesses: [],
    missingConcepts: [],
  },
  { score: "eight" } // must be number
);

const CASES: Array<[string, ReturnType<typeof entityCase>]> = [
  ["Student", STUDENT],
  ["Teacher", TEACHER],
  ["Parent", PARENT],
  ["Staff", STAFF],
  ["Scanner", SCANNER],
  ["Class", CLASS],
  ["AcademicSession", ACADEMIC_SESSION],
  ["UnifiedItem", ITEM],
  ["AnswerKey", ANSWER_KEY],
  ["StoredEvaluation", STORED_EVAL],
];

describe.each(CASES)("%s schema", (name, { schema, valid, malformed }) => {
  it("accepts a valid fixture", () => {
    const res = schema.safeParse(valid);
    expect(res.success, name + (res.success ? "" : ": " + JSON.stringify(res.error.issues))).toBe(
      true
    );
  });

  it("rejects an unknown extra field (.strict)", () => {
    expect(schema.safeParse({ ...valid, __rogue__: 1 }).success).toBe(false);
  });

  it("rejects a malformed required field", () => {
    expect(schema.safeParse({ ...valid, ...malformed }).success).toBe(false);
  });
});

describe("entity-specific invariants", () => {
  it("Scanner.authUid is REQUIRED (D11 — tenant-scoped scanner has an auth user)", () => {
    const { authUid: _drop, ...noAuth } = SCANNER.valid;
    expect(ScannerSchema.safeParse(noAuth).success).toBe(false);
  });

  it("AnswerKey holds the ⚷ answer-bearing fields the client-facing item must NOT (server-only)", () => {
    // The answer key is the home of correctAnswer/evaluationGuidance/modelAnswer.
    const ak = AnswerKeySchema.parse(ANSWER_KEY.valid);
    expect(ak.correctAnswer).toBeDefined();
    // The client-facing UnifiedItem schema has no such top-level answer field.
    expect("correctAnswer" in UnifiedItemSchema.shape).toBe(false);
    expect("evaluationGuidance" in UnifiedItemSchema.shape).toBe(false);
    expect("modelAnswer" in UnifiedItemSchema.shape).toBe(false);
  });

  it("UnifiedItem carries both rubric snapshot fields (resolved rubric + source rubricId)", () => {
    expect("rubric" in UnifiedItemSchema.shape).toBe(true);
    expect("rubricId" in UnifiedItemSchema.shape).toBe(true);
    // cross-domain link to an exam question
    expect("linkedQuestionId" in UnifiedItemSchema.shape).toBe(true);
  });

  it("soft-delete is the single archivedAt convention (no deleted:boolean) on an audited entity", () => {
    expect("archivedAt" in StudentSchema.shape === false).toBe(true); // student uses raw audit, not soft-delete mixin
    // UnifiedItem authored with explicit archivedAt nullable
    expect("archivedAt" in UnifiedItemSchema.shape).toBe(true);
    expect(UnifiedItemSchema.safeParse({ ...ITEM.valid, deleted: true }).success).toBe(false);
  });
});
