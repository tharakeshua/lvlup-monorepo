/**
 * `@levelup/services/repo-admin/testing` — the in-memory `Repos` twin (T6).
 *
 * Implements the SAME `Repos` contract as the Admin-SDK `createRepos()` but over
 * plain Maps, so `@levelup/services` (`fn(input, ctx)`) can be unit-tested with
 * `ctx.repos` set WITHOUT the emulator and without the 30+ hand-rolled
 * firebase-admin mocks. The T6 conformance suite runs one test file against both
 * this twin and the emulator-backed real repos so the fake can never silently
 * diverge on `tx()` atomicity / cursor semantics / idempotency / progress
 * best-score retention.
 *
 * Cursor encoding (base64 JSON) is shared with the real adapter via the same
 * `cursor.ts` module — the one load-bearing cross-driver invariant.
 */
import { encodeCursor, decodeCursor } from "../cursor.js";
import { canonicalHash, sameCanonical, sha256Base64Url } from "../canonical.js";
import { makeIdempotencyConflict, makeLeaseConflict, makeRepoError } from "../errors.js";
import {
  assertAgentActorUid,
  assertAgentSpaceUnchanged,
  assertSemanticAgentPayload,
  makeAgentVersionConflict,
  sameAgentSemanticShape,
  storedAgentVersion,
} from "../agent.js";
import { conversationSessionKeyId, spaceProgressId } from "../paths.js";
import type {
  ConversationContext,
  ConversationLease,
  ConversationMessage,
  ConversationSessionDoc,
  ConversationSessionKeyDoc,
  ConversationTurn,
  ConversationTurnDoc,
  ItemSubmissionDoc,
  ItemSubmissionEvaluationAttemptDoc,
} from "@levelup/domain";
import type {
  AbandonConversationInput,
  AcquireEvaluationInput,
  AcquireFinalizationInput,
  ClaimConversationTurnInput,
  CommitConversationTurnInput,
  CommitSubmissionEvaluationInput,
  CompleteConversationFinalizationInput,
  ConversationRepo,
  CreateReposOptions,
  EntityCollectionName,
  EntityRepo,
  FailConversationTurnInput,
  FailSubmissionEvaluationInput,
  LevelupContentRepo,
  ListOptions,
  MarkTurnPhaseInput,
  ItemSubmissionRepo,
  ProgressRepo,
  ProgressUpdateInput,
  ProgressUpdateResult,
  Repos,
  RepoPage,
  ScopedItemRepo,
  SaveVersionedAgentInput,
  SaveVersionedAgentResult,
  TxHandle,
  VersionedAgentRepo,
} from "../types.js";

/** Extends the contract with the `_*` test-introspection escape hatches. */
export interface InMemoryRepos extends Repos {
  claims: Repos["claims"] & { _revoked(uid: string): boolean };
  outbox: Repos["outbox"] & { _all(tenantId: string): Record<string, unknown>[] };
  audit: Repos["audit"] & { _all(tenantId: string): Record<string, unknown>[] };
  _all(coll: EntityCollectionName, tenantId: string): Record<string, unknown>[];
  _reset(): void;
}

type DocStore = Map<string, Map<string, Record<string, unknown>>>;

let idSeq = 0;
const nextId = (): string => `mem_${(idSeq++).toString(36).padStart(8, "0")}`;

const ENTITY_COLLECTIONS: EntityCollectionName[] = [
  "spaces",
  "storyPoints",
  "items",
  "tenants",
  "students",
  "teachers",
  "classes",
  "exams",
  "submissions",
  "testSessions",
  "progressDocs",
  "notifications",
  "announcements",
];

export function createInMemoryRepos(options: CreateReposOptions = {}): InMemoryRepos {
  const now = options.now ?? (() => new Date().toISOString());
  const leaseMs = options.idempotencyLeaseMs ?? 5 * 60 * 1000;

  const stores = new Map<EntityCollectionName, DocStore>();
  const claimsStore = new Map<string, Record<string, unknown>>();
  const revoked = new Set<string>();
  const answerKeyStore = new Map<string, Record<string, unknown>>();
  const idemStore = new Map<
    string,
    { status: "in_flight" | "committed"; result?: unknown; leaseExpiresAt: number }
  >();
  const outboxStore = new Map<string, Record<string, unknown>[]>();
  const auditStore = new Map<string, Record<string, unknown>[]>();
  const rateLimitStore = new Map<string, number>();
  const progressStore = new Map<string, Record<string, unknown>>();
  const agentVersionStore = new Map<string, Record<string, unknown>>();
  const conversationSessions = new Map<string, ConversationSessionDoc>();
  const conversationKeys = new Map<string, ConversationSessionKeyDoc>();
  const conversationMessages = new Map<string, Map<string, ConversationMessage>>();
  const conversationTurns = new Map<string, Map<string, ConversationTurnDoc>>();
  const conversationEvidence = new Map<string, Map<string, Record<string, unknown>>>();
  const itemSubmissionStore = new Map<string, ItemSubmissionDoc>();
  const itemSubmissionAttempts = new Map<string, Map<string, ItemSubmissionEvaluationAttemptDoc>>();
  const progressApplicationStore = new Map<string, Record<string, unknown>>();
  const evaluationSettingsStore = new Map<string, Record<string, unknown>>();
  const rubricPresetStore = new Map<string, Record<string, unknown>>();

  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const sessionStoreKey = (tenantId: string, sessionId: string) => `${tenantId}/${sessionId}`;
  const submissionStoreKey = (tenantId: string, submissionId: string) =>
    `${tenantId}/${submissionId}`;
  const messageMap = (tenantId: string, sessionId: string) => {
    const key = sessionStoreKey(tenantId, sessionId);
    let value = conversationMessages.get(key);
    if (!value) conversationMessages.set(key, (value = new Map()));
    return value;
  };
  const turnMap = (tenantId: string, sessionId: string) => {
    const key = sessionStoreKey(tenantId, sessionId);
    let value = conversationTurns.get(key);
    if (!value) conversationTurns.set(key, (value = new Map()));
    return value;
  };
  const evidenceMap = (tenantId: string, sessionId: string) => {
    const key = sessionStoreKey(tenantId, sessionId);
    let value = conversationEvidence.get(key);
    if (!value) conversationEvidence.set(key, (value = new Map()));
    return value;
  };
  const attemptMap = (tenantId: string, submissionId: string) => {
    const key = submissionStoreKey(tenantId, submissionId);
    let value = itemSubmissionAttempts.get(key);
    if (!value) itemSubmissionAttempts.set(key, (value = new Map()));
    return value;
  };
  const keyStoreKey = (tenantId: string, ownerUid: string, mode: string, contextBaseKey: string) =>
    `${tenantId}/${conversationSessionKeyId(ownerUid, mode, contextBaseKey)}`;
  const expired = (value: string | undefined, ts: string): boolean => {
    if (!value) return true;
    const a = Date.parse(value);
    const b = Date.parse(ts);
    return !Number.isFinite(a) || !Number.isFinite(b) || a <= b;
  };
  const assertLease = (lease: ConversationLease, ts: string) => {
    if (!lease.token || !lease.ownerRequestId || expired(lease.expiresAt, ts)) {
      throw makeRepoError("VALIDATION_ERROR", "A non-expired workflow lease is required");
    }
  };
  const preview = (content: ConversationMessage["content"]): string | undefined => {
    const value = content
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join(" ")
      .trim()
      .replace(/\s+/gu, " ");
    return value ? value.slice(0, 160) : undefined;
  };

  function store(coll: EntityCollectionName): DocStore {
    let s = stores.get(coll);
    if (!s) {
      s = new Map();
      stores.set(coll, s);
    }
    return s;
  }
  function tenantMap(
    coll: EntityCollectionName,
    tenantId: string
  ): Map<string, Record<string, unknown>> {
    const s = store(coll);
    let t = s.get(tenantId);
    if (!t) {
      t = new Map();
      s.set(tenantId, t);
    }
    return t;
  }
  const outboxFor = (t: string): Record<string, unknown>[] => {
    let r = outboxStore.get(t);
    if (!r) outboxStore.set(t, (r = []));
    return r;
  };
  const auditFor = (t: string): Record<string, unknown>[] => {
    let r = auditStore.get(t);
    if (!r) auditStore.set(t, (r = []));
    return r;
  };

  function makeRepo(coll: EntityCollectionName): EntityRepo {
    return {
      async get(tenantId, id) {
        return tenantMap(coll, tenantId).get(id) ?? null;
      },
      async getMany(tenantId, ids) {
        const t = tenantMap(coll, tenantId);
        return ids.map((id) => t.get(id)).filter((d): d is Record<string, unknown> => Boolean(d));
      },
      async upsert(tenantId, data, ts = now()) {
        const t = tenantMap(coll, tenantId);
        const id = (data["id"] as string | undefined) ?? nextId();
        const created = !t.has(id);
        t.set(id, {
          ...t.get(id),
          ...data,
          id,
          tenantId,
          updatedAt: ts,
          ...(created ? { createdAt: ts } : {}),
        });
        return { id, created };
      },
      async list(tenantId, opts: ListOptions = {}): Promise<RepoPage> {
        const t = tenantMap(coll, tenantId);
        let items = [...t.values()];
        if (opts.where) {
          for (const [f, v] of Object.entries(opts.where)) {
            items = items.filter((d) => d[f] === v);
          }
        }
        if (opts.filter) items = items.filter(opts.filter);
        const orderBy = opts.orderBy ?? "id";
        items.sort((a, b) =>
          String(a[orderBy] ?? a["id"]).localeCompare(String(b[orderBy] ?? b["id"]))
        );
        const limit = opts.limit ?? 20;
        let start = 0;
        if (opts.cursor) {
          const cur = decodeCursor(opts.cursor) as { id: string };
          const idx = items.findIndex((d) => d["id"] === cur.id);
          start = idx >= 0 ? idx + 1 : 0;
        }
        const page = items.slice(start, start + limit);
        const last = page[page.length - 1];
        const nextCursor =
          start + limit < items.length && last
            ? encodeCursor({ v: last[orderBy] ?? last["id"], id: last["id"] })
            : null;
        return { items: page, nextCursor };
      },
      async delete(tenantId, id) {
        tenantMap(coll, tenantId).delete(id);
      },
    };
  }

  const entityRepos = Object.fromEntries(ENTITY_COLLECTIONS.map((c) => [c, makeRepo(c)])) as Record<
    EntityCollectionName,
    EntityRepo
  >;

  // Items are the one nested-content collection: the runtime resolves them by the
  // exact (space, storyPoint, item) tuple, so the twin exposes the same fence.
  const items: ScopedItemRepo = {
    ...entityRepos.items,
    async getScoped(tenantId, spaceId, storyPointId, itemId) {
      const data = tenantMap("items", tenantId).get(itemId);
      if (!data) return null;
      // Exact paths already identify the intended parent; retain this guard so
      // malformed/copied documents never escape as a valid scoped item.
      if (
        data["tenantId"] !== tenantId ||
        data["spaceId"] !== spaceId ||
        data["storyPointId"] !== storyPointId
      ) {
        return null;
      }
      return data;
    },
  };

  const progress: ProgressRepo = {
    async update(tenantId, input: ProgressUpdateInput, ts = now()) {
      const key = `${tenantId}/${spaceProgressId(input.userId, input.spaceId)}`;
      const doc = (progressStore.get(key) ?? {
        id: spaceProgressId(input.userId, input.spaceId),
        userId: input.userId,
        spaceId: input.spaceId,
        tenantId,
        items: {} as Record<string, Record<string, unknown>>,
        storyPoints: {} as Record<string, Record<string, unknown>>,
      }) as Record<string, unknown>;
      const items = (doc["items"] ??= {}) as Record<string, Record<string, unknown>>;
      for (const u of input.items) {
        const prior = items[u.itemId];
        if (!prior || (prior["score"] as number) < u.score) {
          items[u.itemId] = {
            itemId: u.itemId,
            storyPointId: u.storyPointId,
            score: u.score,
            maxScore: u.maxScore,
            correct: u.correct,
            timeSpentMs: u.timeSpentMs,
            evaluation: u.evaluation,
            updatedAt: ts,
          };
        }
      }
      const spAgg = new Map<string, { earned: number; total: number }>();
      for (const e of Object.values(items)) {
        const sp = e["storyPointId"] as string;
        const cur = spAgg.get(sp) ?? { earned: 0, total: 0 };
        cur.earned += e["score"] as number;
        cur.total += e["maxScore"] as number;
        spAgg.set(sp, cur);
      }
      const storyPoints: Record<string, Record<string, unknown>> = {};
      for (const [sp, agg] of spAgg) {
        storyPoints[sp] = {
          storyPointId: sp,
          pointsEarned: agg.earned,
          totalPoints: agg.total,
          completed: agg.total > 0 && agg.earned >= agg.total,
        };
      }
      doc["storyPoints"] = storyPoints;
      const pointsEarned = Object.values(storyPoints).reduce(
        (s, sp) => s + (sp["pointsEarned"] as number),
        0
      );
      const totalPoints = Object.values(storyPoints).reduce(
        (s, sp) => s + (sp["totalPoints"] as number),
        0
      );
      if (input.totalStoryPoints != null) doc["totalStoryPoints"] = input.totalStoryPoints;
      const expected =
        (doc["totalStoryPoints"] as number | undefined) ?? Object.keys(storyPoints).length;
      const completed =
        expected > 0 &&
        Object.keys(storyPoints).length >= expected &&
        Object.values(storyPoints).every((sp) => sp["completed"] === true);
      doc["pointsEarned"] = pointsEarned;
      doc["totalPoints"] = totalPoints;
      doc["completed"] = completed;
      doc["recomputeMarker"] = ts;
      doc["updatedAt"] = ts;
      progressStore.set(key, doc);
      return {
        spaceProgressId: doc["id"] as string,
        completed,
        pointsEarned,
        totalPoints,
        storyPoints: storyPoints as unknown as ProgressUpdateResult["storyPoints"],
      };
    },
    async applySubmission(tenantId, submissionId, ts = now()) {
      const submission = itemSubmissionStore.get(
        submissionStoreKey(tenantId, String(submissionId))
      );
      if (!submission) throw makeRepoError("NOT_FOUND", "Item submission was not found");
      if (!submission.evaluation) {
        throw makeRepoError("PRECONDITION_FAILED", "Progress cannot be applied before evaluation");
      }
      if (
        submission.workflow.status !== "evaluated" &&
        submission.workflow.status !== "progress_applied"
      ) {
        throw makeRepoError(
          "INVALID_TRANSITION",
          "Submission is not ready for progress application"
        );
      }
      const markerKey = `${tenantId}/${submission.ownerUid}/${submission.spaceId}/${submissionId}`;
      const aggKey = `${tenantId}/${spaceProgressId(submission.ownerUid, submission.spaceId)}`;
      const existingMarker = progressApplicationStore.get(markerKey);
      if (existingMarker) {
        const aggregate = progressStore.get(aggKey);
        if (
          existingMarker["submissionId"] !== submissionId ||
          existingMarker["evaluationResultHash"] !== submission.evaluation.resultHash ||
          !aggregate
        ) {
          throw makeRepoError(
            "CONFLICT",
            "Existing progress marker does not match the evaluated submission"
          );
        }
        return {
          applied: false,
          progress: {
            spaceProgressId: aggregate["id"] as string,
            completed: aggregate["completed"] as boolean,
            pointsEarned: aggregate["pointsEarned"] as number,
            totalPoints: aggregate["totalPoints"] as number,
            storyPoints: {
              ...((aggregate["storyPoints"] ?? {}) as ProgressUpdateResult["storyPoints"]),
            },
          },
        };
      }
      const result = await progress.update(
        tenantId,
        {
          userId: submission.ownerUid,
          spaceId: submission.spaceId,
          items: [
            {
              storyPointId: submission.storyPointId,
              itemId: submission.itemId,
              score: submission.evaluation.result.score,
              maxScore: submission.evaluation.result.maxScore,
              correct: submission.evaluation.result.correctness >= 1,
              evaluation: submission.evaluation.safeResult as unknown as Record<string, unknown>,
            },
          ],
        },
        ts
      );
      progressApplicationStore.set(markerKey, {
        schemaVersion: 1,
        id: submissionId,
        tenantId,
        ownerUid: submission.ownerUid,
        spaceId: submission.spaceId,
        storyPointId: submission.storyPointId,
        itemId: submission.itemId,
        submissionId,
        evaluationResultHash: submission.evaluation.resultHash,
        score: submission.evaluation.result.score,
        maxScore: submission.evaluation.result.maxScore,
        appliedAt: ts,
      });
      itemSubmissionStore.set(submissionStoreKey(tenantId, String(submissionId)), {
        ...submission,
        workflow: { ...submission.workflow, status: "progress_applied", progressAppliedAt: ts },
        updatedAt: ts,
      } as unknown as ItemSubmissionDoc);
      return { applied: true, progress: result };
    },
    async get(tenantId, userId, spaceId) {
      return progressStore.get(`${tenantId}/${spaceProgressId(userId, spaceId)}`) ?? null;
    },
  };

  const agentVersions: VersionedAgentRepo = {
    async save(
      tenantId: string,
      input: SaveVersionedAgentInput,
      ts: string = now()
    ): Promise<SaveVersionedAgentResult> {
      assertAgentActorUid(input.actorUid);
      assertSemanticAgentPayload(input.data);
      const id = input.id ?? nextId();
      const key = `${tenantId}/${id}`;
      const existing = agentVersionStore.get(key);

      if (!existing && input.expectedVersion != null && input.expectedVersion !== 0) {
        throw makeAgentVersionConflict(input.expectedVersion, 0);
      }
      if (existing) {
        const currentVersion = storedAgentVersion(existing);
        if (
          input.expectedVersion == null ||
          !Number.isSafeInteger(input.expectedVersion) ||
          input.expectedVersion < 1
        ) {
          const error = new Error(
            "agentVersions.save requires expectedVersion for an existing agent"
          ) as Error & { code: string };
          error.code = "VALIDATION_ERROR";
          throw error;
        }
        if (currentVersion !== input.expectedVersion) {
          throw makeAgentVersionConflict(input.expectedVersion, currentVersion);
        }
        assertAgentSpaceUnchanged(existing, input.data);
      }

      const candidate: Record<string, unknown> = {
        ...(existing ?? {}),
        ...input.data,
        id,
        tenantId,
      };
      const created = !existing;
      const semanticChanged =
        existing === undefined || !sameAgentSemanticShape(existing, candidate);
      const version = created
        ? 1
        : semanticChanged
          ? storedAgentVersion(existing) + 1
          : storedAgentVersion(existing);
      const agent: Record<string, unknown> = {
        ...candidate,
        id,
        tenantId,
        version,
        createdAt: existing?.["createdAt"] ?? ts,
        createdBy: existing?.["createdBy"] ?? input.actorUid,
        updatedAt: ts,
        updatedBy: input.actorUid,
      };
      agentVersionStore.set(key, agent);
      return { id, created, semanticChanged, version, agent };
    },
  };

  const sessionMessages = (tenantId: string, sessionId: string): ConversationMessage[] =>
    [...messageMap(tenantId, sessionId).values()]
      .map(clone)
      .sort((a, b) => a.sequence - b.sequence || String(a.id).localeCompare(String(b.id)));
  const simpleCap = (session: ConversationSessionDoc): boolean =>
    (session.mode === "tutor" && session.learnerTurnCount >= 24) ||
    (session.mode === "question_help" && session.learnerTurnCount >= 20);
  const hardCap = (session: ConversationSessionDoc): boolean => {
    const policy = session.publicConfig.completionPolicy;
    return (
      session.mode === "agent_assessment" &&
      policy !== undefined &&
      session.learnerTurnCount >= policy.maxLearnerTurns
    );
  };
  const clearActiveKey = (tenantId: string, session: ConversationSessionDoc, ts: string) => {
    const key = keyStoreKey(tenantId, session.ownerUid, session.mode, session.contextBaseKey);
    const value = conversationKeys.get(key);
    if (value?.activeSessionId === session.id) {
      conversationKeys.set(key, {
        ...value,
        activeSessionId: undefined,
        revision: value.revision + 1,
        updatedAt: ts as never,
      });
    }
  };
  const sourceRecord = (
    tenantId: string,
    check: { resourceType: string; resourceId: string; spaceId?: string; storyPointId?: string }
  ) => {
    switch (check.resourceType) {
      case "space":
        return tenantMap("spaces", tenantId).get(check.resourceId);
      case "story_point": {
        const value = tenantMap("storyPoints", tenantId).get(check.resourceId);
        return value && value["spaceId"] === check.spaceId ? value : undefined;
      }
      case "item": {
        const value = tenantMap("items", tenantId).get(check.resourceId);
        return value &&
          value["spaceId"] === check.spaceId &&
          value["storyPointId"] === check.storyPointId
          ? value
          : undefined;
      }
      case "agent":
        return agentVersionStore.get(`${tenantId}/${check.resourceId}`);
      case "answer_key":
        return answerKeyStore.get(`${tenantId}/${check.resourceId}`);
      default:
        return undefined;
    }
  };

  const conversations: ConversationRepo = {
    async start(input) {
      const sessionKey = sessionStoreKey(input.tenantId, input.sessionId);
      const existing = conversationSessions.get(sessionKey);
      if (existing) {
        if (
          existing.ownerUid !== input.ownerUid ||
          existing.clientRequestId !== input.clientRequestId ||
          existing.mode !== input.mode ||
          existing.contextBaseKey !== input.contextBaseKey
        ) {
          throw makeRepoError(
            "CONFLICT",
            "Deterministic session id was reused with different input"
          );
        }
        return {
          session: clone(existing),
          messages: sessionMessages(input.tenantId, input.sessionId),
          resumed: true,
        };
      }
      const keyKey = keyStoreKey(input.tenantId, input.ownerUid, input.mode, input.contextBaseKey);
      const activeKey = conversationKeys.get(keyKey);
      if (activeKey?.activeSessionId) {
        const active = conversationSessions.get(
          sessionStoreKey(input.tenantId, String(activeKey.activeSessionId))
        );
        if (active && !["completed", "abandoned"].includes(active.status)) {
          if (active.ownerUid !== input.ownerUid)
            throw makeRepoError("PERMISSION_DENIED", "Wrong session owner");
          return {
            session: clone(active),
            messages: sessionMessages(input.tenantId, String(active.id)),
            resumed: true,
          };
        }
      }
      for (const check of input.sourceVersionChecks) {
        const record = sourceRecord(input.tenantId, check);
        if (!record)
          throw makeRepoError("CONFLICT", `Frozen ${check.resourceType} source is missing`);
        if (check.expectedVersion !== undefined && record["version"] !== check.expectedVersion) {
          throw makeRepoError("CONFLICT", `Frozen ${check.resourceType} version changed`);
        }
        if (
          check.expectedCanonicalHash !== undefined &&
          (typeof record["canonicalHash"] === "string"
            ? record["canonicalHash"]
            : canonicalHash(record)) !== check.expectedCanonicalHash
        ) {
          throw makeRepoError("CONFLICT", `Frozen ${check.resourceType} shape changed`);
        }
      }
      const attemptNumber =
        input.mode === "agent_assessment" ? (activeKey?.nextAttemptNumber ?? 1) : 1;
      const context: ConversationContext =
        input.mode === "agent_assessment"
          ? ({ ...input.startContext, attemptNumber } as unknown as ConversationContext)
          : (input.startContext as ConversationContext);
      const opening = input.openingMessage
        ? ({
            id: input.openingMessage.id,
            sessionId: input.sessionId,
            sequence: 1,
            role: "assistant",
            origin: "opening",
            content: input.openingMessage.content,
            deliveryStatus: "complete",
            createdAt: input.now,
            completedAt: input.now,
          } as unknown as ConversationMessage)
        : undefined;
      const session = {
        schemaVersion: 1,
        id: input.sessionId,
        tenantId: input.tenantId,
        ownerUid: input.ownerUid,
        ...(input.learnerStudentId ? { learnerStudentId: input.learnerStudentId } : {}),
        mode: input.mode,
        context,
        contextBaseKey: input.contextBaseKey,
        contextKey:
          input.mode === "agent_assessment"
            ? `${input.contextBaseKey}:attempt:${attemptNumber}`
            : input.contextBaseKey,
        title: input.sessionBase.title,
        locale: input.sessionBase.locale,
        status: "active",
        publicConfig: input.sessionBase.publicConfig,
        configurationSnapshot: input.sessionBase.configurationSnapshot,
        clientRequestId: input.clientRequestId,
        nextSequence: opening ? 2 : 1,
        revision: 1,
        learnerTurnCount: 0,
        ...(opening
          ? { lastMessageAt: input.now, lastMessagePreview: preview(opening.content) }
          : {}),
        createdAt: input.now,
        updatedAt: input.now,
      } as unknown as ConversationSessionDoc;
      const key: ConversationSessionKeyDoc = {
        schemaVersion: 1,
        id: conversationSessionKeyId(input.ownerUid, input.mode, input.contextBaseKey),
        tenantId: input.tenantId as never,
        ownerUid: input.ownerUid as never,
        mode: input.mode,
        contextBaseKey: input.contextBaseKey,
        activeSessionId: input.sessionId,
        nextAttemptNumber:
          input.mode === "agent_assessment"
            ? attemptNumber + 1
            : (activeKey?.nextAttemptNumber ?? 1),
        revision: (activeKey?.revision ?? 0) + 1,
        updatedAt: input.now as never,
      };
      conversationSessions.set(sessionKey, clone(session));
      conversationKeys.set(keyKey, clone(key));
      if (opening)
        messageMap(input.tenantId, input.sessionId).set(String(opening.id), clone(opening));
      return { session: clone(session), messages: opening ? [clone(opening)] : [], resumed: false };
    },

    async getSession(tenantId, sessionId) {
      const value = conversationSessions.get(sessionStoreKey(tenantId, sessionId));
      return value ? clone(value) : null;
    },

    async getTurn(tenantId, sessionId, turnId) {
      const value = turnMap(tenantId, sessionId).get(turnId);
      return value ? clone(value) : null;
    },

    async listSessions(tenantId, ownerUid, filter) {
      let items = [...conversationSessions.entries()]
        .filter(([key, session]) => key.startsWith(`${tenantId}/`) && session.ownerUid === ownerUid)
        .map(([, session]) => clone(session));
      if (filter.mode) items = items.filter((session) => session.mode === filter.mode);
      if (filter.status) items = items.filter((session) => session.status === filter.status);
      if (filter.contextBaseKey)
        items = items.filter((session) => session.contextBaseKey === filter.contextBaseKey);
      items.sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt) || String(b.id).localeCompare(String(a.id))
      );
      const cursor = filter.cursor ? (decodeCursor(filter.cursor) as { id: string }) : undefined;
      if (cursor) {
        const index = items.findIndex((session) => String(session.id) === cursor.id);
        items = index < 0 ? items : items.slice(index + 1);
      }
      const limit = Math.max(1, Math.min(filter.limit ?? 20, 100));
      const page = items.slice(0, limit);
      const last = page[page.length - 1];
      return {
        items: page,
        nextCursor:
          items.length > limit && last ? encodeCursor({ v: last.updatedAt, id: last.id }) : null,
      };
    },

    async listMessages(tenantId, sessionId, page) {
      let items = sessionMessages(tenantId, sessionId);
      const cursor = page.cursor ? (decodeCursor(page.cursor) as { id: string }) : undefined;
      if (cursor) {
        const index = items.findIndex((message) => String(message.id) === cursor.id);
        items = index < 0 ? items : items.slice(index + 1);
      }
      const limit = Math.max(1, Math.min(page.limit ?? 50, 200));
      const result = items.slice(0, limit);
      const last = result[result.length - 1];
      return {
        items: result,
        nextCursor:
          items.length > limit && last ? encodeCursor({ v: last.sequence, id: last.id }) : null,
      };
    },

    async listRecoveryCandidates(tenantId, ts, limit) {
      return [...conversationSessions.entries()]
        .filter(([key, session]) => {
          if (!key.startsWith(`${tenantId}/`)) return false;
          return (
            (session.status === "active" &&
              expired(session.activeTurnLeaseExpiresAt, ts) &&
              !!session.activeTurnId) ||
            (session.status === "finalizing" &&
              expired(session.finalization?.lease?.expiresAt, ts)) ||
            // A crash between freezeSubmission and completeFinalization leaves the
            // session in grading_pending (submission evaluated/progress_applied but
            // never closed). Surface it so recovery re-drives the replay-safe
            // submission_replay path — otherwise it is invisible to every scan.
            session.status === "grading_pending" ||
            (session.status === "ready_to_finish" &&
              session.completionRecommendation?.hardLimitReached === true)
          );
        })
        .map(([, session]) => clone(session))
        .sort(
          (a, b) =>
            a.updatedAt.localeCompare(b.updatedAt) || String(a.id).localeCompare(String(b.id))
        )
        .slice(0, Math.max(1, Math.min(limit, 100)));
    },

    async claimTurn(input: ClaimConversationTurnInput) {
      assertLease(input.lease, input.now);
      const sessionKey = sessionStoreKey(input.tenantId, input.sessionId);
      const session = conversationSessions.get(sessionKey);
      if (!session) throw makeRepoError("NOT_FOUND", "Conversation session was not found");
      if (session.ownerUid !== input.ownerUid)
        throw makeRepoError("PERMISSION_DENIED", "Wrong session owner");
      const turns = turnMap(input.tenantId, input.sessionId);
      const messages = messageMap(input.tenantId, input.sessionId);
      const existing = turns.get(String(input.turnId));
      const learner = messages.get(String(input.learnerMessage.id));
      if (existing) {
        if (existing.requestInputHash !== input.requestInputHash) {
          throw makeRepoError("CONFLICT", "clientMessageId was reused with different input");
        }
        if (!learner) throw makeRepoError("CONFLICT", "Turn exists without learner message");
        if (existing.status === "completed") {
          return {
            outcome: "completed_replay" as const,
            session: clone(session),
            turn: clone(existing),
            learnerMessage: clone(learner),
            assistantMessages: existing.assistantMessageIds
              .map((id) => messages.get(String(id)))
              .filter((message): message is ConversationMessage => Boolean(message))
              .map(clone),
          };
        }
        if (existing.status === "failed_terminal") {
          return {
            outcome: "terminal_replay" as const,
            session: clone(session),
            turn: clone(existing),
            learnerMessage: clone(learner),
            assistantMessages: [],
          };
        }
        if (
          ["claimed", "model_running", "tool_running"].includes(existing.status) &&
          !expired(existing.lease?.expiresAt, input.now)
        ) {
          throw makeLeaseConflict("This turn is already running under an unexpired lease");
        }
        const reclaimed = {
          ...existing,
          status: "claimed",
          attemptCount: existing.attemptCount + 1,
          lease: input.lease,
          modelRequestIds: [],
          assistantMessageIds: [],
          error: undefined,
          claimedAt: input.now,
          updatedAt: input.now,
        } as unknown as ConversationTurnDoc;
        const nextSession = {
          ...session,
          status: "active",
          activeTurnId: input.turnId,
          activeTurnLeaseExpiresAt: input.lease.expiresAt,
          revision: session.revision + 1,
          updatedAt: input.now,
        } as ConversationSessionDoc;
        turns.set(String(input.turnId), clone(reclaimed));
        conversationSessions.set(sessionKey, clone(nextSession));
        return {
          outcome: "reclaimed" as const,
          session: clone(nextSession),
          turn: clone(reclaimed),
          learnerMessage: clone(learner),
          assistantMessages: [],
        };
      }
      if (learner) throw makeRepoError("CONFLICT", "Learner message id is already in use");
      if (
        !["active", "ready_to_finish"].includes(session.status) ||
        hardCap(session) ||
        simpleCap(session)
      ) {
        throw makeRepoError("INVALID_TRANSITION", "Session is not accepting turns");
      }
      if (session.activeTurnId && !expired(session.activeTurnLeaseExpiresAt, input.now)) {
        throw makeRepoError("CONFLICT", "A different turn owns this session");
      }
      const learnerMessage = {
        id: input.learnerMessage.id,
        sessionId: input.sessionId,
        sequence: session.nextSequence,
        role: "learner",
        origin: "turn",
        turnId: input.turnId,
        clientMessageId: input.clientMessageId,
        content: input.learnerMessage.content,
        deliveryStatus: "accepted",
        createdAt: input.learnerMessage.createdAt,
      } as unknown as ConversationMessage;
      const turn = {
        id: input.turnId,
        tenantId: input.tenantId,
        ownerUid: input.ownerUid,
        sessionId: input.sessionId,
        clientMessageId: input.clientMessageId,
        learnerMessageId: input.learnerMessage.id,
        status: "claimed",
        attemptCount: 1,
        lease: input.lease,
        promptVersion: session.configurationSnapshot.prompt.version,
        configurationFingerprint: session.configurationSnapshot.fingerprint,
        toolsetVersion: session.configurationSnapshot.toolset.version,
        modelPolicyId: session.configurationSnapshot.runtimeModelPolicyId,
        modelRequestIds: [],
        toolInvocations: [],
        assistantMessageIds: [],
        traceId: String(input.turnId),
        claimedAt: input.now,
        sessionRevisionAtClaim: session.revision,
        requestInputHash: input.requestInputHash,
        updatedAt: input.now,
      } as unknown as ConversationTurnDoc;
      const nextSession = {
        ...session,
        status: "active",
        nextSequence: session.nextSequence + 1,
        learnerTurnCount: session.learnerTurnCount + 1,
        activeTurnId: input.turnId,
        activeTurnLeaseExpiresAt: input.lease.expiresAt,
        lastMessageAt: input.learnerMessage.createdAt,
        revision: session.revision + 1,
        updatedAt: input.now,
      } as ConversationSessionDoc;
      messages.set(String(learnerMessage.id), clone(learnerMessage));
      turns.set(String(turn.id), clone(turn));
      conversationSessions.set(sessionKey, clone(nextSession));
      return {
        outcome: "claimed" as const,
        session: clone(nextSession),
        turn: clone(turn),
        learnerMessage: clone(learnerMessage),
        assistantMessages: [],
      };
    },

    async markTurnPhase(input: MarkTurnPhaseInput): Promise<ConversationTurn> {
      const turn = turnMap(input.tenantId, input.sessionId).get(String(input.turnId));
      if (!turn) throw makeRepoError("NOT_FOUND", "Conversation turn was not found");
      if (
        !turn.lease ||
        turn.lease.token !== input.leaseToken ||
        expired(turn.lease.expiresAt, input.now)
      ) {
        throw makeRepoError("CONFLICT", "Turn lease was lost");
      }
      // Same-phase re-marks are valid incremental updates (attach modelRequestId /
      // persist each tool invocation); only backward or terminal re-entry is invalid.
      // Mirrors the real adapter (LLD §9.4/§10.2, CONV-P0 tool-loop fix).
      const valid =
        (input.status === "model_running" &&
          (turn.status === "claimed" ||
            turn.status === "model_running" ||
            turn.status === "tool_running")) ||
        (input.status === "tool_running" &&
          (turn.status === "model_running" || turn.status === "tool_running"));
      if (!valid) throw makeRepoError("INVALID_TRANSITION", "Turn phase cannot move backwards");
      const invocations = [...turn.toolInvocations];
      if (input.toolInvocation) {
        const index = invocations.findIndex((value) => value.id === input.toolInvocation?.id);
        if (index >= 0 && !sameCanonical(invocations[index], input.toolInvocation)) {
          throw makeRepoError("CONFLICT", "Tool invocation id was reused with different content");
        }
        if (index < 0) invocations.push(input.toolInvocation);
      }
      const usage = input.usageDelta
        ? {
            inputTokens: (turn.usageAggregate?.inputTokens ?? 0) + input.usageDelta.inputTokens,
            outputTokens: (turn.usageAggregate?.outputTokens ?? 0) + input.usageDelta.outputTokens,
            cachedInputTokens:
              (turn.usageAggregate?.cachedInputTokens ?? 0) + input.usageDelta.cachedInputTokens,
            costUsd: (turn.usageAggregate?.costUsd ?? 0) + input.usageDelta.costUsd,
          }
        : turn.usageAggregate;
      const next = {
        ...turn,
        status: input.status,
        modelRequestIds: input.modelRequestId
          ? [...new Set([...turn.modelRequestIds, input.modelRequestId])]
          : turn.modelRequestIds,
        toolInvocations: invocations,
        usageAggregate: usage,
        updatedAt: input.now,
      } as unknown as ConversationTurnDoc;
      turnMap(input.tenantId, input.sessionId).set(String(input.turnId), clone(next));
      return clone(next) as ConversationTurn;
    },

    async commitTurn(input: CommitConversationTurnInput) {
      const sessionKey = sessionStoreKey(input.tenantId, input.sessionId);
      const session = conversationSessions.get(sessionKey);
      const turns = turnMap(input.tenantId, input.sessionId);
      const turn = turns.get(String(input.turnId));
      if (!session || !turn)
        throw makeRepoError("NOT_FOUND", "Conversation session or turn was not found");
      const messages = messageMap(input.tenantId, input.sessionId);
      if (turn.status === "completed") {
        const assistantMessages = turn.assistantMessageIds
          .map((id) => messages.get(String(id)))
          .filter((value): value is ConversationMessage => Boolean(value))
          .map(clone);
        if (assistantMessages.length !== input.assistantMessages.length) {
          throw makeRepoError("CONFLICT", "Completed turn replay has different output");
        }
        return {
          session: clone(session),
          turn: clone(turn),
          assistantMessages,
          hardLimitAutoFinalize: hardCap(session),
        };
      }
      if (
        session.activeTurnId !== input.turnId ||
        !turn.lease ||
        turn.lease.token !== input.leaseToken ||
        expired(turn.lease.expiresAt, input.now) ||
        input.configurationFingerprint !== session.configurationSnapshot.fingerprint ||
        input.configurationFingerprint !== turn.configurationFingerprint
      ) {
        throw makeRepoError(
          "CONFLICT",
          "Turn commit lost its session, lease, or configuration fence"
        );
      }
      if (!["claimed", "model_running", "tool_running"].includes(turn.status)) {
        throw makeRepoError(
          "INVALID_TRANSITION",
          "Turn cannot be committed from its current state"
        );
      }
      const assistantMessages: ConversationMessage[] = [];
      const seen = new Set<string>();
      let nextSequence = session.nextSequence;
      for (const candidate of input.assistantMessages) {
        if (seen.has(String(candidate.id)))
          throw makeRepoError("VALIDATION_ERROR", "Duplicate assistant message id");
        seen.add(String(candidate.id));
        const existing = messages.get(String(candidate.id));
        if (existing) {
          if (!sameCanonical(existing.content, candidate.content)) {
            throw makeRepoError(
              "CONFLICT",
              "Assistant message id was reused with different content"
            );
          }
          assistantMessages.push(clone(existing));
          continue;
        }
        const message = {
          id: candidate.id,
          sessionId: input.sessionId,
          sequence: nextSequence++,
          role: "assistant",
          origin: "turn",
          turnId: input.turnId,
          content: candidate.content,
          deliveryStatus: "complete",
          createdAt: candidate.createdAt,
          completedAt: candidate.completedAt,
        } as unknown as ConversationMessage;
        messages.set(String(message.id), clone(message));
        assistantMessages.push(message);
      }
      for (const evidence of input.evidence) {
        if (
          evidence.tenantId !== input.tenantId ||
          evidence.sessionId !== input.sessionId ||
          evidence.turnId !== input.turnId
        ) {
          throw makeRepoError("VALIDATION_ERROR", "Evidence is outside the committed turn scope");
        }
        const evidenceStore = evidenceMap(input.tenantId, input.sessionId);
        const prior = evidenceStore.get(String(evidence.id));
        if (prior && !sameCanonical(prior, evidence))
          throw makeRepoError("CONFLICT", "Evidence id conflict");
        if (!prior)
          evidenceStore.set(
            String(evidence.id),
            clone(evidence as unknown as Record<string, unknown>)
          );
      }
      const hard = hardCap(session);
      const capped = simpleCap(session);
      const recommendation = hard
        ? {
            reasonCode: "hard_limit" as const,
            coveredPublicObjectiveIds:
              session.completionRecommendation?.coveredPublicObjectiveIds ?? [],
            remainingPublicObjectiveIds:
              session.completionRecommendation?.remainingPublicObjectiveIds ?? [],
            hardLimitReached: true,
            recommendedAt: input.now,
          }
        : input.completionRecommendation;
      const latest = assistantMessages[assistantMessages.length - 1];
      const nextSession = {
        ...session,
        status: capped ? "completed" : recommendation ? "ready_to_finish" : "active",
        nextSequence,
        activeTurnId: undefined,
        activeTurnLeaseExpiresAt: undefined,
        completionRecommendation: recommendation,
        lastMessageAt: latest?.completedAt ?? session.lastMessageAt,
        lastMessagePreview: latest
          ? (preview(latest.content) ?? session.lastMessagePreview)
          : session.lastMessagePreview,
        revision: session.revision + 1,
        updatedAt: input.now,
        completedAt: capped ? input.now : undefined,
      } as ConversationSessionDoc;
      const nextTurn = {
        ...turn,
        status: "completed",
        lease: undefined,
        modelRequestIds: [...new Set(input.modelRequestIds)],
        assistantMessageIds: assistantMessages.map((message) => message.id),
        usageAggregate: input.usageAggregate,
        error: undefined,
        completedAt: input.now,
        updatedAt: input.now,
      } as unknown as ConversationTurnDoc;
      conversationSessions.set(sessionKey, clone(nextSession));
      turns.set(String(input.turnId), clone(nextTurn));
      if (capped) clearActiveKey(input.tenantId, session, input.now);
      return {
        session: clone(nextSession),
        turn: clone(nextTurn),
        assistantMessages: assistantMessages.map(clone),
        hardLimitAutoFinalize: hard,
      };
    },

    async failTurn(input: FailConversationTurnInput) {
      const sessionKey = sessionStoreKey(input.tenantId, input.sessionId);
      const session = conversationSessions.get(sessionKey);
      const turns = turnMap(input.tenantId, input.sessionId);
      const turn = turns.get(String(input.turnId));
      if (!session || !turn)
        throw makeRepoError("NOT_FOUND", "Conversation session or turn was not found");
      if (
        !turn.lease ||
        turn.lease.token !== input.leaseToken ||
        expired(turn.lease.expiresAt, input.now)
      ) {
        throw makeRepoError("CONFLICT", "Turn lease was lost");
      }
      if (!["claimed", "model_running", "tool_running"].includes(turn.status)) {
        throw makeRepoError("INVALID_TRANSITION", "Turn cannot fail from its current state");
      }
      const hard = input.terminal && hardCap(session);
      const capped = input.terminal && simpleCap(session);
      const learner = messageMap(input.tenantId, input.sessionId).get(
        String(turn.learnerMessageId)
      );
      const nextTurn = {
        ...turn,
        status: input.terminal ? "failed_terminal" : "failed_recoverable",
        lease: undefined,
        error: input.error,
        completedAt: input.terminal ? input.now : undefined,
        updatedAt: input.now,
      } as unknown as ConversationTurnDoc;
      const nextSession = {
        ...session,
        status: capped ? "completed" : hard ? "ready_to_finish" : "active",
        activeTurnId: undefined,
        activeTurnLeaseExpiresAt: undefined,
        completionRecommendation: hard
          ? {
              reasonCode: "hard_limit" as const,
              coveredPublicObjectiveIds:
                session.completionRecommendation?.coveredPublicObjectiveIds ?? [],
              remainingPublicObjectiveIds:
                session.completionRecommendation?.remainingPublicObjectiveIds ?? [],
              hardLimitReached: true,
              recommendedAt: input.now,
            }
          : session.completionRecommendation,
        lastMessagePreview: learner
          ? (preview(learner.content) ?? session.lastMessagePreview)
          : session.lastMessagePreview,
        revision: session.revision + 1,
        updatedAt: input.now,
        completedAt: capped ? input.now : undefined,
      } as ConversationSessionDoc;
      turns.set(String(input.turnId), clone(nextTurn));
      conversationSessions.set(sessionKey, clone(nextSession));
      if (capped) clearActiveKey(input.tenantId, session, input.now);
      return { session: clone(nextSession), turn: clone(nextTurn), hardLimitAutoFinalize: hard };
    },

    async acquireFinalization(input: AcquireFinalizationInput) {
      assertLease(input.lease, input.now);
      const key = sessionStoreKey(input.tenantId, input.sessionId);
      const session = conversationSessions.get(key);
      if (!session) throw makeRepoError("NOT_FOUND", "Conversation session was not found");
      if (input.source === "learner" && session.ownerUid !== input.ownerUid) {
        throw makeRepoError("PERMISSION_DENIED", "Wrong session owner");
      }
      if (session.mode !== "agent_assessment") {
        if (session.status === "completed")
          return {
            outcome: "completed_replay" as const,
            session: clone(session),
            frozenThroughSequence: 0,
            frozenRevision: session.revision,
          };
        if (session.activeTurnId || !["active", "ready_to_finish"].includes(session.status)) {
          throw makeRepoError("INVALID_TRANSITION", "Conversation cannot be closed while active");
        }
        const completed = {
          ...session,
          status: "completed",
          revision: session.revision + 1,
          updatedAt: input.now,
          completedAt: input.now,
        } as ConversationSessionDoc;
        conversationSessions.set(key, clone(completed));
        clearActiveKey(input.tenantId, session, input.now);
        return {
          outcome: "completed_replay" as const,
          session: clone(completed),
          frozenThroughSequence: 0,
          frozenRevision: completed.revision,
        };
      }
      const submissionId = session.finalization?.submissionId;
      const submission = submissionId
        ? itemSubmissionStore.get(submissionStoreKey(input.tenantId, String(submissionId)))
        : undefined;
      const frozenThrough =
        session.finalization?.frozenThroughSequence ?? Math.max(0, session.nextSequence - 1);
      const frozenRevision = session.finalization?.frozenRevision ?? session.revision;
      if (session.status === "completed" || session.safeResult)
        return {
          outcome: "completed_replay" as const,
          session: clone(session),
          frozenThroughSequence: frozenThrough,
          frozenRevision,
          ...(submission ? { submission: clone(submission) } : {}),
        };
      if (submission)
        return {
          outcome: "submission_replay" as const,
          session: clone(session),
          frozenThroughSequence: frozenThrough,
          frozenRevision,
          submission: clone(submission),
        };
      const prior = session.finalization?.lease;
      if (session.status === "finalizing" && prior && !expired(prior.expiresAt, input.now)) {
        if (prior.ownerRequestId !== input.ownerRequestId)
          throw makeLeaseConflict("Another request owns finalization");
        return {
          outcome: "claimed" as const,
          session: clone(session),
          frozenThroughSequence: frozenThrough,
          frozenRevision,
        };
      }
      if (
        session.activeTurnId ||
        !["active", "ready_to_finish", "finalizing"].includes(session.status)
      ) {
        throw makeRepoError("INVALID_TRANSITION", "Session cannot enter finalization now");
      }
      const policy = session.publicConfig.completionPolicy;
      if (
        input.source === "learner" &&
        policy &&
        session.learnerTurnCount < policy.minLearnerTurns &&
        (!policy.allowEarlyFinish || input.earlyFinishConfirmed !== true)
      ) {
        throw makeRepoError("PRECONDITION_FAILED", "Early finish confirmation is required");
      }
      if (input.source === "hard_limit" && !session.completionRecommendation?.hardLimitReached) {
        throw makeRepoError("PRECONDITION_FAILED", "Hard-limit recommendation is required");
      }
      if (input.source === "recovery" && session.status !== "finalizing") {
        throw makeRepoError("INVALID_TRANSITION", "Recovery only reclaims a finalizing session");
      }
      const next = {
        ...session,
        status: "finalizing",
        finalization: {
          ...session.finalization,
          lease: input.lease,
          frozenThroughSequence: Math.max(0, session.nextSequence - 1),
          frozenRevision: session.revision + 1,
          requestedReason:
            input.source === "hard_limit"
              ? "hard_limit"
              : (session.finalization?.requestedReason ?? "learner_requested"),
          ...(input.source === "learner"
            ? { earlyFinishConfirmed: input.earlyFinishConfirmed === true }
            : {}),
          startedAt: input.now,
        },
        revision: session.revision + 1,
        updatedAt: input.now,
      } as ConversationSessionDoc;
      conversationSessions.set(key, clone(next));
      return {
        outcome: "claimed" as const,
        session: clone(next),
        frozenThroughSequence: next.finalization!.frozenThroughSequence!,
        frozenRevision: next.finalization!.frozenRevision!,
      };
    },

    async freezeSubmission(input) {
      const key = sessionStoreKey(input.tenantId, input.sessionId);
      const session = conversationSessions.get(key);
      if (!session) throw makeRepoError("NOT_FOUND", "Conversation session was not found");
      const lease = session.finalization?.lease;
      if (
        session.status !== "finalizing" ||
        !lease ||
        lease.token !== input.finalizationLeaseToken ||
        expired(lease.expiresAt, input.now)
      ) {
        throw makeRepoError("CONFLICT", "Finalization lease was lost");
      }
      if (session.mode !== "agent_assessment" || session.context.kind !== "agent_assessment") {
        throw makeRepoError("INVALID_TRANSITION", "Only assessments create submissions");
      }
      if (
        input.payload.frozenThroughSequence !== session.finalization?.frozenThroughSequence ||
        input.payload.configurationFingerprint !== session.configurationSnapshot.fingerprint ||
        !sameCanonical(input.payload.configurationSnapshot, session.configurationSnapshot)
      ) {
        throw makeRepoError("CONFLICT", "Submission payload does not match frozen session");
      }
      const existing = itemSubmissionStore.get(
        submissionStoreKey(input.tenantId, String(input.submissionId))
      );
      if (existing) {
        if (
          existing.sessionId !== input.sessionId ||
          !sameCanonical(existing.payload, input.payload)
        )
          throw makeRepoError("CONFLICT", "Immutable submission conflict");
        return { session: clone(session), submission: clone(existing), replayed: true };
      }
      const submission = {
        schemaVersion: 1,
        id: input.submissionId,
        tenantId: input.tenantId,
        ownerUid: session.ownerUid,
        ...(session.learnerStudentId ? { learnerStudentId: session.learnerStudentId } : {}),
        spaceId: session.context.spaceId,
        storyPointId: session.context.storyPointId,
        itemId: session.context.itemId,
        sessionId: input.sessionId,
        attemptNumber: session.context.attemptNumber,
        payload: input.payload,
        workflow: { status: "frozen", evaluationAttemptCount: 0 },
        createdAt: input.now,
        updatedAt: input.now,
      } as unknown as ItemSubmissionDoc;
      const next = {
        ...session,
        status: "grading_pending",
        finalization: {
          ...session.finalization,
          lease: undefined,
          submissionId: input.submissionId,
          transcriptHash: input.payload.transcriptHash,
          completedAt: input.now,
        },
        revision: session.revision + 1,
        updatedAt: input.now,
      } as ConversationSessionDoc;
      itemSubmissionStore.set(
        submissionStoreKey(input.tenantId, String(input.submissionId)),
        clone(submission)
      );
      conversationSessions.set(key, clone(next));
      return { session: clone(next), submission: clone(submission), replayed: false };
    },

    async completeFinalization(input: CompleteConversationFinalizationInput) {
      const key = sessionStoreKey(input.tenantId, input.sessionId);
      const session = conversationSessions.get(key);
      const submission = itemSubmissionStore.get(
        submissionStoreKey(input.tenantId, String(input.submissionId))
      );
      if (!session || !submission)
        throw makeRepoError("NOT_FOUND", "Session or submission was not found");
      if (session.status === "completed" || session.safeResult) {
        if (session.safeResult?.submissionId !== input.submissionId)
          throw makeRepoError("CONFLICT", "Completed session has another submission");
        return { session: clone(session), replayed: true };
      }
      const marker = progressApplicationStore.get(
        `${input.tenantId}/${submission.ownerUid}/${submission.spaceId}/${input.submissionId}`
      );
      if (
        session.finalization?.submissionId !== input.submissionId ||
        session.finalization?.frozenRevision !== input.expectedFrozenRevision ||
        session.finalization?.transcriptHash !== input.expectedTranscriptHash ||
        !submission.evaluation ||
        submission.workflow.status !== "progress_applied" ||
        !marker ||
        marker["evaluationResultHash"] !== submission.evaluation.resultHash
      ) {
        throw makeRepoError(
          "CONFLICT",
          "Finalization bindings, evaluation, or progress marker mismatch"
        );
      }
      const completed = {
        ...session,
        status: "completed",
        finalization: { ...session.finalization, lease: undefined, completedAt: input.now },
        safeResult: {
          submissionId: input.submissionId,
          evaluation: submission.evaluation.safeResult,
          progressApplied: true,
        },
        revision: session.revision + 1,
        updatedAt: input.now,
        completedAt: input.now,
      } as ConversationSessionDoc;
      conversationSessions.set(key, clone(completed));
      clearActiveKey(input.tenantId, session, input.now);
      return { session: clone(completed), replayed: false };
    },

    async abandon(input: AbandonConversationInput) {
      const key = sessionStoreKey(input.tenantId, input.sessionId);
      const session = conversationSessions.get(key);
      if (!session) throw makeRepoError("NOT_FOUND", "Conversation session was not found");
      if (session.ownerUid !== input.ownerUid)
        throw makeRepoError("PERMISSION_DENIED", "Wrong session owner");
      if (session.clientRequestId !== input.clientRequestId)
        throw makeRepoError("CONFLICT", "Different client request id");
      if (session.status === "abandoned") return { session: clone(session), replayed: true };
      if (
        session.status === "completed" ||
        session.activeTurnId ||
        ["finalizing", "grading_pending"].includes(session.status)
      ) {
        throw makeRepoError("INVALID_TRANSITION", "Conversation cannot be abandoned now");
      }
      const next = {
        ...session,
        status: "abandoned",
        abandonedAt: input.now,
        revision: session.revision + 1,
        updatedAt: input.now,
      } as ConversationSessionDoc;
      conversationSessions.set(key, clone(next));
      clearActiveKey(input.tenantId, session, input.now);
      return { session: clone(next), replayed: false };
    },
  };

  // --- item-submission twin (immutable submission + evaluation-lease authority) ---
  const MAX_EVALUATION_ATTEMPTS = 3;
  const evalAttemptId = (attemptNumber: number): string => `evaluation_${attemptNumber}`;
  const leaseTokenHash = (token: string): string => sha256Base64Url(token);
  const assertEvalLease = (lease: ConversationLease, ts: string) => {
    if (!lease.token || !lease.ownerRequestId || expired(lease.expiresAt, ts)) {
      throw makeRepoError("VALIDATION_ERROR", "A non-expired evaluation lease is required");
    }
  };
  const assertSubmissionLease = (submission: ItemSubmissionDoc, token: string, ts: string) => {
    const lease = submission.workflow.evaluationLease;
    if (!lease || lease.token !== token || expired(lease.expiresAt, ts)) {
      throw makeRepoError("CONFLICT", "The evaluation lease no longer belongs to this request");
    }
  };
  const validateEvaluation = (evaluation: NonNullable<ItemSubmissionDoc["evaluation"]>) => {
    const result = evaluation.result;
    const finite = [
      result.score,
      result.maxScore,
      result.correctness,
      result.percentage,
      result.confidence,
    ].every(Number.isFinite);
    if (
      !finite ||
      result.score < 0 ||
      result.maxScore < 0 ||
      result.score > result.maxScore ||
      result.correctness < 0 ||
      result.correctness > 1 ||
      result.percentage < 0 ||
      result.percentage > 100
    ) {
      throw makeRepoError("VALIDATION_ERROR", "Evaluation result is outside accepted score bounds");
    }
    if (canonicalHash(result) !== evaluation.resultHash) {
      throw makeRepoError("CONFLICT", "Evaluation resultHash does not match its immutable result");
    }
  };
  const setSessionStatus = (
    tenantId: string,
    sessionId: string,
    status: ConversationSessionDoc["status"],
    ts: string
  ) => {
    const key = sessionStoreKey(tenantId, sessionId);
    const session = conversationSessions.get(key);
    if (session) {
      conversationSessions.set(key, {
        ...session,
        status,
        revision: session.revision + 1,
        updatedAt: ts as never,
      } as ConversationSessionDoc);
    }
  };

  const itemSubmissions: ItemSubmissionRepo = {
    async get(tenantId, submissionId) {
      const value = itemSubmissionStore.get(submissionStoreKey(tenantId, submissionId));
      return value ? clone(value) : null;
    },

    async acquireEvaluation(input: AcquireEvaluationInput) {
      assertEvalLease(input.lease, input.now);
      const key = submissionStoreKey(input.tenantId, String(input.submissionId));
      const submission = itemSubmissionStore.get(key);
      if (!submission) throw makeRepoError("NOT_FOUND", "Item submission was not found");
      const session = conversationSessions.get(
        sessionStoreKey(input.tenantId, String(submission.sessionId))
      );
      if (submission.evaluation) {
        return { outcome: "evaluated_replay" as const, submission: clone(submission) };
      }
      const attempts = attemptMap(input.tenantId, String(input.submissionId));
      const currentLease = submission.workflow.evaluationLease;
      const currentAttempt = currentLease
        ? attempts.get(evalAttemptId(submission.workflow.evaluationAttemptCount))
        : undefined;
      if (currentLease && !expired(currentLease.expiresAt, input.now)) {
        if (currentLease.ownerRequestId !== input.ownerRequestId) {
          throw makeLeaseConflict("Another evaluator currently owns this submission");
        }
        if (!currentAttempt) {
          throw makeRepoError(
            "CONFLICT",
            "Evaluation lease exists without its deterministic attempt record"
          );
        }
        return {
          outcome: "claimed" as const,
          submission: clone(submission),
          attempt: clone(currentAttempt),
        };
      }
      if (submission.workflow.evaluationAttemptCount >= MAX_EVALUATION_ATTEMPTS) {
        return { outcome: "terminal_failure" as const, submission: clone(submission) };
      }
      if (
        submission.workflow.status !== "frozen" &&
        submission.workflow.status !== "grading_pending" &&
        submission.workflow.status !== "grading_failed" &&
        submission.workflow.status !== "grading"
      ) {
        throw makeRepoError("INVALID_TRANSITION", "Submission is not ready for evaluation");
      }
      if (
        submission.workflow.status === "grading_failed" &&
        submission.workflow.nextRetryAt &&
        !expired(submission.workflow.nextRetryAt, input.now)
      ) {
        throw makeRepoError("PRECONDITION_FAILED", "Evaluation retry is not due yet");
      }
      const nextAttemptNumber = submission.workflow.evaluationAttemptCount + 1;
      const id = evalAttemptId(nextAttemptNumber);
      if (attempts.get(id)) {
        throw makeRepoError("CONFLICT", "Deterministic evaluation attempt id already exists");
      }
      const attempt = {
        id,
        submissionId: input.submissionId,
        attemptNumber: nextAttemptNumber,
        leaseTokenHash: leaseTokenHash(input.lease.token),
        status: "running",
        traceId: input.ownerRequestId,
        startedAt: input.now,
      } as unknown as ItemSubmissionEvaluationAttemptDoc;
      const nextSubmission = {
        ...submission,
        workflow: {
          ...submission.workflow,
          status: "grading",
          evaluationLease: input.lease,
          evaluationAttemptCount: nextAttemptNumber,
          nextRetryAt: undefined,
          lastError: undefined,
        },
        updatedAt: input.now,
      } as unknown as ItemSubmissionDoc;
      itemSubmissionStore.set(key, clone(nextSubmission));
      attempts.set(id, clone(attempt));
      if (session && session.status === "grading_failed") {
        setSessionStatus(
          input.tenantId,
          String(submission.sessionId),
          "grading_pending",
          input.now
        );
      }
      return {
        outcome: "claimed" as const,
        submission: clone(nextSubmission),
        attempt: clone(attempt),
      };
    },

    async commitEvaluation(input: CommitSubmissionEvaluationInput) {
      validateEvaluation(input.evaluation);
      const key = submissionStoreKey(input.tenantId, String(input.submissionId));
      const submission = itemSubmissionStore.get(key);
      if (!submission) throw makeRepoError("NOT_FOUND", "Item submission was not found");
      const session = conversationSessions.get(
        sessionStoreKey(input.tenantId, String(submission.sessionId))
      );
      const attempts = attemptMap(input.tenantId, String(input.submissionId));
      const attempt = attempts.get(String(input.attemptId));
      if (submission.evaluation) {
        if (!sameCanonical(submission.evaluation, input.evaluation)) {
          throw makeRepoError("CONFLICT", "A different immutable evaluation already exists");
        }
        return clone(submission);
      }
      assertSubmissionLease(submission, input.leaseToken, input.now);
      if (
        submission.workflow.status !== "grading" ||
        !attempt ||
        attempt.status !== "running" ||
        attempt.leaseTokenHash !== leaseTokenHash(input.leaseToken)
      ) {
        throw makeRepoError("CONFLICT", "Evaluation attempt no longer owns the submission");
      }
      const nextSubmission = {
        ...submission,
        evaluation: input.evaluation,
        workflow: {
          ...submission.workflow,
          status: "evaluated",
          evaluationLease: undefined,
          nextRetryAt: undefined,
          lastError: undefined,
        },
        updatedAt: input.now,
      } as unknown as ItemSubmissionDoc;
      const nextAttempt = {
        ...attempt,
        status: "succeeded",
        completedAt: input.now,
      } as unknown as ItemSubmissionEvaluationAttemptDoc;
      itemSubmissionStore.set(key, clone(nextSubmission));
      attempts.set(String(input.attemptId), clone(nextAttempt));
      if (session && session.status === "grading_failed") {
        setSessionStatus(
          input.tenantId,
          String(submission.sessionId),
          "grading_pending",
          input.now
        );
      }
      return clone(nextSubmission);
    },

    async failEvaluation(input: FailSubmissionEvaluationInput) {
      const key = submissionStoreKey(input.tenantId, String(input.submissionId));
      const submission = itemSubmissionStore.get(key);
      if (!submission) throw makeRepoError("NOT_FOUND", "Item submission was not found");
      const session = conversationSessions.get(
        sessionStoreKey(input.tenantId, String(submission.sessionId))
      );
      const attempts = attemptMap(input.tenantId, String(input.submissionId));
      const attempt = attempts.get(String(input.attemptId));
      assertSubmissionLease(submission, input.leaseToken, input.now);
      if (
        submission.workflow.status !== "grading" ||
        !attempt ||
        attempt.status !== "running" ||
        attempt.leaseTokenHash !== leaseTokenHash(input.leaseToken)
      ) {
        throw makeRepoError("CONFLICT", "Evaluation attempt no longer owns the submission");
      }
      const terminal = submission.workflow.evaluationAttemptCount >= MAX_EVALUATION_ATTEMPTS;
      const nextSubmission = {
        ...submission,
        workflow: {
          ...submission.workflow,
          status: "grading_failed",
          evaluationLease: undefined,
          lastError: input.error,
          nextRetryAt: terminal ? undefined : input.nextRetryAt,
        },
        updatedAt: input.now,
      } as unknown as ItemSubmissionDoc;
      const nextAttempt = {
        ...attempt,
        status: "failed",
        errorCode: input.error.code,
        retryable: input.error.retryable && !terminal,
        completedAt: input.now,
      } as unknown as ItemSubmissionEvaluationAttemptDoc;
      itemSubmissionStore.set(key, clone(nextSubmission));
      attempts.set(String(input.attemptId), clone(nextAttempt));
      if (session && session.status !== "completed") {
        setSessionStatus(input.tenantId, String(submission.sessionId), "grading_failed", input.now);
      }
      return clone(nextSubmission);
    },

    async listRetryable(tenantId, ts, limit) {
      const bounded = Math.max(1, Math.min(limit, 100));
      return [...itemSubmissionStore.entries()]
        .filter(([storeKey]) => storeKey.startsWith(`${tenantId}/`))
        .map(([, submission]) => submission)
        .filter(
          (submission) =>
            submission.workflow.status === "grading_failed" &&
            !!submission.workflow.nextRetryAt &&
            expired(submission.workflow.nextRetryAt, ts)
        )
        .sort(
          (a, b) =>
            String(a.workflow.nextRetryAt).localeCompare(String(b.workflow.nextRetryAt)) ||
            String(a.id).localeCompare(String(b.id))
        )
        .slice(0, bounded)
        .map(clone);
    },

    async listRecoveryCandidates(tenantId, ts, limit) {
      const bounded = Math.max(1, Math.min(limit, 100));
      const unique = new Map<string, ItemSubmissionDoc>();
      for (const [storeKey, submission] of itemSubmissionStore.entries()) {
        if (!storeKey.startsWith(`${tenantId}/`)) continue;
        const status = submission.workflow.status;
        const eligible =
          status === "frozen" ||
          status === "grading_pending" ||
          (status === "grading_failed" &&
            !!submission.workflow.nextRetryAt &&
            expired(submission.workflow.nextRetryAt, ts)) ||
          (status === "grading" && expired(submission.workflow.evaluationLease?.expiresAt, ts));
        if (eligible) unique.set(String(submission.id), submission);
      }
      return [...unique.values()]
        .sort(
          (a, b) =>
            a.updatedAt.localeCompare(b.updatedAt) || String(a.id).localeCompare(String(b.id))
        )
        .slice(0, bounded)
        .map(clone);
    },
  };

  // --- levelup-content twin (exact-path frozen-configuration loaders) ---
  const isScoped = (data: Record<string, unknown>, expected: Record<string, string>): boolean =>
    Object.entries(expected).every(([field, value]) => {
      const actual = data[field];
      return actual === undefined || actual === value;
    });

  const levelupContent: LevelupContentRepo = {
    async getSpace(tenantId, spaceId) {
      const data = tenantMap("spaces", tenantId).get(spaceId);
      return data && isScoped(data, { tenantId, id: spaceId }) ? clone(data) : null;
    },
    async getStoryPoint(tenantId, spaceId, storyPointId) {
      const data = tenantMap("storyPoints", tenantId).get(storyPointId);
      return data && isScoped(data, { tenantId, spaceId, id: storyPointId }) ? clone(data) : null;
    },
    async getItem(tenantId, spaceId, storyPointId, itemId) {
      const data = tenantMap("items", tenantId).get(itemId);
      return data && isScoped(data, { tenantId, spaceId, storyPointId, id: itemId })
        ? clone(data)
        : null;
    },
    async getAnswerKey(tenantId, spaceId, storyPointId, itemId) {
      const data = answerKeyStore.get(`${tenantId}/${itemId}`);
      return data && isScoped(data, { tenantId, spaceId, storyPointId, itemId })
        ? clone(data)
        : null;
    },
    async getAgent(tenantId, spaceId, agentId) {
      const data = agentVersionStore.get(`${tenantId}/${agentId}`);
      return data && isScoped(data, { tenantId, spaceId, id: agentId }) ? clone(data) : null;
    },
    async getEvaluationSettings(tenantId, settingsId) {
      const data = evaluationSettingsStore.get(`${tenantId}/${settingsId}`);
      return data && isScoped(data, { tenantId, id: settingsId }) ? clone(data) : null;
    },
    async getRubricPreset(tenantId, rubricPresetId) {
      const data = rubricPresetStore.get(`${tenantId}/${rubricPresetId}`);
      return data && isScoped(data, { tenantId, id: rubricPresetId }) ? clone(data) : null;
    },
  };

  const FLAT: Record<EntityCollectionName, EntityCollectionName> = Object.fromEntries(
    ENTITY_COLLECTIONS.map((c) => [c, c])
  ) as Record<EntityCollectionName, EntityCollectionName>;

  const repos: InMemoryRepos = {
    ...entityRepos,
    items,

    claims: {
      async set(uid, claims) {
        claimsStore.set(uid, claims);
      },
      async get(uid) {
        return claimsStore.get(uid) ?? null;
      },
      async revokeRefreshTokens(uid) {
        revoked.add(uid);
      },
      _revoked(uid) {
        return revoked.has(uid);
      },
    },

    answerKeys: {
      async put(tenantId, itemId, key) {
        answerKeyStore.set(`${tenantId}/${itemId}`, key);
      },
      async get(tenantId, itemId) {
        return answerKeyStore.get(`${tenantId}/${itemId}`) ?? null;
      },
      async getScoped(tenantId, spaceId, storyPointId, itemId) {
        const data = answerKeyStore.get(`${tenantId}/${itemId}`);
        if (!data) return null;
        // The exact nested path is the authority.  The denormalized fields are
        // checked too, which makes a stale/corrupt copied key fail closed.
        if (
          (data["tenantId"] !== undefined && data["tenantId"] !== tenantId) ||
          (data["spaceId"] !== undefined && data["spaceId"] !== spaceId) ||
          (data["storyPointId"] !== undefined && data["storyPointId"] !== storyPointId) ||
          (data["itemId"] !== undefined && data["itemId"] !== itemId)
        ) {
          return null;
        }
        return data;
      },
    },

    idempotency: {
      async begin(tenantId, uid, key) {
        const k = `${tenantId}/${uid}/${key}`;
        const existing = idemStore.get(k);
        const nowMs = Date.parse(now());
        if (existing?.status === "committed") {
          return { status: "committed", result: existing.result };
        }
        if (existing?.status === "in_flight" && existing.leaseExpiresAt > nowMs) {
          throw makeIdempotencyConflict();
        }
        idemStore.set(k, { status: "in_flight", leaseExpiresAt: nowMs + leaseMs });
        return { status: "new" };
      },
      async commit(tenantId, uid, key, result) {
        idemStore.set(`${tenantId}/${uid}/${key}`, {
          status: "committed",
          result,
          leaseExpiresAt: Number.MAX_SAFE_INTEGER,
        });
      },
      async release(tenantId, uid, key) {
        const k = `${tenantId}/${uid}/${key}`;
        if (idemStore.get(k)?.status !== "committed") idemStore.delete(k);
      },
    },

    outbox: {
      async enqueue(tenantId, entry) {
        const rows = outboxFor(tenantId);
        const logicalId =
          typeof entry["id"] === "string" ? (entry["id"] as string) : `obx_${rows.length + 1}`;
        const idx = rows.findIndex((r) => r["id"] === logicalId);
        const next = {
          ...entry,
          id: logicalId,
          status: "pending",
          // DLQ entries carry their own attempt count — don't clobber it to 0.
          attempts: (entry["attempts"] as number | undefined) ?? 0,
          enqueuedAt: now(),
        };
        if (idx >= 0) rows[idx] = { ...rows[idx], ...next };
        else rows.push(next);
      },
      async list(tenantId, opts = {}) {
        const rows = outboxStore.get(tenantId) ?? [];
        if (!opts.kind) return rows.map((r) => ({ ...r }));
        return rows.filter((r) => r["_kind"] === opts.kind).map((r) => ({ ...r }));
      },
      async update(tenantId, id, patch) {
        const rows = outboxFor(tenantId);
        const idx = rows.findIndex((r) => r["id"] === id);
        if (idx < 0) throw new Error(`outbox row ${id} not found`);
        rows[idx] = { ...rows[idx], ...patch, id };
      },
      async drain(tenantId) {
        const rows = outboxStore.get(tenantId) ?? [];
        outboxStore.set(tenantId, []);
        return rows;
      },
      _all(tenantId) {
        return outboxStore.get(tenantId) ?? [];
      },
    },

    audit: {
      async write(tenantId, entry) {
        auditFor(tenantId).push({ ...entry, at: now() });
      },
      _all(tenantId) {
        return auditStore.get(tenantId) ?? [];
      },
    },

    rateLimits: {
      async hit(subject, tier, windowKey) {
        const key = `${subject}__${tier}__${windowKey}`;
        const count = (rateLimitStore.get(key) ?? 0) + 1;
        rateLimitStore.set(key, count);
        return count;
      },
    },

    agentVersions,

    progress,

    conversations,

    itemSubmissions,

    levelupContent,

    async tx<T>(body: (h: TxHandle) => Promise<T>): Promise<T> {
      const snapshot = serializeStores(stores);
      const outboxSnapshot = JSON.stringify([...outboxStore.entries()]);
      const staged: Array<[string, Record<string, unknown>]> = [];
      const handle: TxHandle = {
        async get(coll, tenantId, id) {
          return tenantMap(FLAT[coll], tenantId).get(id) ?? null;
        },
        upsert(coll, tenantId, data) {
          const t = tenantMap(FLAT[coll], tenantId);
          const id = (data["id"] as string | undefined) ?? nextId();
          t.set(id, { ...t.get(id), ...data, id, tenantId, updatedAt: now() });
          return { id };
        },
        enqueueOutbox(tenantId, entry) {
          staged.push([tenantId, entry]);
        },
      };
      try {
        const out = await body(handle);
        for (const [t, entry] of staged) {
          outboxFor(t).push({
            ...entry,
            status: "pending",
            attempts: (entry["attempts"] as number | undefined) ?? 0,
            enqueuedAt: now(),
          });
        }
        return out;
      } catch (e) {
        restoreStores(stores, snapshot);
        outboxStore.clear();
        for (const [t, rows] of JSON.parse(outboxSnapshot) as [
          string,
          Record<string, unknown>[],
        ][]) {
          outboxStore.set(t, rows);
        }
        throw e;
      }
    },

    encodeCursor,
    decodeCursor,

    _all(coll, tenantId) {
      return [...tenantMap(coll, tenantId).values()];
    },

    _reset() {
      stores.clear();
      claimsStore.clear();
      revoked.clear();
      answerKeyStore.clear();
      idemStore.clear();
      outboxStore.clear();
      auditStore.clear();
      rateLimitStore.clear();
      progressStore.clear();
      agentVersionStore.clear();
    },
  };

  return repos;
}

function serializeStores(stores: Map<EntityCollectionName, DocStore>): string {
  const flat: Array<[string, Array<[string, Array<[string, Record<string, unknown>]>]>]> = [];
  for (const [coll, ds] of stores) {
    const tenants: Array<[string, Array<[string, Record<string, unknown>]>]> = [];
    for (const [t, docs] of ds) tenants.push([t, [...docs.entries()]]);
    flat.push([coll, tenants]);
  }
  return JSON.stringify(flat);
}

function restoreStores(stores: Map<EntityCollectionName, DocStore>, snapshot: string): void {
  stores.clear();
  const flat = JSON.parse(snapshot) as Array<
    [EntityCollectionName, Array<[string, Array<[string, Record<string, unknown>]>]>]
  >;
  for (const [coll, tenants] of flat) {
    const ds: DocStore = new Map();
    for (const [t, docs] of tenants) ds.set(t, new Map(docs));
    stores.set(coll, ds);
  }
}
