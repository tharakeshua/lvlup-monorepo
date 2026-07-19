/**
 * LVL-2 wire-gap services UNIT suite — one block per net-new callable:
 * store (getStoreSpace / reviews), progress list, versions, question bank
 * (+ importFromBank answer split + idempotent replay), agents (⚷ prompt/rules
 * strip), rubric presets, assignContent, generateContent (draft gate +
 * sourcePdfPath fail-loud).
 *
 * Every read/list response is validated against the EXACT contract response
 * schema (the same gate makeCallable applies under VALIDATE_RESPONSES), with
 * legacy-shaped stored docs to prove the whitelist projections canonicalize.
 */
import { describe, it, expect } from "vitest";
import { CALLABLES } from "@levelup/api-contract";
import type { AuthContext } from "../shared/context";
import {
  getStoreSpaceService,
  listSpaceReviewsService,
  saveSpaceReviewService,
} from "../levelup/purchase";
import { listSpaceProgressForUserService } from "../levelup/practice";
import { listVersionsService } from "../levelup/versions";
import {
  listQuestionBankService,
  saveQuestionBankItemService,
  importFromBankService,
} from "../levelup/question-bank";
import {
  listAgentsService,
  saveAgentService,
  listRubricPresetsService,
  saveRubricPresetService,
} from "../levelup/agents-presets";
import { assignContentService } from "../levelup/assign";
import { generateContentService } from "../levelup/generate";
import { listPlatformActivityService, getCostSummaryService } from "../analytics/reads";
import { getAssignmentMatrixService } from "../analytics/assignment-matrix";
import { createInMemoryRepos } from "../repo-admin/testing/index.js";

type Doc = Record<string, unknown>;

function assertResponseValid(name: keyof typeof CALLABLES, res: unknown): void {
  const parsed = (
    CALLABLES[name] as {
      responseSchema: { safeParse(v: unknown): { success: boolean; error?: unknown } };
    }
  ).responseSchema.safeParse(res);
  expect(parsed.success, JSON.stringify((parsed as { error?: unknown }).error, null, 2)).toBe(true);
}

const T = "tenant_t1";
const NOW = "2026-07-05T10:00:00.000Z";

/** Minimal in-memory EntityRepo twin (get/getMany/upsert/list/delete). */
function makeFakeEntityRepo(seed: Doc[] = []) {
  const docs = new Map<string, Doc>(seed.map((d) => [String(d["id"]), d]));
  let seq = 0;
  return {
    docs,
    async get(_t: string, id: string): Promise<Doc | null> {
      return docs.get(id) ?? null;
    },
    async getMany(_t: string, ids: string[]): Promise<Doc[]> {
      return ids.map((id) => docs.get(id)).filter((d): d is Doc => Boolean(d));
    },
    async upsert(_t: string, data: Doc, ts = NOW): Promise<{ id: string; created: boolean }> {
      const id = (data["id"] as string | undefined) ?? `gen_${++seq}`;
      const existing = docs.get(id);
      docs.set(id, {
        ...(existing ?? {}),
        ...data,
        id,
        tenantId: T,
        updatedAt: ts,
        ...(existing ? {} : { createdAt: ts }),
      });
      return { id, created: !existing };
    },
    async list(
      _t: string,
      opts: { where?: Doc; limit?: number; filter?: (d: Doc) => boolean } = {}
    ) {
      let items = [...docs.values()];
      for (const [k, v] of Object.entries(opts.where ?? {})) {
        items = items.filter((d) => d[k] === v);
      }
      if (opts.filter) items = items.filter(opts.filter);
      return { items: items.slice(0, opts.limit ?? 20), nextCursor: null as string | null };
    },
    async delete(_t: string, id: string): Promise<void> {
      docs.delete(id);
    },
  };
}

/** Nested spaceReviews fake (uid-keyed upsert). */
function makeFakeReviewRepo() {
  const bySpace = new Map<string, Map<string, Doc>>();
  const forSpace = (s: string) => {
    let m = bySpace.get(s);
    if (!m) bySpace.set(s, (m = new Map()));
    return m;
  };
  return {
    async get(_t: string, spaceId: string, uid: string) {
      return forSpace(spaceId).get(uid) ?? null;
    },
    async upsert(_t: string, spaceId: string, uid: string, data: Doc) {
      const m = forSpace(spaceId);
      const existing = m.get(uid);
      m.set(uid, {
        ...(existing ?? {}),
        ...data,
        id: uid,
        updatedAt: NOW,
        ...(existing ? {} : { createdAt: NOW }),
      });
      return { id: uid, created: !existing };
    },
    async list(_t: string, spaceId: string, filter: { limit?: number } = {}) {
      return {
        items: [...forSpace(spaceId).values()].slice(0, filter.limit ?? 20),
        nextCursor: null as string | null,
      };
    },
  };
}

function makeFakeVersionRepo(seed: Array<{ spaceId: string } & Doc> = []) {
  const rows = [...seed];
  return {
    rows,
    async list(_t: string, spaceId: string, filter: { limit?: number } = {}) {
      return {
        items: rows.filter((r) => r["spaceId"] === spaceId).slice(0, filter.limit ?? 20),
        nextCursor: null as string | null,
      };
    },
    async add(_t: string, spaceId: string, entry: Doc) {
      const id = `v_${rows.length + 1}`;
      rows.push({ ...entry, id, spaceId, version: rows.length + 1, changedAt: NOW });
      return id;
    },
  };
}

function makeFakeIdemRepo() {
  const store = new Map<string, { status: "committed"; result: unknown }>();
  return {
    async begin(_t: string, uid: string, key: string) {
      const hit = store.get(`${uid}_${key}`);
      return hit
        ? { status: "committed" as const, result: hit.result }
        : { status: "new" as const };
    },
    async commit(_t: string, uid: string, key: string, result: unknown) {
      store.set(`${uid}_${key}`, { status: "committed", result });
    },
  };
}

function makeFakeAnswerKeys() {
  const keys = new Map<string, Doc>();
  return {
    keys,
    async put(_t: string, itemId: string, key: Doc) {
      keys.set(itemId, key);
    },
    async get(_t: string, itemId: string) {
      return keys.get(itemId) ?? null;
    },
  };
}

interface CtxOpts {
  role?: string;
  uid?: string;
  repos?: Doc;
  ai?: Doc;
}

function makeCtx(opts: CtxOpts = {}): AuthContext {
  return {
    uid: opts.uid ?? "user_1",
    tenantId: T,
    role: opts.role ?? "teacher",
    isSuperAdmin: false,
    permissions: null,
    staffPermissions: null,
    classIds: [],
    studentIds: [],
    entityIds: {},
    now: () => NOW,
    ai: (opts.ai ?? {
      async generate() {
        throw new Error("ai not stubbed for this test");
      },
    }) as AuthContext["ai"],
    repos: (opts.repos ?? {}) as AuthContext["repos"],
  } as unknown as AuthContext;
}

const STORE_SPACE: Doc = {
  id: "sp_store",
  tenantId: T,
  title: "Store Space",
  publishedToStore: true,
  status: "published",
  price: { amountMinor: 49900, currency: "INR" },
  accessType: "public_store",
  classIds: [],
};

describe("getStoreSpace", () => {
  it("returns the strict listing for a store space", async () => {
    const ctx = makeCtx({
      role: "student",
      repos: { spaces: makeFakeEntityRepo([STORE_SPACE]) },
    });
    const res = await getStoreSpaceService({ spaceId: "sp_store" }, ctx);
    assertResponseValid("v1.levelup.getStoreSpace", res);
    expect((res.listing as Doc)["sourceTenantId"]).toBe(T);
  });

  it("NOT_FOUND for a non-store space (store lens never confirms class content)", async () => {
    const ctx = makeCtx({
      role: "student",
      repos: {
        spaces: makeFakeEntityRepo([{ ...STORE_SPACE, id: "sp_class", publishedToStore: false }]),
      },
    });
    await expect(getStoreSpaceService({ spaceId: "sp_class" }, ctx)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("space reviews", () => {
  it("save (create → update) round-trips through the strict list view", async () => {
    const spaceReviews = makeFakeReviewRepo();
    const ctx = makeCtx({
      role: "student",
      uid: "stud_1",
      repos: { spaces: makeFakeEntityRepo([STORE_SPACE]), spaceReviews },
    });
    const first = await saveSpaceReviewService(
      { spaceId: "sp_store", rating: 5, comment: "great" },
      ctx
    );
    assertResponseValid("v1.levelup.saveSpaceReview", first);
    expect(first.isUpdate).toBe(false);

    const second = await saveSpaceReviewService({ spaceId: "sp_store", rating: 3 }, ctx);
    expect(second.isUpdate).toBe(true);

    const list = await listSpaceReviewsService({ spaceId: "sp_store" }, ctx);
    assertResponseValid("v1.levelup.listSpaceReviews", list);
    expect(list.items).toHaveLength(1);
    expect((list.items[0] as Doc)["rating"]).toBe(3);
    expect((list.items[0] as Doc)["userId"]).toBe("stud_1");
  });

  it("teacher (non-student) cannot review", async () => {
    const ctx = makeCtx({
      role: "teacher",
      repos: { spaces: makeFakeEntityRepo([STORE_SPACE]), spaceReviews: makeFakeReviewRepo() },
    });
    await expect(
      saveSpaceReviewService({ spaceId: "sp_store", rating: 4 }, ctx)
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });
});

describe("listSpaceProgressForUser", () => {
  it("projects legacy progress docs to the strict SpaceProgressView page", async () => {
    const progressDocs = makeFakeEntityRepo([
      {
        id: "stud_1_sp_store",
        tenantId: T,
        userId: "stud_1",
        spaceId: "sp_store",
        storyPoints: { spt_1: { pointsEarned: 4, totalPoints: 10 } },
        updatedAt: NOW,
      },
    ]);
    const ctx = makeCtx({ role: "student", uid: "stud_1", repos: { progressDocs } });
    const res = await listSpaceProgressForUserService({ userId: "stud_1" }, ctx);
    assertResponseValid("v1.levelup.listSpaceProgressForUser", res);
    expect(res.items).toHaveLength(1);
  });
});

describe("listVersions", () => {
  it("serves legacy-written rows through the strict ContentVersion view", async () => {
    const contentVersions = makeFakeVersionRepo([
      {
        id: "v1",
        spaceId: "sp_store",
        version: 3,
        entityType: "item",
        entityId: "item_9",
        changeType: "updated",
        changeSummary: "edited stem",
        changedBy: "teach_1",
        changedAt: "2026-07-01T00:00:00.000Z",
      },
      // drifted legacy row: unknown enums + missing summary → canonical defaults
      {
        id: "v2",
        spaceId: "sp_store",
        entityType: "lesson",
        changeType: "renamed",
        changedBy: "teach_1",
        changedAt: "2026-07-02T00:00:00.000Z",
      },
    ]);
    const ctx = makeCtx({ role: "teacher", repos: { contentVersions } });
    const res = await listVersionsService({ spaceId: "sp_store" }, ctx);
    assertResponseValid("v1.levelup.listVersions", res);
    expect(res.items).toHaveLength(2);
  });

  it("students are denied (version.list is authoring-only)", async () => {
    const ctx = makeCtx({ role: "student", repos: { contentVersions: makeFakeVersionRepo() } });
    await expect(listVersionsService({ spaceId: "sp_store" }, ctx)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });
});

const BANK_ITEM: Doc = {
  id: "qb_1",
  tenantId: T,
  questionType: "mcq",
  title: "Capital of France",
  content: "Which city is the capital of France?",
  questionData: {
    questionType: "mcq",
    options: [
      { id: "a", text: "Paris" },
      { id: "b", text: "Lyon" },
    ],
    // legacy inline answer → must be split out on import, stripped on read
    correctAnswer: "a",
  },
  subject: "geography",
  topics: ["europe"],
  difficulty: "easy",
  usageCount: 2,
  lastUsedAt: null,
  tags: [],
  createdAt: NOW,
  updatedAt: NOW,
};

describe("question bank", () => {
  it("list is authoring-gated and answer-stripped", async () => {
    const questionBank = makeFakeEntityRepo([BANK_ITEM]);
    const ctx = makeCtx({ repos: { questionBank } });
    const res = await listQuestionBankService({}, ctx);
    assertResponseValid("v1.levelup.listQuestionBank", res);
    const qd = (res.items[0] as Doc)["questionData"] as Doc;
    expect(qd["correctAnswer"]).toBeUndefined();

    const student = makeCtx({ role: "student", repos: { questionBank } });
    await expect(listQuestionBankService({}, student)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });

  it("save upserts strict-canonical and delete removes", async () => {
    const questionBank = makeFakeEntityRepo();
    const ctx = makeCtx({ repos: { questionBank } });
    const saved = await saveQuestionBankItemService(
      {
        data: {
          questionType: "mcq",
          content: "2+2?",
          questionData: {
            questionType: "mcq",
            options: [
              { id: "a", text: "4" },
              { id: "b", text: "5" },
            ],
          },
          subject: "math",
          topics: ["arithmetic"],
          difficulty: "easy",
        },
      } as never,
      ctx
    );
    assertResponseValid("v1.levelup.saveQuestionBankItem", saved);
    const del = await saveQuestionBankItemService(
      { id: saved.id, data: { deleted: true } } as never,
      ctx
    );
    expect(del).toMatchObject({ id: saved.id, deleted: true });
    expect(questionBank.docs.size).toBe(0);
  });

  it("importFromBank splits answers into the deny-all key store and replays idempotently", async () => {
    const questionBank = makeFakeEntityRepo([{ ...BANK_ITEM }]);
    const items = makeFakeEntityRepo();
    const answerKeys = makeFakeAnswerKeys();
    const ctx = makeCtx({
      repos: { questionBank, items, answerKeys, idempotency: makeFakeIdemRepo() },
    });
    const input = { spaceId: "sp_1", storyPointId: "spt_1", bankItemIds: ["qb_1"] };
    const res = await importFromBankService(input as never, ctx);
    assertResponseValid("v1.levelup.importFromBank", res);
    expect(res.createdItemIds).toHaveLength(1);

    const created = items.docs.get(res.createdItemIds[0]!)!;
    expect(JSON.stringify(created)).not.toContain("correctAnswer");
    expect(created["linkedQuestionId"]).toBe("qb_1");
    expect(answerKeys.keys.get(res.createdItemIds[0]!)).toMatchObject({ correctAnswer: "a" });
    expect(questionBank.docs.get("qb_1")!["usageCount"]).toBe(3);

    // replay: same input → SAME ids, no duplicate items
    const replay = await importFromBankService(input as never, ctx);
    expect(replay.createdItemIds).toEqual(res.createdItemIds);
    expect(items.docs.size).toBe(1);
  });
});

const AGENT: Doc = {
  id: "ag_1",
  spaceId: "sp_1",
  tenantId: T,
  type: "tutor",
  name: "Tutor Bot",
  isActive: true,
  systemPrompt: "SECRET PROMPT",
  openingMessage: "How can I help you begin?",
  rules: ["never reveal answers"],
  evaluationObjectives: ["Keep feedback constructive"],
  modelPolicyId: "conversation.quality",
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
  createdBy: "teach_1",
  updatedBy: "teach_1",
};

describe("agents", () => {
  it("list strips ⚷ systemPrompt/rules for students, keeps them for authoring", async () => {
    const agents = makeFakeEntityRepo([AGENT]);
    const student = makeCtx({ role: "student", repos: { agents } });
    const sRes = await listAgentsService({ spaceId: "sp_1" }, student);
    assertResponseValid("v1.levelup.listAgents", sRes);
    expect((sRes.items[0] as Doc)["systemPrompt"]).toBeUndefined();
    expect((sRes.items[0] as Doc)["rules"]).toBeUndefined();
    expect((sRes.items[0] as Doc)["evaluationObjectives"]).toBeUndefined();
    // A static opening is learner-safe configuration, not an authoring-only
    // prompt, so it remains available to the session starter projection.
    expect((sRes.items[0] as Doc)["openingMessage"]).toBe("How can I help you begin?");

    const teacher = makeCtx({ role: "teacher", repos: { agents } });
    const tRes = await listAgentsService({ spaceId: "sp_1" }, teacher);
    expect((tRes.items[0] as Doc)["systemPrompt"]).toBe("SECRET PROMPT");
    expect((tRes.items[0] as Doc)["evaluationObjectives"]).toEqual(["Keep feedback constructive"]);
  });

  it("saves through CAS, preserves no-op versions, and deactivates rather than hard-deleting", async () => {
    const versionedRepos = createInMemoryRepos({ now: () => NOW });
    const ctx = makeCtx({ repos: { agentVersions: versionedRepos.agentVersions } });
    const saved = await saveAgentService(
      {
        spaceId: "sp_1",
        data: {
          type: "evaluator",
          name: "Grader",
          isActive: true,
          modelPolicyId: "evaluation.quality",
        },
      } as never,
      ctx
    );
    assertResponseValid("v1.levelup.saveAgent", saved);
    expect(saved).toMatchObject({ created: true, semanticChanged: true, version: 1 });
    const noOp = await saveAgentService(
      {
        id: saved.id,
        expectedVersion: saved.version,
        spaceId: "sp_1",
        data: {
          type: "evaluator",
          name: "Grader",
          isActive: true,
          modelPolicyId: "evaluation.quality",
        },
      } as never,
      ctx
    );
    expect(noOp).toMatchObject({ created: false, semanticChanged: false, version: 1 });
    const del = await saveAgentService(
      {
        id: saved.id,
        expectedVersion: noOp.version,
        spaceId: "sp_1",
        data: {
          type: "evaluator",
          name: "Grader",
          isActive: false,
          modelPolicyId: "evaluation.quality",
          deleted: true,
        },
      } as never,
      ctx
    );
    expect(del).toMatchObject({ deleted: true, semanticChanged: true, version: 2 });
    // A semantic no-op after deactivation proves the versioned document remains
    // auditable instead of being removed from storage.
    await expect(
      saveAgentService(
        {
          id: saved.id,
          expectedVersion: del.version,
          spaceId: "sp_1",
          data: {
            type: "evaluator",
            name: "Grader",
            isActive: false,
            modelPolicyId: "evaluation.quality",
          },
        } as never,
        ctx
      )
    ).resolves.toMatchObject({ created: false, semanticChanged: false, version: 2 });
  });
});

describe("rubric presets", () => {
  const RUBRIC = {
    scoringMode: "holistic",
    holisticGuidance: "grade on clarity",
    holisticMaxScore: 10,
  };
  it("list rides the rubric-guidance leak gate (authoring only)", async () => {
    const rubricPresets = makeFakeEntityRepo([
      {
        id: "rp_1",
        tenantId: T,
        name: "Essay v1",
        rubric: RUBRIC,
        category: "essay",
        isDefault: true,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    const teacher = makeCtx({ repos: { rubricPresets } });
    const res = await listRubricPresetsService({}, teacher);
    assertResponseValid("v1.levelup.listRubricPresets", res);
    expect(res.items).toHaveLength(1);

    const student = makeCtx({ role: "student", repos: { rubricPresets } });
    await expect(listRubricPresetsService({}, student)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });

  it("save round-trips", async () => {
    const rubricPresets = makeFakeEntityRepo();
    const ctx = makeCtx({ repos: { rubricPresets } });
    const saved = await saveRubricPresetService(
      { data: { name: "Code v1", rubric: RUBRIC, category: "coding" } } as never,
      ctx
    );
    assertResponseValid("v1.levelup.saveRubricPreset", saved);
    expect(rubricPresets.docs.get(saved.id)!["isDefault"]).toBe(false);
  });
});

describe("assignContent", () => {
  it("unions classIds on the space and writes deterministic assignment rows", async () => {
    const spaces = makeFakeEntityRepo([{ ...STORE_SPACE, id: "sp_1", classIds: ["c_old"] }]);
    const assignments = makeFakeEntityRepo();
    const ctx = makeCtx({ repos: { spaces, assignments } });
    const res = await assignContentService(
      {
        contentType: "space",
        contentId: "sp_1",
        classIds: ["c_old", "c_new"],
        window: { dueAt: "2026-08-01T00:00:00.000Z" },
      } as never,
      ctx
    );
    assertResponseValid("v1.levelup.assignContent", res);
    expect(spaces.docs.get("sp_1")!["classIds"]).toEqual(["c_old", "c_new"]);
    expect(assignments.docs.get("space_sp_1_c_new")).toMatchObject({
      classId: "c_new",
      dueAt: "2026-08-01T00:00:00.000Z",
      visibility: "visible",
    });
    // re-assign overwrites the SAME rows (deterministic ids → idempotent)
    await assignContentService(
      { contentType: "space", contentId: "sp_1", classIds: ["c_new"] } as never,
      ctx
    );
    expect(assignments.docs.size).toBe(2);
  });
});

describe("generateContent", () => {
  const SP = { id: "spt_1", spaceId: "sp_1", title: "Fractions", description: "Intro" };
  const SPACES = [{ id: "sp_1", tenantId: T, title: "Math", subject: "math" }];

  const VALID_DRAFT = {
    itemType: "question",
    questionType: "mcq",
    title: "Half of 4?",
    payload: {
      type: "question",
      questionData: {
        questionType: "mcq",
        options: [
          { id: "a", text: "2" },
          { id: "b", text: "4" },
        ],
      },
    },
  };

  function makeAiFake(drafts: unknown[] = [VALID_DRAFT, { itemType: "bogus", nonsense: true }]) {
    return {
      async generate() {
        return { json: { drafts }, text: "", tokensUsed: 100, costUsd: 0.001, model: "stub" };
      },
    };
  }

  it("returns ONLY schema-valid drafts (invalid model output dropped)", async () => {
    const ctx = makeCtx({
      repos: {
        spaces: makeFakeEntityRepo(SPACES as Doc[]),
        storyPoints: makeFakeEntityRepo([SP as Doc]),
      },
      ai: makeAiFake(),
    });
    const res = await generateContentService(
      { storyPointId: "spt_1", spec: { types: ["mcq"], count: 2 } } as never,
      ctx
    );
    assertResponseValid("v1.levelup.generateContent", res);
    expect(res.drafts).toHaveLength(1);
    expect((res.drafts[0] as Doc)["title"]).toBe("Half of 4?");
  });

  it("uses promptKey 'contentDraft' from the registry (not a raw prompt string)", async () => {
    const calls: unknown[] = [];
    const ctx = makeCtx({
      repos: {
        spaces: makeFakeEntityRepo(SPACES as Doc[]),
        storyPoints: makeFakeEntityRepo([SP as Doc]),
      },
      ai: {
        async generate(req: unknown) {
          calls.push(req);
          return {
            json: { drafts: [VALID_DRAFT] },
            text: "",
            tokensUsed: 50,
            costUsd: 0,
            model: "stub",
          };
        },
      },
    });
    await generateContentService(
      { storyPointId: "spt_1", spec: { types: ["mcq"], count: 1 } } as never,
      ctx
    );
    expect(calls).toHaveLength(1);
    const req = calls[0] as Doc;
    expect(req["promptKey"]).toBe("contentDraft");
    expect(req["prompt"]).toBeUndefined(); // no raw prompt field
    expect((req["variables"] as Doc)["storyPointTitle"]).toBe("Fractions");
  });

  it("passes sourcePdfPath as images ref for valid tenant-scoped paths", async () => {
    const capturedImages: unknown[] = [];
    const ctx = makeCtx({
      repos: {
        spaces: makeFakeEntityRepo(SPACES as Doc[]),
        storyPoints: makeFakeEntityRepo([SP as Doc]),
      },
      ai: {
        async generate(req: unknown) {
          capturedImages.push((req as Doc)["images"]);
          return { json: { drafts: [] }, text: "", tokensUsed: 10, costUsd: 0, model: "stub" };
        },
      },
    });
    const res = await generateContentService(
      {
        storyPointId: "spt_1",
        spec: { types: ["mcq"], count: 1 },
        sourcePdfPath: `tenants/${T}/papers/exam.pdf`,
      } as never,
      ctx
    );
    assertResponseValid("v1.levelup.generateContent", res);
    expect(capturedImages[0]).toEqual([{ storagePath: `tenants/${T}/papers/exam.pdf` }]);
  });

  it("fails FAILED_PRECONDITION for sourcePdfPath outside tenant namespace", async () => {
    const ctx = makeCtx({
      repos: {
        spaces: makeFakeEntityRepo(SPACES as Doc[]),
        storyPoints: makeFakeEntityRepo([SP as Doc]),
      },
    });
    await expect(
      generateContentService(
        {
          storyPointId: "spt_1",
          spec: { types: ["mcq"], count: 1 },
          sourcePdfPath: "uploads/x.pdf",
        } as never,
        ctx
      )
    ).rejects.toMatchObject({ code: "FAILED_PRECONDITION" });
  });
});

describe("platform reads (U2.4+5 replacement callables)", () => {
  it("listPlatformActivity reads the real top-level ledger, projected canonical", async () => {
    const platformActivity = {
      async list() {
        return {
          items: [
            {
              id: "act_1",
              action: "tenant_created",
              actorUid: "sa_1",
              actorEmail: "sa@levelup.app",
              tenantId: T,
              metadata: { plan: "trial" },
              createdAt: NOW,
            },
            // drifted legacy row: unknown action, missing email/metadata
            { id: "act_2", action: "tenant_renamed", actorUid: "sa_1", createdAt: NOW },
          ],
          nextCursor: null,
        };
      },
    };
    const ctx = makeCtx({ repos: { platformActivity } });
    (ctx as unknown as Doc)["isSuperAdmin"] = true;
    const res = await listPlatformActivityService({}, ctx);
    assertResponseValid("v1.analytics.listPlatformActivity", res);
    expect(res.items).toHaveLength(2);

    const nonSa = makeCtx({ repos: { platformActivity } });
    await expect(listPlatformActivityService({}, nonSa)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });

  it("getCostSummary serves canonical costSummaries docs (daily)", async () => {
    const costSummaries = {
      async listDaily() {
        return [
          {
            id: "daily_2026-07-04",
            tenantId: T,
            date: "2026-07-04",
            totalCalls: 12,
            totalInputTokens: 1000,
            totalOutputTokens: 2000,
            totalCostUsd: 0.42,
            byPurpose: {},
            byModel: {},
            computedAt: NOW,
          },
        ];
      },
      async listMonthly() {
        return [];
      },
    };
    const ctx = makeCtx({ role: "tenantAdmin", repos: { costSummaries } });
    const res = await getCostSummaryService(
      { granularity: "daily", date: "2026-07-04" } as never,
      ctx
    );
    assertResponseValid("v1.analytics.getCostSummary", res);
    expect((res.summaries[0] as Doc)["totalCostUsd"]).toBe(0.42);
  });

  it("getCostSummary falls back to the legacy _kind store when canon is empty", async () => {
    const costSummaries = {
      async listDaily() {
        return [];
      },
      async listMonthly() {
        return [];
      },
    };
    const tenants = {
      async list() {
        return {
          items: [
            {
              id: "costDaily_2026-07-04",
              _kind: "costDaily",
              date: "2026-07-04",
              totalCalls: 3,
              totalCostUsd: 0.1,
              computedAt: NOW,
            },
          ],
          nextCursor: null,
        };
      },
    };
    const ctx = makeCtx({ role: "tenantAdmin", repos: { costSummaries, tenants } });
    const res = await getCostSummaryService({ granularity: "daily" } as never, ctx);
    assertResponseValid("v1.analytics.getCostSummary", res);
    expect(res.summaries).toHaveLength(1);
    // required-field defaults back-filled by the projection
    expect((res.summaries[0] as Doc)["byPurpose"]).toEqual({});
  });
});

describe("getAssignmentMatrix", () => {
  it("builds the class grid from spaces/exams + progress + assignment rows", async () => {
    const students = makeFakeEntityRepo([
      {
        id: "stu_1",
        displayName: "Asha",
        authUid: "uid_asha",
        classIds: ["c_1"],
      },
    ]);
    const spaces = makeFakeEntityRepo([
      { ...STORE_SPACE, id: "sp_1", title: "Algebra", classIds: ["c_1"] },
    ]);
    const exams = makeFakeEntityRepo([
      { id: "ex_1", title: "Midterm", classIds: ["c_1"], examDate: NOW },
    ]);
    const assignments = makeFakeEntityRepo([
      {
        id: "space_sp_1_c_1",
        contentType: "space",
        contentId: "sp_1",
        classId: "c_1",
        dueAt: "2026-08-01T00:00:00.000Z",
      },
    ]);
    const submissions = makeFakeEntityRepo([
      { id: "sub_1", examId: "ex_1", studentId: "stu_1", status: "graded", percentage: 88 },
    ]);
    const progress = {
      async get() {
        return { percentage: 40, completedAt: null };
      },
    };
    const ctx = makeCtx({
      repos: { students, spaces, exams, assignments, submissions, progress },
    });
    const res = await getAssignmentMatrixService({ classId: "c_1" } as never, ctx);
    assertResponseValid("v1.analytics.getAssignmentMatrix", res);
    expect(res.students).toHaveLength(1);
    expect(res.rows).toHaveLength(2);
    const spaceRow = (res.rows as Doc[]).find((r) => r["contentType"] === "space")!;
    expect((spaceRow["cells"] as Doc[])[0]).toMatchObject({
      status: "in_progress",
      completionPct: 40,
    });
    const examRow = (res.rows as Doc[]).find((r) => r["contentType"] === "exam")!;
    expect((examRow["cells"] as Doc[])[0]).toMatchObject({
      status: "completed",
      completionPct: 100,
    });
  });

  it("students are denied (teaching-staff read)", async () => {
    const ctx = makeCtx({ role: "student", repos: {} });
    await expect(
      getAssignmentMatrixService({ classId: "c_1" } as never, ctx)
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });
});
