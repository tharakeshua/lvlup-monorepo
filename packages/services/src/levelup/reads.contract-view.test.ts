/**
 * LVL-1 — v1 levelup reads emit contract-canonical views for BOTH legacy-shaped
 * and canonical docs (the validateResponses:true holdout — AG-3 playbook applied
 * to the levelup surface).
 *
 * Locked drift classes (U4.2 audit):
 *   - key drift:            `order` → `orderIndex`, `effectiveRubric` → `rubric`,
 *                           `totalScore`/`maxScore` → `pointsEarned`/`totalPoints`
 *   - enum drift:           storyPoint type 'test' → 'timed_test',
 *                           sessionType 'test'/'exam' → 'timed_test' (domain read-adapters)
 *   - timestamps-at-rest:   Firestore Timestamp objects → canonical ISO (toTimestamp)
 *   - required-nullables:   omitted publishedAt/archivedAt/endedAt/serverDeadline/
 *                           submittedAt/completedAt/startedAt → null
 *   - supersets:            audit/seed leftovers dropped by STRICT KEY WHITELISTS
 *
 * Every case parses the service response through the STRICT api-contract response
 * schema — the exact predicate `validateResponses:true` runs client-side.
 */
import { describe, it, expect } from "vitest";
import { getCallable } from "@levelup/api-contract";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import {
  listSpacesService,
  getSpaceService,
  listStoryPointsService,
  getStoryPointService,
  listItemsService,
  getItemForEditService,
} from "./content";
import {
  startTestSessionService,
  submitTestSessionService,
  getTestSessionService,
  listTestSessionsService,
} from "./test-session";
import { getSpaceProgressService, getStoryPointProgressService } from "./practice";

type Doc = Record<string, unknown>;

const TS = "2026-01-01T00:00:00.000Z";
/** Admin-serialized Firestore Timestamp (the at-rest shape U4.2 found on real data). */
const FSTS = { _seconds: 1767225600, _nanoseconds: 0 }; // → 2026-01-01T00:00:00.000Z
/** Duck-typed client Firestore Timestamp. */
const FSTS_DUCK = { seconds: 1767225600, nanoseconds: 0 };

/** Minimal-but-VALID canonical rubric (criteria mode) + ⚷ guidance for strip tests. */
const RUBRIC_WITH_GUIDANCE = {
  scoringMode: "criteria_based",
  criteria: [],
  modelAnswer: "the model answer",
  evaluatorGuidance: "grade harshly",
};

function parseAs(name: string, res: unknown): { success: boolean; error?: unknown } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (getCallable(name as never).responseSchema as any).safeParse(res);
  if (!r.success) {
    // Surface the zod error in the assertion diff.
    // eslint-disable-next-line no-console
    console.error(`${name} view failed:`, JSON.stringify(r.error.issues, null, 2));
  }
  return r;
}

describe("LVL-1 — levelup reads emit contract-canonical views (legacy + canonical docs)", () => {
  // ───────────────────────────── spaces ─────────────────────────────
  describe("listSpaces / getSpace", () => {
    async function seedSpaces() {
      const teacher = makeAuthContext("teacher");
      const tenantId = teacher.tenantId!;
      // LEGACY-shaped: numeric price, legacy agg keys, Firestore-Timestamp-at-rest,
      // omitted required-nullables, audit-field supersets.
      await teacher.repos.spaces.upsert(tenantId, {
        id: "space_legacy",
        title: "Legacy Space",
        type: "learning",
        status: "published",
        publishedAt: FSTS,
        price: 4999,
        stats: { storyPointCount: 2, itemCount: 10, enrollmentCount: 5, studentCount: 5 },
        ratingAggregate: { average: 4.5, count: 12 },
        defaultRubric: RUBRIC_WITH_GUIDANCE,
        // supersets that must NOT leak:
        migrationBatch: "b1",
        createdByName: "Teacher T",
        searchTokens: ["legacy"],
        // omitted: archivedAt, classIds, teacherIds, accessType, createdBy
      });
      // CANONICAL: passes through unchanged.
      await teacher.repos.spaces.upsert(tenantId, {
        id: "space_canonical",
        title: "Canonical Space",
        type: "practice",
        subject: "Math",
        classIds: ["class_1"],
        teacherIds: ["teacher_1"],
        accessType: "tenant_wide",
        status: "published",
        publishedAt: TS,
        price: { amountMinor: 9900, currency: "INR" },
        stats: { storyPointCount: 1, itemCount: 3, enrolledCount: 2, completionCount: 0 },
        createdBy: "uid_author",
        updatedBy: "uid_author",
        archivedAt: null,
      });
      return { teacher, tenantId };
    }

    it("legacy space → strict SpaceView (price coerced, agg keys collapsed, supersets dropped)", async () => {
      const { teacher, tenantId } = await seedSpaces();
      const student = makeAuthContext("student", { repos: teacher.repos });
      void tenantId;
      const res = (await listSpacesService({} as never, student)) as unknown as Doc;
      expect(parseAs("v1.levelup.listSpaces", res).success).toBe(true);

      const legacy = (res["items"] as Doc[]).find((s) => s["id"] === "space_legacy")!;
      expect(legacy["price"]).toEqual({ amountMinor: 4999, currency: "INR" });
      expect(legacy["publishedAt"]).toBe(TS); // Firestore Timestamp → canonical ISO
      expect(legacy["archivedAt"]).toBeNull(); // omitted required-nullable → null
      expect(legacy["classIds"]).toEqual([]);
      expect((legacy["stats"] as Doc)["enrolledCount"]).toBe(5); // enrollmentCount alias
      expect((legacy["ratingAggregate"] as Doc)["averageRating"]).toBe(4.5);
      expect(legacy["migrationBatch"]).toBeUndefined();
      expect(legacy["createdByName"]).toBeUndefined();
      // non-authoring: rubric guidance stripped
      expect((legacy["defaultRubric"] as Doc)["modelAnswer"]).toBeUndefined();
      expect((legacy["defaultRubric"] as Doc)["evaluatorGuidance"]).toBeUndefined();
    });

    it("canonical space round-trips through getSpace unchanged", async () => {
      const { teacher } = await seedSpaces();
      const res = (await getSpaceService(
        { spaceId: "space_canonical" } as never,
        teacher
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.getSpace", res).success).toBe(true);
      const space = res["space"] as Doc;
      expect(space["price"]).toEqual({ amountMinor: 9900, currency: "INR" });
      expect(space["accessType"]).toBe("tenant_wide");
      expect(space["classIds"]).toEqual(["class_1"]);
      expect(space["createdBy"]).toBe("uid_author");
    });
  });

  // ───────────────────────── story points ───────────────────────────
  describe("listStoryPoints / getStoryPoint", () => {
    async function seedStoryPoints() {
      const teacher = makeAuthContext("teacher");
      const tenantId = teacher.tenantId!;
      await teacher.repos.spaces.upsert(tenantId, {
        id: "space_1",
        title: "S",
        type: "learning",
        status: "published",
      });
      // LEGACY: 'order' key, type 'test', durationSeconds + top-level durationMinutes,
      // Firestore-Timestamp schedule, supersets.
      await teacher.repos.storyPoints.upsert(tenantId, {
        id: "sp_legacy",
        spaceId: "space_1",
        title: "Legacy SP",
        order: 3,
        type: "test",
        durationSeconds: 2700,
        durationMinutes: 45,
        assessmentConfig: {
          maxAttempts: 2,
          schedule: { opensAt: FSTS_DUCK, closesAt: null },
        },
        stats: { itemCount: 4, completionCount: 1, viewCount: 99 },
        legacyImportId: "imp_1", // superset
      });
      // CANONICAL
      await teacher.repos.storyPoints.upsert(tenantId, {
        id: "sp_canonical",
        spaceId: "space_1",
        title: "Canonical SP",
        orderIndex: 1,
        type: "quiz",
        sections: [],
        createdBy: "uid_author",
        updatedBy: "uid_author",
        archivedAt: null,
      });
      return { teacher, tenantId };
    }

    it("legacy story point → strict StoryPointView (order→orderIndex, 'test'→'timed_test')", async () => {
      const { teacher } = await seedStoryPoints();
      const res = (await listStoryPointsService(
        { spaceId: "space_1" } as never,
        teacher
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.listStoryPoints", res).success).toBe(true);

      const legacy = (res["items"] as Doc[]).find((s) => s["id"] === "sp_legacy")!;
      expect(legacy["orderIndex"]).toBe(3);
      expect(legacy["order"]).toBeUndefined();
      expect(legacy["type"]).toBe("timed_test"); // THE holdout drift
      expect(legacy["durationSeconds"]).toBeUndefined();
      expect((legacy["assessmentConfig"] as Doc)["durationMinutes"]).toBe(45); // folded in
      expect(((legacy["assessmentConfig"] as Doc)["schedule"] as Doc)["opensAt"]).toBe(TS);
      expect(legacy["archivedAt"]).toBeNull();
      expect(legacy["legacyImportId"]).toBeUndefined();
      expect(legacy["stats"]).toEqual({ itemCount: 4, completionCount: 1 });
    });

    it("canonical story point round-trips through getStoryPoint", async () => {
      const { teacher } = await seedStoryPoints();
      const res = (await getStoryPointService(
        { spaceId: "space_1", storyPointId: "sp_canonical" } as never,
        teacher
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.getStoryPoint", res).success).toBe(true);
      const sp = res["storyPoint"] as Doc;
      expect(sp["type"]).toBe("quiz");
      expect(sp["orderIndex"]).toBe(1);
    });
  });

  // ───────────────────────────── items ──────────────────────────────
  describe("listItems / getItemForEdit", () => {
    async function seedItems() {
      const teacher = makeAuthContext("teacher");
      const tenantId = teacher.tenantId!;
      // LEGACY: one-level `kind` payload, `order`, `effectiveRubric`, inline answer
      // fields, supersets.
      await teacher.repos.items.upsert(tenantId, {
        id: "item_legacy",
        spaceId: "space_1",
        storyPointId: "sp_1",
        order: 2,
        payload: {
          kind: "question",
          questionType: "short_answer",
          prompt: "What is 2+2?",
          points: 5,
          modelAnswer: "4", // ⚷ must never leave (learner read)
        },
        effectiveRubric: RUBRIC_WITH_GUIDANCE,
        extractedBy: "importer", // superset
      });
      // CANONICAL two-level payload.
      await teacher.repos.items.upsert(tenantId, {
        id: "item_canonical",
        spaceId: "space_1",
        storyPointId: "sp_1",
        type: "question",
        payload: {
          type: "question",
          basePoints: 5,
          questionData: { questionType: "mcq", options: [{ id: "a", text: "4" }] },
        },
        content: "Pick 2+2",
        orderIndex: 1,
        createdBy: "uid_author",
        updatedBy: "uid_author",
        archivedAt: null,
      });
      return { teacher, tenantId };
    }

    it("legacy item → strict ItemView for a LEARNER (answers gone, rubric guidance stripped)", async () => {
      const { teacher } = await seedItems();
      const student = makeAuthContext("student", { repos: teacher.repos });
      const res = (await listItemsService(
        { spaceId: "space_1", storyPointId: "sp_1" } as never,
        student
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.listItems", res).success).toBe(true);

      const legacy = (res["items"] as Doc[]).find((i) => i["id"] === "item_legacy")!;
      expect(legacy["orderIndex"]).toBe(2);
      expect(legacy["order"]).toBeUndefined();
      expect(legacy["type"]).toBe("question");
      expect((legacy["payload"] as Doc)["type"]).toBe("question");
      expect(legacy["extractedBy"]).toBeUndefined();
      expect(legacy["effectiveRubric"]).toBeUndefined();
      expect(JSON.stringify(legacy)).not.toContain("modelAnswer");
      expect(JSON.stringify(legacy)).not.toContain("evaluatorGuidance");
    });

    it("getItemForEdit → strict ItemEditView with the ⚷ answerKey KEPT (authoring)", async () => {
      const { teacher, tenantId } = await seedItems();
      // Stored key doc carries the storage-only scope keys + omits audit fields.
      await teacher.repos.answerKeys.put(tenantId, "item_canonical", {
        correctAnswer: "a",
        modelAnswer: "4 is correct",
        itemId: "item_canonical",
        spaceId: "space_1",
        storyPointId: "sp_1",
      });
      const res = (await getItemForEditService(
        { spaceId: "space_1", itemId: "item_canonical" } as never,
        teacher
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.getItemForEdit", res).success).toBe(true);
      const item = res["item"] as Doc;
      const key = item["answerKey"] as Doc;
      expect(key["correctAnswer"]).toBe("a");
      expect(key["modelAnswer"]).toBe("4 is correct"); // NOT stripped on the edit path
      expect(key["questionType"]).toBe("mcq"); // back-filled from the payload
      expect(key["spaceId"]).toBeUndefined(); // storage-only scope keys dropped
      expect(key["storyPointId"]).toBeUndefined();
    });
  });

  // ───────────────────────── test sessions ──────────────────────────
  describe("test-session reads", () => {
    function seedSessionWorld() {
      const student = makeAuthContext("student");
      const tenantId = student.tenantId!;
      return { student, tenantId };
    }

    it("legacy session doc → strict DigitalTestSessionView (getTestSession)", async () => {
      const { student, tenantId } = seedSessionWorld();
      await student.repos.testSessions.upsert(tenantId, {
        id: "sess_legacy",
        userId: student.uid,
        spaceId: "space_1",
        storyPointId: "sp_1",
        sessionType: "test", // legacy → timed_test
        status: "completed",
        totalScore: 8, // legacy score keys → pointsEarned/totalPoints
        maxScore: 10,
        startedAt: FSTS,
        submittedAt: FSTS_DUCK,
        deviceInfo: { os: "android" }, // superset
        // omitted: attemptNumber, isLatest, endedAt, serverDeadline, durationMinutes,
        //          totalQuestions, answeredQuestions, questionOrder, maps
      });
      const res = (await getTestSessionService(
        { sessionId: "sess_legacy" } as never,
        student
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.getTestSession", res).success).toBe(true);
      const s = res["session"] as Doc;
      expect(s["sessionType"]).toBe("timed_test");
      expect(s["pointsEarned"]).toBe(8);
      expect(s["totalPoints"]).toBe(10);
      expect(s["startedAt"]).toBe(TS);
      expect(s["submittedAt"]).toBe(TS);
      expect(s["endedAt"]).toBeNull();
      expect(s["serverDeadline"]).toBeNull();
      expect(s["deviceInfo"]).toBeUndefined();
    });

    it("listTestSessions emits the COMPACT summary view (not the raw doc)", async () => {
      const { student, tenantId } = seedSessionWorld();
      await student.repos.testSessions.upsert(tenantId, {
        id: "sess_l1",
        userId: student.uid,
        spaceId: "space_1",
        storyPointId: "sp_1",
        sessionType: "exam", // legacy → timed_test
        status: "completed",
        percentage: 80,
        startedAt: TS,
        submittedAt: TS,
        visitedQuestions: { q1: true }, // full-doc key — must NOT appear in summary
      });
      const res = (await listTestSessionsService({} as never, student)) as unknown as Doc;
      expect(parseAs("v1.levelup.listTestSessions", res).success).toBe(true);
      const item = (res["items"] as Doc[])[0]!;
      expect(item["sessionType"]).toBe("timed_test");
      expect(item["visitedQuestions"]).toBeUndefined();
      expect(item["userId"]).toBeUndefined();
      expect(item["percentage"]).toBe(80);
    });

    it("startTestSession + submitTestSession views validate (canonical write path)", async () => {
      const { student, tenantId } = seedSessionWorld();
      await student.repos.storyPoints.upsert(tenantId, {
        id: "sp_timed",
        spaceId: "space_1",
        title: "Timed",
        orderIndex: 0,
        type: "test", // legacy stored type — session must come out 'timed_test'
        durationMinutes: 10,
      });
      await student.repos.items.upsert(tenantId, {
        id: "item_q1",
        spaceId: "space_1",
        storyPointId: "sp_timed",
        orderIndex: 0,
        payload: { kind: "question", questionType: "short_answer", prompt: "Q1" },
      });

      const started = (await startTestSessionService(
        { spaceId: "space_1", storyPointId: "sp_timed" } as never,
        student
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.startTestSession", started).success).toBe(true);
      const session = started["session"] as Doc;
      expect(session["sessionType"]).toBe("timed_test");
      expect(session["serverDeadline"]).not.toBeNull();

      const submitted = (await submitTestSessionService(
        { sessionId: session["id"] as string } as never,
        student
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.submitTestSession", submitted).success).toBe(true);
      expect((submitted["session"] as Doc)["status"]).toBe("completed");

      // Idempotent re-submit ALSO returns a canonical view.
      const resubmitted = (await submitTestSessionService(
        { sessionId: session["id"] as string } as never,
        student
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.submitTestSession", resubmitted).success).toBe(true);
    });
  });

  // ─────────────────────────── progress ─────────────────────────────
  describe("progress reads", () => {
    async function seedProgress() {
      const student = makeAuthContext("student");
      const tenantId = student.tenantId!;
      await student.repos.progress.update(tenantId, {
        userId: student.uid,
        spaceId: "space_1",
        items: [
          {
            storyPointId: "sp_1",
            itemId: "item_1",
            score: 5,
            maxScore: 5,
            correct: true,
            evaluation: {
              score: 5,
              maxScore: 5,
              correctness: 1,
              percentage: 100,
              strengths: [],
              weaknesses: [],
              missingConcepts: [],
              tokensUsed: 123, // superset-ish key on a stored eval — must be dropped
            },
          },
        ],
      });
      return { student, tenantId };
    }

    it("getSpaceProgress → strict SpaceProgressView (store-shape drift collapsed)", async () => {
      const { student } = await seedProgress();
      const res = (await getSpaceProgressService(
        { spaceId: "space_1" } as never,
        student
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.getSpaceProgress", res).success).toBe(true);
      const p = res["progress"] as Doc;
      expect(p["startedAt"]).toBeNull();
      expect(p["completedAt"]).toBeNull();
      expect(p["itemProgress"]).toBeUndefined(); // raw store key must not leak
      expect(p["analyticsRecomputePending"]).toBeUndefined();
    });

    it("getStoryPointProgress → strict StoryPointProgressDocView", async () => {
      const { student } = await seedProgress();
      const res = (await getStoryPointProgressService(
        { spaceId: "space_1", storyPointId: "sp_1" } as never,
        student
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.getStoryPointProgress", res).success).toBe(true);
      const p = res["progress"] as Doc;
      expect(p["storyPointId"]).toBe("sp_1");
      const items = p["items"] as Record<string, Doc>;
      const entry = items["item_1"]!;
      expect(entry["itemId"]).toBe("item_1");
      expect(entry["itemType"]).toBe("question");
      expect(JSON.stringify(entry)).not.toContain("tokensUsed"); // eval whitelisted
    });

    it("getSpaceProgress returns null progress cleanly (nullable view)", async () => {
      const student = makeAuthContext("student");
      const res = (await getSpaceProgressService(
        { spaceId: "space_none" } as never,
        student
      )) as unknown as Doc;
      expect(parseAs("v1.levelup.getSpaceProgress", res).success).toBe(true);
      expect(res["progress"]).toBeNull();
    });
  });
});
