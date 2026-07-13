/**
 * End-to-end integration test for the full AutoGrade pipeline.
 *
 * Drives every stage of the real backend with mocked LLM/storage:
 *   1. saveExam (create with question paper images)
 *   2. extractQuestions (Gemini extraction, mocked)
 *   3. saveExam (status -> published)
 *   4. uploadAnswerSheets
 *   5. processAnswerMapping (Panopticon scouting, mocked)
 *   6. processAnswerGrading (RELMS per-question grading, mocked)
 *   7. finalizeSubmission (score aggregation)
 *   8. saveExam (status -> results_released)
 *
 * Verifies that each stage produces the exact data shape the NEXT stage consumes:
 *   - exam.status transitions
 *   - exam.questionPaper.images -> extract reads them
 *   - questions collection -> mapping/grading read them
 *   - submission.answerSheets.images -> mapping reads them
 *   - questionSubmissions.mapping.imageUrls -> grading reads them
 *   - questionSubmissions.evaluation.* -> finalize aggregates them
 *   - submission.summary -> released
 *
 * Real modules under test:
 *   - callable/save-exam.ts, callable/extract-questions.ts, callable/upload-answer-sheets.ts
 *   - pipeline/process-answer-mapping.ts, pipeline/process-answer-grading.ts, pipeline/finalize-submission.ts
 *   - utils/firestore-helpers.ts, utils/grading-helpers.ts, utils/grading-queue.ts
 *   - prompts/extraction.ts, prompts/panopticon.ts, prompts/relms.ts (real parsers run against mocked AI text)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted in-memory infrastructure ────────────────────────────────────────
const harness = vi.hoisted(() => {
  type AnyObj = Record<string, any>;

  /** path -> document data */
  const docs = new Map<string, AnyObj>();

  /** storage path -> { buffer, contentType } */
  const storageFiles = new Map<string, { buffer: Buffer; contentType: string }>();

  /** recorded LLM calls */
  const llmCalls: Array<{ prompt: string; metadata: AnyObj; options?: AnyObj }> = [];

  let idCounter = 0;
  const autoId = () => `auto-id-${++idCounter}`;

  // ── Op markers (resolved by applySet/applyUpdate) ──────────────────────────
  const SERVER_TS = "__serverTimestamp";
  const INCREMENT = "__increment";
  const DELETE = "__delete";

  function makeTimestamp(d: Date) {
    return {
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
      toDate: () => d,
      toMillis: () => d.getTime(),
      __isTimestamp: true,
    };
  }

  function isTimestamp(val: any) {
    return (
      val && typeof val === "object" && (val.__isTimestamp || typeof val.toMillis === "function")
    );
  }

  /** Recursively resolve op markers inside a value (for .set writes). */
  function resolveDeep(val: any): any {
    if (val === null || val === undefined) return val;
    if (typeof val !== "object") return val;
    if (val.__op === SERVER_TS) return makeTimestamp(new Date());
    if (val.__op === INCREMENT) return val.value; // increment on .set = raw value
    if (val.__op === DELETE) return undefined;
    if (Array.isArray(val)) return val.map(resolveDeep);
    if (isTimestamp(val)) return val;
    const out: AnyObj = {};
    for (const [k, v] of Object.entries(val)) {
      const r = resolveDeep(v);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }

  function setDottedPath(target: AnyObj, path: string, val: any, currentRoot: AnyObj) {
    const parts = path.split(".");
    let cur = target;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      const existing = cur[p];
      if (existing === null || typeof existing !== "object" || Array.isArray(existing)) {
        cur[p] = {};
      } else {
        cur[p] = { ...existing };
      }
      cur = cur[p];
    }
    const last = parts[parts.length - 1];
    if (val && typeof val === "object" && val.__op === DELETE) {
      delete cur[last];
    } else if (val && typeof val === "object" && val.__op === INCREMENT) {
      cur[last] = (cur[last] ?? 0) + val.value;
    } else if (val && typeof val === "object" && val.__op === SERVER_TS) {
      cur[last] = makeTimestamp(new Date());
    } else {
      cur[last] = resolveDeep(val);
    }
  }

  function applySet(path: string, data: AnyObj) {
    docs.set(path, resolveDeep(data));
  }

  function applyUpdate(path: string, data: AnyObj) {
    const existing = docs.get(path);
    if (!existing) {
      throw new Error(
        `applyUpdate: doc not found at "${path}". (Firestore would throw NOT_FOUND.)`
      );
    }
    const out: AnyObj = { ...existing };
    for (const [k, v] of Object.entries(data)) {
      if (k.includes(".")) {
        setDottedPath(out, k, v, out);
      } else if (v && typeof v === "object" && (v as any).__op === DELETE) {
        delete out[k];
      } else if (v && typeof v === "object" && (v as any).__op === INCREMENT) {
        out[k] = (out[k] ?? 0) + (v as any).value;
      } else if (v && typeof v === "object" && (v as any).__op === SERVER_TS) {
        out[k] = makeTimestamp(new Date());
      } else {
        out[k] = resolveDeep(v);
      }
    }
    docs.set(path, out);
  }

  function getNested(obj: any, path: string): any {
    return path.split(".").reduce((o, p) => (o == null ? undefined : o[p]), obj);
  }

  // ── References ─────────────────────────────────────────────────────────────
  function makeDocRef(path: string): any {
    const ref: any = {
      id: path.split("/").pop()!,
      path,
      get: async () => ({
        exists: docs.has(path),
        id: path.split("/").pop()!,
        data: () => docs.get(path),
        ref,
      }),
      set: async (data: AnyObj) => {
        applySet(path, data);
      },
      update: async (data: AnyObj) => {
        applyUpdate(path, data);
      },
      delete: async () => {
        docs.delete(path);
      },
      collection: (name: string) => makeCollectionRef(`${path}/${name}`),
    };
    return ref;
  }

  function makeCollectionRef(path: string): any {
    const filters: Array<{ field: string; op: string; val: any }> = [];
    let orderField: string | null = null;
    let orderDir: "asc" | "desc" = "asc";
    let limitN: number | undefined;

    function listMatching() {
      const prefix = `${path}/`;
      const items: Array<{ id: string; path: string; data: AnyObj }> = [];
      for (const [docPath, data] of docs.entries()) {
        if (!docPath.startsWith(prefix)) continue;
        const rest = docPath.slice(prefix.length);
        if (rest.includes("/")) continue; // skip nested subcollections
        items.push({ id: rest, path: docPath, data });
      }
      let out = items;
      for (const f of filters) {
        out = out.filter((d) => {
          const v = getNested(d.data, f.field);
          if (f.op === "==") return v === f.val;
          if (f.op === "!=") return v !== f.val;
          if (f.op === "in") return Array.isArray(f.val) && f.val.includes(v);
          if (f.op === ">") return v > f.val;
          if (f.op === ">=") return v >= f.val;
          if (f.op === "<") return v < f.val;
          if (f.op === "<=") return v <= f.val;
          return true;
        });
      }
      if (orderField) {
        const field = orderField;
        out.sort((a, b) => {
          const av = getNested(a.data, field) ?? 0;
          const bv = getNested(b.data, field) ?? 0;
          if (av === bv) return 0;
          const cmp = av > bv ? 1 : -1;
          return orderDir === "asc" ? cmp : -cmp;
        });
      }
      if (typeof limitN === "number") out = out.slice(0, limitN);
      return out;
    }

    function snapshot() {
      const items = listMatching();
      return {
        empty: items.length === 0,
        size: items.length,
        docs: items.map((it) => ({
          id: it.id,
          ref: makeDocRef(it.path),
          data: () => it.data,
          exists: true,
        })),
        forEach: (cb: any) =>
          items.forEach((it) =>
            cb({ id: it.id, ref: makeDocRef(it.path), data: () => it.data, exists: true })
          ),
      };
    }

    const ref: any = {
      path,
      doc: (id?: string) => makeDocRef(`${path}/${id ?? autoId()}`),
      where: (field: string, op: string, val: any) => {
        filters.push({ field, op, val });
        return ref;
      },
      orderBy: (field: string, dir: "asc" | "desc" = "asc") => {
        orderField = field;
        orderDir = dir;
        return ref;
      },
      limit: (n: number) => {
        limitN = n;
        return ref;
      },
      get: async () => snapshot(),
    };
    return ref;
  }

  function makeBatch() {
    const ops: Array<() => void> = [];
    return {
      set: (ref: any, data: AnyObj) => {
        ops.push(() => applySet(ref.path, data));
      },
      update: (ref: any, data: AnyObj) => {
        ops.push(() => applyUpdate(ref.path, data));
      },
      delete: (ref: any) => {
        ops.push(() => {
          docs.delete(ref.path);
        });
      },
      commit: async () => {
        for (const op of ops) op();
      },
    };
  }

  async function runTransaction(fn: any) {
    const txn = {
      get: async (refOrQuery: any) => {
        if (refOrQuery && typeof refOrQuery.get === "function") {
          return refOrQuery.get();
        }
        return refOrQuery;
      },
      set: (ref: any, data: AnyObj) => applySet(ref.path, data),
      update: (ref: any, data: AnyObj) => applyUpdate(ref.path, data),
      delete: (ref: any) => {
        docs.delete(ref.path);
      },
    };
    return fn(txn);
  }

  // ── Firestore namespace ────────────────────────────────────────────────────
  const firestoreFn: any = () => ({
    doc: (path: string) => makeDocRef(path),
    collection: (path: string) => makeCollectionRef(path),
    batch: () => makeBatch(),
    runTransaction,
  });
  firestoreFn.FieldValue = {
    serverTimestamp: () => ({ __op: SERVER_TS }),
    increment: (n: number) => ({ __op: INCREMENT, value: n }),
    delete: () => ({ __op: DELETE }),
  };
  firestoreFn.Timestamp = {
    fromDate: (d: Date) => makeTimestamp(d),
    now: () => makeTimestamp(new Date()),
  };
  firestoreFn.FieldPath = {
    documentId: () => "__name__",
  };

  // ── Storage namespace ──────────────────────────────────────────────────────
  const storageFn = () => ({
    bucket: (_name?: string) => ({
      file: (filePath: string) => ({
        download: async () => {
          const f = storageFiles.get(filePath) ?? {
            buffer: Buffer.from(`mock-bytes:${filePath}`),
            contentType: "image/jpeg",
          };
          return [f.buffer];
        },
        getMetadata: async () => {
          const f = storageFiles.get(filePath) ?? {
            buffer: Buffer.from(`mock-bytes:${filePath}`),
            contentType: "image/jpeg",
          };
          return [{ contentType: f.contentType }];
        },
      }),
    }),
  });

  // ── LLM mock — dispatches via metadata.purpose ─────────────────────────────
  let fixtureBuilder: (metadata: AnyObj, options?: AnyObj) => string = () => "{}";

  class MockLLMWrapper {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_cfg?: any) {}
    async call(prompt: string, metadata: AnyObj, options?: AnyObj) {
      llmCalls.push({ prompt, metadata, options });
      const text = fixtureBuilder(metadata, options);
      return {
        text,
        parsed: null,
        tokens: { input: 100, output: 50, total: 150 },
        cost: { input: 0.001, output: 0.002, total: 0.003, currency: "USD" },
        latencyMs: 50,
        model: "gemini-2.5-flash",
      };
    }
  }

  return {
    docs,
    storageFiles,
    llmCalls,
    MockLLMWrapper,
    firestoreFn,
    storageFn,
    makeTimestamp,
    setFixtureBuilder(fn: (metadata: AnyObj, options?: AnyObj) => string) {
      fixtureBuilder = fn;
    },
    reset() {
      docs.clear();
      storageFiles.clear();
      llmCalls.length = 0;
      idCounter = 0;
      fixtureBuilder = () => "{}";
    },
  };
});

// ─── vi.mock ─── must reference only hoisted `harness` ───────────────────────
vi.mock("firebase-admin", () => {
  return {
    default: {
      initializeApp: vi.fn(),
      firestore: harness.firestoreFn,
      storage: harness.storageFn,
    },
    initializeApp: vi.fn(),
    firestore: harness.firestoreFn,
    storage: harness.storageFn,
  };
});

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: harness.firestoreFn.Timestamp,
  FieldValue: harness.firestoreFn.FieldValue,
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts: any, handler: Function) => handler,
  HttpsError: class HttpsError extends Error {
    code: string;
    details: any;
    constructor(code: string, message: string, details?: any) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

vi.mock("firebase-functions/v2", () => ({
  logger: {
    error: (..._args: any[]) => {},
    warn: (..._args: any[]) => {},
    info: (..._args: any[]) => {},
    log: (..._args: any[]) => {},
    debug: (..._args: any[]) => {},
  },
}));

vi.mock("../utils/llm", () => ({
  LLMWrapper: harness.MockLLMWrapper,
  getGeminiApiKey: async () => "mock-api-key",
}));

vi.mock("../utils/assertions", () => ({
  getCallerMembership: (req: any) => ({
    uid: req?.auth?.uid ?? "teacher-uid",
    tenantId: req?.auth?.token?.tenantId ?? "tenant-1",
    role: req?.auth?.token?.role ?? "teacher",
    permissions: {
      canCreateExams: true,
      canEditRubrics: true,
      canManuallyGrade: true,
      canReleaseResults: true,
      canGradeSubmissions: true,
    },
  }),
  assertAutogradePermission: () => {},
}));

vi.mock("../utils/rate-limit", () => ({
  enforceRateLimit: async () => {},
}));

vi.mock("../utils/image-quality", () => ({
  assessImageQuality: () => ({ overallAcceptable: true, warnings: [] }),
}));

vi.mock("../utils/notification-sender", () => ({
  sendNotification: async () => {},
  sendBulkNotifications: async () => 0,
}));

// `process-answer-grading` does `await import('@levelup/shared-services/ai')` at runtime
// for a usage-quota check. We intentionally don't mock that workspace path here — the
// import is wrapped in try/catch and the function falls through to grading when it fails.

// ─── Imports of REAL code under test (after mocks) ───────────────────────────
import { saveExam } from "../callable/save-exam";
import { extractQuestions } from "../callable/extract-questions";
import { uploadAnswerSheets } from "../callable/upload-answer-sheets";
import { processAnswerMapping } from "../pipeline/process-answer-mapping";
import { processAnswerGrading } from "../pipeline/process-answer-grading";
import { finalizeSubmission } from "../pipeline/finalize-submission";

// ─── Test helpers ────────────────────────────────────────────────────────────
function makeRequest(data: any, uid = "teacher-uid") {
  return {
    data,
    auth: { uid, token: { tenantId: "tenant-1", role: "teacher" } },
    rawRequest: {} as any,
  };
}

function seedTenant() {
  harness.docs.set("tenants/tenant-1", {
    id: "tenant-1",
    name: "Test School",
    settings: {},
    usage: { examsThisMonth: 0 },
  });
}

function seedStudent() {
  harness.docs.set("tenants/tenant-1/students/student-1", {
    id: "student-1",
    firstName: "Alice",
    lastName: "Smith",
    rollNumber: "001",
    classIds: ["class-1"],
  });
}

function seedStorageImage(path: string) {
  harness.storageFiles.set(path, {
    buffer: Buffer.from(`mock-bytes:${path}`),
    contentType: "image/jpeg",
  });
}

// ─── Deterministic mocked-AI fixtures ────────────────────────────────────────
const EXTRACTED_QUESTIONS_FIXTURE = JSON.stringify({
  questions: [
    {
      questionNumber: "Q1",
      text: "Solve for x: 2x + 3 = 7",
      maxMarks: 5,
      hasDiagram: false,
      questionType: "standard",
      extractionConfidence: 0.95,
      readabilityIssue: false,
      rubric: {
        criteria: [
          { name: "Correct setup", maxPoints: 2 },
          { name: "Correct solution", maxPoints: 3 },
        ],
      },
    },
    {
      questionNumber: "Q2",
      text: "Define photosynthesis in one sentence.",
      maxMarks: 5,
      hasDiagram: false,
      questionType: "standard",
      extractionConfidence: 0.9,
      readabilityIssue: false,
      rubric: {
        criteria: [{ name: "Accurate definition", maxPoints: 5 }],
      },
    },
  ],
});

const PANOPTICON_FIXTURE = JSON.stringify({
  routing_map: { Q1: [0], Q2: [1] },
  confidence: { Q1: 0.95, Q2: 0.92 },
});

function relmsFixture(questionId: string) {
  // Q1 -> 4/5 (high confidence, graded). Q2 -> 5/5 (high confidence, graded).
  const score = questionId === "Q1" ? 4 : 5;
  return JSON.stringify({
    rubric_score: score,
    max_rubric_score: 5,
    confidence_score: 0.95,
    rubric_breakdown: [{ criterion: "mock", awarded: score, max: 5, feedback: "ok" }],
    structuredFeedback: {},
    strengths: ["mock strength"],
    weaknesses: [],
    missingConcepts: [],
    summary: { keyTakeaway: "mock", overallComment: "mock" },
    mistake_classification: "None",
  });
}

// ─── The E2E test ────────────────────────────────────────────────────────────
describe("AutoGrade pipeline — end-to-end with mocked AI", () => {
  beforeEach(() => {
    harness.reset();
    seedTenant();
    seedStudent();
    // Pre-stage storage objects for both QP and answer sheets so download() works.
    seedStorageImage("tenants/tenant-1/question-papers/page1.jpg");
    seedStorageImage("tenants/tenant-1/submissions/sub-test/p1.jpg");
    seedStorageImage("tenants/tenant-1/submissions/sub-test/p2.jpg");

    harness.setFixtureBuilder((metadata) => {
      const purpose = metadata?.purpose;
      if (purpose === "question_extraction") return EXTRACTED_QUESTIONS_FIXTURE;
      if (purpose === "answer_mapping") return PANOPTICON_FIXTURE;
      if (purpose === "answer_grading") {
        // resourceId = `${submissionId}/${qs.questionId}` — extract the trailing question id
        const rid: string = metadata?.resourceId ?? "";
        const qid = rid.split("/").pop() ?? "Q1";
        return relmsFixture(qid);
      }
      return "{}";
    });
  });

  it("drives create-exam → extract → publish → upload → mapping → grading → finalize → release", async () => {
    // ── STAGE 1: saveExam (CREATE) ────────────────────────────────────────
    const createResp = await (saveExam as any)(
      makeRequest({
        tenantId: "tenant-1",
        data: {
          title: "Math Mid-Term",
          subject: "Mathematics",
          topics: ["Algebra"],
          classIds: ["class-1"],
          totalMarks: 10,
          passingMarks: 4,
          questionPaperImages: ["tenants/tenant-1/question-papers/page1.jpg"],
        },
      })
    );
    expect(createResp.created).toBe(true);
    const examId = createResp.id;
    const examPath = `tenants/tenant-1/exams/${examId}`;

    const examAfterCreate = harness.docs.get(examPath)!;
    expect(examAfterCreate).toBeDefined();
    // CONTRACT: exam doc carries images for the extractor and lands in 'question_paper_uploaded'
    expect(examAfterCreate.status).toBe("question_paper_uploaded");
    expect(examAfterCreate.questionPaper).toBeTruthy();
    expect(examAfterCreate.questionPaper.images).toEqual([
      "tenants/tenant-1/question-papers/page1.jpg",
    ]);
    expect(examAfterCreate.totalMarks).toBe(10);
    expect(examAfterCreate.tenantId).toBe("tenant-1");

    // ── STAGE 2: extractQuestions (mocked Gemini) ─────────────────────────
    const extractResp = await (extractQuestions as any)(
      makeRequest({ tenantId: "tenant-1", examId })
    );
    expect(extractResp.success).toBe(true);
    expect(extractResp.questions).toHaveLength(2);
    expect(extractResp.metadata.questionCount).toBe(2);

    // CONTRACT: exam status moved forward, questionPaper.questionCount stamped
    const examAfterExtract = harness.docs.get(examPath)!;
    expect(examAfterExtract.status).toBe("question_paper_extracted");
    expect(examAfterExtract.questionPaper.questionCount).toBe(2);

    // CONTRACT: each question doc is written under exams/{examId}/questions/{id}
    //           with rubric.criteria summing to maxMarks
    const q1Doc = harness.docs.get(`${examPath}/questions/Q1`)!;
    const q2Doc = harness.docs.get(`${examPath}/questions/Q2`)!;
    expect(q1Doc).toBeDefined();
    expect(q1Doc.maxMarks).toBe(5);
    expect(q1Doc.order).toBe(0);
    expect(q1Doc.rubric.criteria).toHaveLength(2);
    expect(q1Doc.rubric.criteria.reduce((s: number, c: any) => s + c.maxPoints, 0)).toBe(5);
    expect(q1Doc.extractedBy).toBe("ai");
    expect(q2Doc.maxMarks).toBe(5);
    expect(q2Doc.order).toBe(1);

    // ── STAGE 3: saveExam (PUBLISH transition) ────────────────────────────
    await (saveExam as any)(
      makeRequest({
        tenantId: "tenant-1",
        id: examId,
        data: { status: "published" },
      })
    );
    expect(harness.docs.get(examPath)!.status).toBe("published");

    // ── STAGE 4: uploadAnswerSheets ───────────────────────────────────────
    const uploadResp = await (uploadAnswerSheets as any)(
      makeRequest({
        tenantId: "tenant-1",
        examId,
        studentId: "student-1",
        classId: "class-1",
        imageUrls: [
          "tenants/tenant-1/submissions/sub-test/p1.jpg",
          "tenants/tenant-1/submissions/sub-test/p2.jpg",
        ],
      })
    );
    const submissionId = uploadResp.submissionId;
    expect(submissionId).toBeTruthy();
    const subPath = `tenants/tenant-1/submissions/${submissionId}`;

    const subAfterUpload = harness.docs.get(subPath)!;
    // CONTRACT: submission lands with pipelineStatus='uploaded' and the image
    //           paths exactly where processAnswerMapping reads them.
    expect(subAfterUpload.pipelineStatus).toBe("uploaded");
    expect(subAfterUpload.answerSheets.images).toEqual([
      "tenants/tenant-1/submissions/sub-test/p1.jpg",
      "tenants/tenant-1/submissions/sub-test/p2.jpg",
    ]);
    expect(subAfterUpload.answerSheets.uploadSource).toBe("web");
    expect(subAfterUpload.studentName).toBe("Alice Smith");
    expect(subAfterUpload.rollNumber).toBe("001");
    expect(subAfterUpload.classId).toBe("class-1");
    expect(subAfterUpload.summary.maxScore).toBe(10);
    expect(subAfterUpload.summary.totalQuestions).toBe(2);

    // CONTRACT: first submission flips exam to 'grading' and increments stats.
    expect(harness.docs.get(examPath)!.status).toBe("grading");
    expect(harness.docs.get(examPath)!.stats.totalSubmissions).toBe(1);

    // ── STAGE 5: processAnswerMapping (Panopticon, mocked) ────────────────
    await processAnswerMapping("tenant-1", submissionId);

    const subAfterMapping = harness.docs.get(subPath)!;
    expect(subAfterMapping.pipelineStatus).toBe("scouting_complete");
    expect(subAfterMapping.scoutingResult.routingMap).toEqual({ Q1: [0], Q2: [1] });

    // CONTRACT: one questionSubmission per question, mapping carries pageIndices+imageUrls
    //           that the grader will read directly from storage.
    const qs1Path = `${subPath}/questionSubmissions/Q1`;
    const qs2Path = `${subPath}/questionSubmissions/Q2`;
    const qs1 = harness.docs.get(qs1Path)!;
    const qs2 = harness.docs.get(qs2Path)!;
    expect(qs1.gradingStatus).toBe("pending");
    expect(qs1.examId).toBe(examId);
    expect(qs1.submissionId).toBe(submissionId);
    expect(qs1.mapping.pageIndices).toEqual([0]);
    expect(qs1.mapping.imageUrls).toEqual(["tenants/tenant-1/submissions/sub-test/p1.jpg"]);
    expect(qs2.gradingStatus).toBe("pending");
    expect(qs2.mapping.pageIndices).toEqual([1]);
    expect(qs2.mapping.imageUrls).toEqual(["tenants/tenant-1/submissions/sub-test/p2.jpg"]);

    // ── STAGE 6: processAnswerGrading (RELMS, mocked) ─────────────────────
    await processAnswerGrading("tenant-1", submissionId);

    const qs1Graded = harness.docs.get(qs1Path)!;
    const qs2Graded = harness.docs.get(qs2Path)!;
    // CONTRACT: each questionSubmission now carries an evaluation object the
    //           finalizer aggregates from.
    expect(qs1Graded.gradingStatus).toBe("graded");
    expect(qs1Graded.evaluation.score).toBe(4);
    expect(qs1Graded.evaluation.maxScore).toBe(5);
    expect(qs1Graded.evaluation.percentage).toBe(80);
    expect(qs1Graded.evaluation.confidence).toBeGreaterThanOrEqual(0.9);
    expect(qs2Graded.gradingStatus).toBe("graded");
    expect(qs2Graded.evaluation.score).toBe(5);
    expect(qs2Graded.evaluation.maxScore).toBe(5);

    // CONTRACT: after all questions graded, processAnswerGrading's terminal
    //           transaction flips submission to 'grading_complete'.
    expect(harness.docs.get(subPath)!.pipelineStatus).toBe("grading_complete");

    // ── STAGE 7: finalizeSubmission ───────────────────────────────────────
    await finalizeSubmission("tenant-1", submissionId);

    const finalSub = harness.docs.get(subPath)!;
    // CONTRACT: finalize stamps summary {totalScore, maxScore, percentage, grade,
    //           questionsGraded, totalQuestions, completedAt} and flips status.
    expect(finalSub.pipelineStatus).toBe("ready_for_review");
    expect(finalSub.summary.totalScore).toBe(9);
    expect(finalSub.summary.maxScore).toBe(10);
    expect(finalSub.summary.percentage).toBe(90);
    expect(finalSub.summary.grade).toBe("A+");
    expect(finalSub.summary.questionsGraded).toBe(2);
    expect(finalSub.summary.totalQuestions).toBe(2);

    // CONTRACT: exam.stats.gradedSubmissions incremented
    expect(harness.docs.get(examPath)!.stats.gradedSubmissions).toBe(1);

    // ── STAGE 8: saveExam (RELEASE RESULTS) ───────────────────────────────
    await (saveExam as any)(
      makeRequest({
        tenantId: "tenant-1",
        id: examId,
        data: { status: "results_released" },
      })
    );

    const releasedExam = harness.docs.get(examPath)!;
    const releasedSub = harness.docs.get(subPath)!;
    expect(releasedExam.status).toBe("results_released");
    expect(releasedSub.resultsReleased).toBe(true);
    expect(releasedSub.resultsReleasedBy).toBe("teacher-uid");

    // ── LLM dispatch sanity: one extraction, one mapping, two grading calls ──
    const purposes = harness.llmCalls.map((c) => c.metadata.purpose);
    expect(purposes.filter((p) => p === "question_extraction")).toHaveLength(1);
    expect(purposes.filter((p) => p === "answer_mapping")).toHaveLength(1);
    expect(purposes.filter((p) => p === "answer_grading")).toHaveLength(2);
  });

  it("contract: questionSubmission.mapping.imageUrls is the exact subset of submission.answerSheets.images chosen by Panopticon", async () => {
    // This narrow check pins the hand-off shape between mapping and grading
    // so a future refactor that changes either side breaks the test, not prod.
    const examResp = await (saveExam as any)(
      makeRequest({
        tenantId: "tenant-1",
        data: {
          title: "T",
          subject: "S",
          classIds: ["class-1"],
          totalMarks: 10,
          questionPaperImages: ["tenants/tenant-1/question-papers/page1.jpg"],
        },
      })
    );
    const examId = examResp.id;
    await (extractQuestions as any)(makeRequest({ tenantId: "tenant-1", examId }));
    await (saveExam as any)(
      makeRequest({ tenantId: "tenant-1", id: examId, data: { status: "published" } })
    );
    const uploadResp = await (uploadAnswerSheets as any)(
      makeRequest({
        tenantId: "tenant-1",
        examId,
        studentId: "student-1",
        classId: "class-1",
        imageUrls: [
          "tenants/tenant-1/submissions/sub-test/p1.jpg",
          "tenants/tenant-1/submissions/sub-test/p2.jpg",
        ],
      })
    );
    await processAnswerMapping("tenant-1", uploadResp.submissionId);

    const sub = harness.docs.get(`tenants/tenant-1/submissions/${uploadResp.submissionId}`)!;
    const qs1 = harness.docs.get(
      `tenants/tenant-1/submissions/${uploadResp.submissionId}/questionSubmissions/Q1`
    )!;
    const qs2 = harness.docs.get(
      `tenants/tenant-1/submissions/${uploadResp.submissionId}/questionSubmissions/Q2`
    )!;

    // mapping.imageUrls MUST be a subset of submission.answerSheets.images,
    // chosen by the pageIndices the LLM emitted.
    const allImages: string[] = sub.answerSheets.images;
    for (const url of qs1.mapping.imageUrls) expect(allImages).toContain(url);
    for (const url of qs2.mapping.imageUrls) expect(allImages).toContain(url);
    expect(qs1.mapping.imageUrls).toEqual(qs1.mapping.pageIndices.map((i: number) => allImages[i]));
    expect(qs2.mapping.imageUrls).toEqual(qs2.mapping.pageIndices.map((i: number) => allImages[i]));
  });
});
