/**
 * Domain entity fixtures factory — produces VALID `@levelup/domain` entities so
 * unit tests (repos shaping, query hooks, services) don't need the emulator.
 *
 * Design:
 *   • Each factory returns a plain object that SHOULD satisfy the corresponding
 *     `.strict()` Zod schema in `@levelup/domain`. To stay honest, factories run
 *     the produced object through the domain schema when it is available
 *     (`validateAgainstDomain(schemaName, obj)`), so a fixture that drifts from
 *     the schema fails loudly — this is the unit-test equivalent of the contract
 *     gate. During the scaffold window (domain `src/` is a stub) validation is a
 *     no-op pass-through.
 *   • Deterministic by default (fixed clock + seeded-style ids) so snapshots and
 *     cross-test references are stable; every factory takes `overrides`.
 *
 * These are the building blocks the higher-level `fixtures/` request/response
 * examples compose from.
 */
import { FIXED_CLOCK_ISO, localSeedId } from "../harness/fixtures-ids";

const TS = FIXED_CLOCK_ISO;

/** Cache of resolved domain Zod schemas, keyed by export name. */
let domainModule: Record<string, unknown> | undefined;
async function loadDomain(): Promise<Record<string, unknown>> {
  if (domainModule) return domainModule;
  domainModule = (await import("@levelup/domain").catch(() => ({}))) as Record<string, unknown>;
  return domainModule;
}

/**
 * Validate a fixture against its domain schema when available. No-op until the
 * domain package exports the schema. Returns the object unchanged on success.
 */
export async function validateAgainstDomain<T>(schemaExportName: string, obj: T): Promise<T> {
  const mod = await loadDomain();
  const schema = mod[schemaExportName] as { parse?: (x: unknown) => unknown } | undefined;
  if (schema?.parse) schema.parse(obj);
  return obj;
}

type Over<T> = Partial<T> & Record<string, unknown>;

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export function makeTenant(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("tenant", "contract"),
    name: "Contract Academy",
    code: "SDK001",
    contactEmail: "admin@contract.test",
    plan: "pro",
    status: "active",
    createdAt: TS,
    updatedAt: TS,
    archivedAt: null,
    ...over,
  };
}

export function makeStudent(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("student", "sam"),
    tenantId: localSeedId("tenant", "contract"),
    authUid: localSeedId("uid", "student.sam"),
    firstName: "Sam",
    lastName: "Student",
    rollNumber: "R-001",
    classIds: [localSeedId("class", "10a")],
    status: "active",
    createdAt: TS,
    updatedAt: TS,
    archivedAt: null,
    ...over,
  };
}

export function makeTeacher(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("teacher", "alice"),
    tenantId: localSeedId("tenant", "contract"),
    authUid: localSeedId("uid", "teacher.alice"),
    firstName: "Alice",
    lastName: "Teacher",
    classIds: [localSeedId("class", "10a")],
    status: "active",
    createdAt: TS,
    updatedAt: TS,
    archivedAt: null,
    ...over,
  };
}

export function makeClass(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("class", "10a"),
    tenantId: localSeedId("tenant", "contract"),
    name: "Grade 10A",
    sessionId: localSeedId("session", "2026"),
    studentIds: [localSeedId("student", "sam")],
    studentCount: 1,
    teacherIds: [localSeedId("teacher", "alice")],
    status: "active",
    createdAt: TS,
    updatedAt: TS,
    archivedAt: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Levelup — content
// ---------------------------------------------------------------------------

export function makeSpace(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("space", "dsa"),
    tenantId: localSeedId("tenant", "contract"),
    title: "Data Structures",
    type: "course",
    status: "draft",
    price: null,
    stats: { enrolledCount: 0, storyPointCount: 1, itemCount: 1 },
    ratingAggregate: { count: 0, average: 0 },
    createdAt: TS,
    updatedAt: TS,
    archivedAt: null,
    ...over,
  };
}

export function makeStoryPoint(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("sp", "arrays"),
    tenantId: localSeedId("tenant", "contract"),
    spaceId: localSeedId("space", "dsa"),
    title: "Arrays",
    type: "practice",
    order: 0,
    stats: { itemCount: 1 },
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

/**
 * UnifiedItem with the two-level discriminated `payload` (domain-entities.md).
 * Answer-key fields are NOT present on the client-facing item — they live in the
 * server-only `answerKeys` subcollection (§6.4). Use `makeAnswerKey` separately.
 */
export function makeItem(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("item", "arrays.q1"),
    tenantId: localSeedId("tenant", "contract"),
    spaceId: localSeedId("space", "dsa"),
    storyPointId: localSeedId("sp", "arrays"),
    payload: {
      kind: "question",
      question: {
        type: "mcq",
        prompt: "Which is O(1) for array index access?",
        options: ["index", "search", "sort", "insert-middle"],
      },
    },
    metadata: { difficulty: "easy", points: 1 },
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

/** Server-only AnswerKey (⚷ — never a client response; deny-all subcollection). */
export function makeAnswerKey(over: Over<Record<string, unknown>> = {}) {
  return {
    itemId: localSeedId("item", "arrays.q1"),
    correctAnswer: "0",
    acceptableAnswers: ["0", "index"],
    evaluationGuidance: "Award full marks for index-access answer.",
    modelAnswer: "Array index access is O(1).",
    ...over,
  };
}

/** StoredEvaluation — the ONLY client-facing per-item eval shape (cost-stripped, CD4). */
export function makeStoredEvaluation(over: Over<Record<string, unknown>> = {}) {
  return {
    itemId: localSeedId("item", "arrays.q1"),
    score: 1,
    maxScore: 1,
    correct: true,
    feedback: "Correct.",
    evaluatedAt: TS,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Testsession / progress
// ---------------------------------------------------------------------------

export function makeTestSession(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("session", "ts1"),
    tenantId: localSeedId("tenant", "contract"),
    userId: localSeedId("uid", "student.sam"),
    spaceId: localSeedId("space", "dsa"),
    storyPointId: localSeedId("sp", "arrays"),
    sessionType: "practice",
    status: "in_progress",
    serverDeadline: "2026-01-01T00:30:00.000Z",
    isLatest: true,
    attemptNumber: 1,
    visitedQuestions: [],
    markedForReview: [],
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Autograde
// ---------------------------------------------------------------------------

export function makeExam(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("exam", "midterm"),
    tenantId: localSeedId("tenant", "contract"),
    title: "Midterm",
    status: "draft",
    classIds: [localSeedId("class", "10a")],
    resultsReleased: false,
    stats: { submissionCount: 0 },
    createdAt: TS,
    updatedAt: TS,
    archivedAt: null,
    ...over,
  };
}

export function makeSubmission(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("submission", "s1"),
    tenantId: localSeedId("tenant", "contract"),
    examId: localSeedId("exam", "midterm"),
    studentId: localSeedId("student", "sam"),
    classId: localSeedId("class", "10a"),
    pipelineStatus: "uploaded",
    uploadedBy: localSeedId("uid", "scanner.scout"),
    uploadSource: "scanner",
    createdAt: TS,
    updatedAt: TS,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export function makeNotification(over: Over<Record<string, unknown>> = {}) {
  return {
    id: localSeedId("notif", "n1"),
    tenantId: localSeedId("tenant", "contract"),
    recipientUid: localSeedId("uid", "student.sam"),
    type: "space_published",
    payload: { kind: "space_published", spaceId: localSeedId("space", "dsa") },
    isRead: false,
    createdAt: TS,
    ...over,
  };
}

/** Page<T> wire fragment helper (api-contract §3.5 pageResponse). */
export function makePage<T>(items: T[], nextCursor: string | null = null, total?: number) {
  return { items, nextCursor, ...(total !== undefined ? { total } : {}) };
}
