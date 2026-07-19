/**
 * Durable conversational-runtime authority.
 *
 * All lifecycle changes below are exact-document Firestore transactions.  The
 * repository deliberately owns sequence allocation, leases, idempotent
 * replays, and immutable submission creation so callers never need to compose
 * a read/modify/write protocol themselves.
 */
import {
  type DocumentReference,
  type Firestore,
  type Query,
  type Transaction,
} from "firebase-admin/firestore";
import type {
  ConversationContentBlock,
  ConversationContext,
  ConversationEvidenceDoc,
  ConversationLease,
  ConversationMessage,
  ConversationSessionDoc,
  ConversationSessionKeyDoc,
  ConversationToolInvocation,
  ConversationTurn,
  ConversationTurnDoc,
  ItemSubmissionDoc,
} from "@levelup/domain";
import { canonicalHash, sameCanonical } from "./canonical.js";
import { decodePageCursor, encodePageCursor } from "./cursor.js";
import { makeLeaseConflict, makeRepoError } from "./errors.js";
import { docFromFirestore, toFirestore } from "./firestore.js";
import {
  answerKeyDoc,
  conversationEvidenceDoc,
  conversationEvidencePath,
  conversationMessageDoc,
  conversationMessagesPath,
  conversationSessionDoc,
  conversationSessionKeyDoc,
  conversationSessionKeyId,
  conversationSessionsPath,
  conversationTurnDoc,
  conversationTurnsPath,
  itemSubmissionDoc,
  progressApplicationDoc,
  spaceDoc,
  storyPointDoc,
  tenantCollectionDoc,
  itemDoc,
} from "./paths.js";
import type {
  AbandonConversationInput,
  AcquireFinalizationInput,
  ClaimConversationTurnInput,
  ClaimConversationTurnResult,
  CommitConversationTurnInput,
  CommitConversationTurnResult,
  ConversationListFilter,
  ConversationRepo,
  ConversationSourceVersionCheck,
  FailConversationTurnInput,
  FailConversationTurnResult,
  FinalizationClaim,
  FreezeSubmissionInput,
  FreezeSubmissionResult,
  MarkTurnPhaseInput,
  MessagePageRequest,
  StartConversationTxInput,
  StartConversationTxResult,
} from "./types.js";

type Doc = Record<string, unknown>;

const TERMINAL_SESSION_STATUSES = new Set(["completed", "abandoned"]);
const ACTIVE_SESSION_STATUSES = new Set([
  "active",
  "ready_to_finish",
  "finalizing",
  "grading_pending",
  "grading_failed",
]);
const TURN_RUNNING_STATUSES = new Set(["claimed", "model_running", "tool_running"]);

function readSnapshot<T>(snap: {
  exists: boolean;
  id: string;
  data: () => Doc | undefined;
}): T | null {
  return snap.exists ? (docFromFirestore({ ...(snap.data() ?? {}), id: snap.id }) as T) : null;
}

function write(tx: Transaction, ref: DocumentReference, value: Doc): void {
  // Full replacement is intentional: lifecycle transitions remove expired
  // leases/error fields instead of accidentally retaining them through merge.
  tx.set(ref, toFirestore(value));
}

function isBeforeOrEqual(value: string | undefined, now: string): boolean {
  if (!value) return true;
  const at = Date.parse(value);
  const current = Date.parse(now);
  return !Number.isFinite(at) || !Number.isFinite(current) || at <= current;
}

function assertUsableLease(lease: ConversationLease, now: string): void {
  if (!lease.token || !lease.ownerRequestId || isBeforeOrEqual(lease.expiresAt, now)) {
    throw makeRepoError("VALIDATION_ERROR", "A non-expired workflow lease is required");
  }
}

function assertTurnLease(turn: ConversationTurnDoc, token: string, now: string): void {
  if (!turn.lease || turn.lease.token !== token || isBeforeOrEqual(turn.lease.expiresAt, now)) {
    throw makeRepoError("CONFLICT", "The turn lease no longer belongs to this request");
  }
}

function assertSessionOwner(session: ConversationSessionDoc, ownerUid: string): void {
  if (session.ownerUid !== ownerUid) {
    throw makeRepoError("PERMISSION_DENIED", "Conversation session is owned by another user");
  }
}

function sessionHardLimitReached(session: ConversationSessionDoc): boolean {
  return session.completionRecommendation?.hardLimitReached === true;
}

function completionPolicy(session: ConversationSessionDoc): {
  minLearnerTurns: number;
  maxLearnerTurns: number;
  allowEarlyFinish: boolean;
} | null {
  const policy = session.publicConfig.completionPolicy;
  if (!policy) return null;
  return {
    minLearnerTurns: policy.minLearnerTurns,
    maxLearnerTurns: policy.maxLearnerTurns,
    allowEarlyFinish: policy.allowEarlyFinish,
  };
}

function hardLimitNow(session: ConversationSessionDoc): boolean {
  const policy = completionPolicy(session);
  return (
    session.mode === "agent_assessment" &&
    policy !== null &&
    session.learnerTurnCount >= policy.maxLearnerTurns
  );
}

function simpleModeTurnCap(session: ConversationSessionDoc): number | undefined {
  if (session.mode === "tutor") return 24;
  if (session.mode === "question_help") return 20;
  return undefined;
}

function simpleModeCapReached(session: ConversationSessionDoc): boolean {
  const cap = simpleModeTurnCap(session);
  return cap !== undefined && session.learnerTurnCount >= cap;
}

function learnerSafePreview(content: readonly ConversationContentBlock[]): string | undefined {
  const text = content
    .filter(
      (block): block is Extract<ConversationContentBlock, { type: "text" }> => block.type === "text"
    )
    .map((block) => block.text)
    .join(" ")
    .trim()
    .replace(/\s+/gu, " ");
  return text ? text.slice(0, 160) : undefined;
}

function asSession(value: Doc): ConversationSessionDoc {
  return value as unknown as ConversationSessionDoc;
}

function asTurn(value: Doc): ConversationTurnDoc {
  return value as unknown as ConversationTurnDoc;
}

function asMessage(value: Doc): ConversationMessage {
  return value as unknown as ConversationMessage;
}

function asSubmission(value: Doc): ItemSubmissionDoc {
  return value as unknown as ItemSubmissionDoc;
}

async function readMessagesTx(
  firestore: Firestore,
  tx: Transaction,
  tenantId: string,
  sessionId: string
): Promise<ConversationMessage[]> {
  const snap = await tx.get(
    firestore.collection(conversationMessagesPath(tenantId, sessionId)).orderBy("sequence", "asc")
  );
  return snap.docs.map((doc) => asMessage(docFromFirestore({ ...doc.data(), id: doc.id })));
}

async function readMessages(
  firestore: Firestore,
  tenantId: string,
  sessionId: string
): Promise<ConversationMessage[]> {
  const snap = await firestore
    .collection(conversationMessagesPath(tenantId, sessionId))
    .orderBy("sequence", "asc")
    .get();
  return snap.docs.map((doc) => asMessage(docFromFirestore({ ...doc.data(), id: doc.id })));
}

async function readMessagesByIdsTx(
  firestore: Firestore,
  tx: Transaction,
  tenantId: string,
  sessionId: string,
  ids: readonly string[]
): Promise<ConversationMessage[]> {
  const output: ConversationMessage[] = [];
  for (const id of ids) {
    const snap = await tx.get(firestore.doc(conversationMessageDoc(tenantId, sessionId, id)));
    const message = readSnapshot<ConversationMessage>(snap);
    if (!message) throw makeRepoError("NOT_FOUND", "A persisted conversation message is missing");
    output.push(message);
  }
  return output;
}

function sourcePath(check: ConversationSourceVersionCheck, tenantId: string): string {
  switch (check.resourceType) {
    case "space":
      return spaceDoc(tenantId, check.resourceId);
    case "story_point":
      if (!check.spaceId) {
        throw makeRepoError("VALIDATION_ERROR", "story_point source checks require spaceId");
      }
      return storyPointDoc(tenantId, check.spaceId, check.resourceId);
    case "item":
      if (!check.spaceId || !check.storyPointId) {
        throw makeRepoError(
          "VALIDATION_ERROR",
          "item source checks require spaceId and storyPointId"
        );
      }
      return itemDoc(tenantId, check.spaceId, check.storyPointId, check.resourceId);
    case "agent":
      return tenantCollectionDoc(tenantId, "agents", check.resourceId);
    case "evaluation_settings":
      return tenantCollectionDoc(tenantId, "evaluationSettings", check.resourceId);
    case "rubric":
      return tenantCollectionDoc(tenantId, "rubricPresets", check.resourceId);
    case "answer_key":
      if (!check.spaceId || !check.storyPointId) {
        throw makeRepoError(
          "VALIDATION_ERROR",
          "answer_key source checks require spaceId and storyPointId"
        );
      }
      return answerKeyDoc(tenantId, check.spaceId, check.storyPointId, check.resourceId);
  }
}

async function verifySourceVersions(
  firestore: Firestore,
  tx: Transaction,
  tenantId: string,
  checks: readonly ConversationSourceVersionCheck[]
): Promise<void> {
  for (const check of checks) {
    const snap = await tx.get(firestore.doc(sourcePath(check, tenantId)));
    const data = readSnapshot<Doc>(snap);
    if (!data) {
      throw makeRepoError("CONFLICT", `Frozen ${check.resourceType} source no longer exists`);
    }
    if (check.expectedVersion !== undefined && data["version"] !== check.expectedVersion) {
      throw makeRepoError("CONFLICT", `Frozen ${check.resourceType} version changed`);
    }
    if (check.expectedCanonicalHash !== undefined) {
      const stored = data["canonicalHash"];
      const actual = typeof stored === "string" ? stored : canonicalHash(data);
      if (actual !== check.expectedCanonicalHash) {
        throw makeRepoError("CONFLICT", `Frozen ${check.resourceType} canonical shape changed`);
      }
    }
  }
}

function sourceTupleMatches(
  session: ConversationSessionDoc,
  input: StartConversationTxInput
): boolean {
  return (
    session.tenantId === input.tenantId &&
    session.ownerUid === input.ownerUid &&
    session.clientRequestId === input.clientRequestId &&
    session.mode === input.mode &&
    session.contextBaseKey === input.contextBaseKey
  );
}

function makeContext(input: StartConversationTxInput, attemptNumber: number): ConversationContext {
  if (input.mode !== "agent_assessment") return input.startContext as ConversationContext;
  return { ...input.startContext, attemptNumber } as ConversationContext;
}

function makeSession(
  input: StartConversationTxInput,
  context: ConversationContext,
  contextKey: string,
  opening: ConversationMessage | undefined
): ConversationSessionDoc {
  return asSession({
    schemaVersion: 1,
    id: input.sessionId,
    tenantId: input.tenantId,
    ownerUid: input.ownerUid,
    ...(input.learnerStudentId ? { learnerStudentId: input.learnerStudentId } : {}),
    mode: input.mode,
    context,
    contextBaseKey: input.contextBaseKey,
    contextKey,
    title: input.sessionBase.title,
    locale: input.sessionBase.locale,
    status: "active",
    publicConfig: input.sessionBase.publicConfig,
    configurationSnapshot: input.sessionBase.configurationSnapshot,
    clientRequestId: input.clientRequestId,
    // `nextSequence` is the next allocatable value, not the last committed
    // sequence.  This makes a freeze boundary exactly `nextSequence - 1`.
    nextSequence: opening ? 2 : 1,
    revision: 1,
    learnerTurnCount: 0,
    ...(opening ? { lastMessageAt: opening.completedAt ?? opening.createdAt } : {}),
    createdAt: input.now,
    updatedAt: input.now,
  });
}

function makeOpeningMessage(input: StartConversationTxInput): ConversationMessage | undefined {
  if (!input.openingMessage) return undefined;
  return asMessage({
    id: input.openingMessage.id,
    sessionId: input.sessionId,
    sequence: 1,
    role: "assistant",
    origin: "opening",
    content: input.openingMessage.content,
    deliveryStatus: "complete",
    createdAt: input.now,
    completedAt: input.now,
  });
}

function makeLearnerMessage(
  input: ClaimConversationTurnInput,
  sequence: number
): ConversationMessage {
  return asMessage({
    id: input.learnerMessage.id,
    sessionId: input.sessionId,
    sequence,
    role: "learner",
    origin: "turn",
    turnId: input.turnId,
    clientMessageId: input.clientMessageId,
    content: input.learnerMessage.content,
    deliveryStatus: "accepted",
    createdAt: input.learnerMessage.createdAt,
  });
}

function makeTurn(
  input: ClaimConversationTurnInput,
  session: ConversationSessionDoc
): ConversationTurnDoc {
  return asTurn({
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
  });
}

function usageSum(
  current: ConversationTurnDoc["usageAggregate"],
  incoming: ConversationTurnDoc["usageAggregate"]
): ConversationTurnDoc["usageAggregate"] {
  if (!current && !incoming) return undefined;
  const a = current ?? { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 };
  const b = incoming ?? { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 };
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

function sameAssistantCandidate(
  existing: ConversationMessage,
  candidate: CommitConversationTurnInput["assistantMessages"][number],
  turnId: string
): boolean {
  return sameCanonical(
    {
      role: existing.role,
      origin: existing.origin,
      turnId: existing.turnId,
      content: existing.content,
      createdAt: existing.createdAt,
      completedAt: existing.completedAt,
    },
    {
      role: "assistant",
      origin: "turn",
      turnId,
      content: candidate.content,
      createdAt: candidate.createdAt,
      completedAt: candidate.completedAt,
    }
  );
}

function makeHardLimitRecommendation(session: ConversationSessionDoc, now: string) {
  const current = session.completionRecommendation;
  return {
    reasonCode: "hard_limit" as const,
    coveredPublicObjectiveIds: current?.coveredPublicObjectiveIds ?? [],
    remainingPublicObjectiveIds: current?.remainingPublicObjectiveIds ?? [],
    hardLimitReached: true,
    recommendedAt: now,
  };
}

function samePayload(a: ItemSubmissionDoc["payload"], b: ItemSubmissionDoc["payload"]): boolean {
  return sameCanonical(a, b);
}

export function makeConversationRepo(firestore: Firestore): ConversationRepo {
  return {
    async start(input: StartConversationTxInput): Promise<StartConversationTxResult> {
      const sessionRef = firestore.doc(conversationSessionDoc(input.tenantId, input.sessionId));
      const keyRef = firestore.doc(
        conversationSessionKeyDoc(input.tenantId, input.ownerUid, input.mode, input.contextBaseKey)
      );

      return firestore.runTransaction(async (tx) => {
        // Every transactional read is deliberately before the first write.
        const sessionSnap = await tx.get(sessionRef);
        const keySnap = await tx.get(keyRef);
        const existingSession = readSnapshot<ConversationSessionDoc>(sessionSnap);
        const key = readSnapshot<ConversationSessionKeyDoc>(keySnap);

        if (existingSession) {
          if (!sourceTupleMatches(existingSession, input)) {
            throw makeRepoError(
              "CONFLICT",
              "Deterministic session id was reused with different input"
            );
          }
          const messages = await readMessagesTx(firestore, tx, input.tenantId, input.sessionId);
          return { session: existingSession, messages, resumed: true };
        }

        if (key?.activeSessionId) {
          const activeRef = firestore.doc(
            conversationSessionDoc(input.tenantId, key.activeSessionId)
          );
          const activeSnap = await tx.get(activeRef);
          const active = readSnapshot<ConversationSessionDoc>(activeSnap);
          if (active && ACTIVE_SESSION_STATUSES.has(active.status)) {
            assertSessionOwner(active, input.ownerUid);
            const messages = await readMessagesTx(firestore, tx, input.tenantId, active.id);
            return { session: active, messages, resumed: true };
          }
        }

        await verifySourceVersions(firestore, tx, input.tenantId, input.sourceVersionChecks);
        const attemptNumber = input.mode === "agent_assessment" ? (key?.nextAttemptNumber ?? 1) : 1;
        const context = makeContext(input, attemptNumber);
        const contextKey =
          input.mode === "agent_assessment"
            ? `${input.contextBaseKey}:attempt:${attemptNumber}`
            : input.contextBaseKey;
        const opening = makeOpeningMessage(input);
        const session = makeSession(input, context, contextKey, opening);
        const nextKey = {
          schemaVersion: 1,
          id: conversationSessionKeyId(input.ownerUid, input.mode, input.contextBaseKey),
          tenantId: input.tenantId,
          ownerUid: input.ownerUid,
          mode: input.mode,
          contextBaseKey: input.contextBaseKey,
          activeSessionId: input.sessionId,
          nextAttemptNumber:
            input.mode === "agent_assessment" ? attemptNumber + 1 : (key?.nextAttemptNumber ?? 1),
          revision: (key?.revision ?? 0) + 1,
          updatedAt: input.now,
        } as unknown as ConversationSessionKeyDoc;

        write(tx, sessionRef, session as unknown as Doc);
        write(tx, keyRef, nextKey as unknown as Doc);
        if (opening) {
          write(
            tx,
            firestore.doc(conversationMessageDoc(input.tenantId, input.sessionId, opening.id)),
            opening as unknown as Doc
          );
        }
        return { session, messages: opening ? [opening] : [], resumed: false };
      });
    },

    async getSession(tenantId, sessionId) {
      const snap = await firestore.doc(conversationSessionDoc(tenantId, sessionId)).get();
      return readSnapshot<ConversationSessionDoc>(snap);
    },

    async getTurn(tenantId, sessionId, turnId) {
      const snap = await firestore.doc(conversationTurnDoc(tenantId, sessionId, turnId)).get();
      return readSnapshot<ConversationTurnDoc>(snap);
    },

    async listSessions(tenantId, ownerUid, filter: ConversationListFilter) {
      let query: Query = firestore
        .collection(conversationSessionsPath(tenantId))
        .where("ownerUid", "==", ownerUid);
      if (filter.mode) query = query.where("mode", "==", filter.mode);
      if (filter.contextBaseKey) query = query.where("contextBaseKey", "==", filter.contextBaseKey);
      if (filter.status) query = query.where("status", "==", filter.status);
      query = query.orderBy("updatedAt", "desc").orderBy("__name__", "desc");
      if (filter.cursor) {
        const cursor = decodePageCursor(filter.cursor);
        query = query.startAfter(cursor.v, cursor.id);
      }
      const limit = Math.max(1, Math.min(filter.limit ?? 20, 100));
      const snap = await query.limit(limit + 1).get();
      const docs = snap.docs.slice(0, limit);
      const items = docs.map((doc) => asSession(docFromFirestore({ ...doc.data(), id: doc.id })));
      const last = items[items.length - 1];
      return {
        items,
        nextCursor:
          snap.docs.length > limit && last
            ? encodePageCursor({ v: last.updatedAt, id: String(last.id) })
            : null,
      };
    },

    async listMessages(tenantId, sessionId, page: MessagePageRequest) {
      let query: Query = firestore
        .collection(conversationMessagesPath(tenantId, sessionId))
        .orderBy("sequence", "asc")
        .orderBy("__name__", "asc");
      if (page.cursor) {
        const cursor = decodePageCursor(page.cursor);
        query = query.startAfter(cursor.v, cursor.id);
      }
      const limit = Math.max(1, Math.min(page.limit ?? 50, 200));
      const snap = await query.limit(limit + 1).get();
      const docs = snap.docs.slice(0, limit);
      const items = docs.map((doc) => asMessage(docFromFirestore({ ...doc.data(), id: doc.id })));
      const last = items[items.length - 1];
      return {
        items,
        nextCursor:
          snap.docs.length > limit && last
            ? encodePageCursor({ v: last.sequence, id: String(last.id) })
            : null,
      };
    },

    async listRecoveryCandidates(tenantId, now, limit) {
      const bounded = Math.max(1, Math.min(limit, 100));
      const collection = firestore.collection(conversationSessionsPath(tenantId));
      const [staleTurns, staleFinalizations, hardLimitReady, gradingPending] = await Promise.all([
        collection
          .where("status", "==", "active")
          .where("activeTurnLeaseExpiresAt", "<=", now)
          .orderBy("activeTurnLeaseExpiresAt", "asc")
          .orderBy("__name__", "asc")
          .limit(bounded)
          .get(),
        collection
          .where("status", "==", "finalizing")
          .where("finalization.lease.expiresAt", "<=", now)
          .orderBy("finalization.lease.expiresAt", "asc")
          .orderBy("__name__", "asc")
          .limit(bounded)
          .get(),
        // Hard-limit sessions have no lease field, so this bounded status query
        // is merged in process rather than inventing a broad collection-group scan.
        collection.where("status", "==", "ready_to_finish").limit(bounded).get(),
        // Post-evaluation crash window: a session that froze its submission stays
        // in grading_pending until completeFinalization closes it. If a worker dies
        // after commitEvaluation (submission evaluated) or after applySubmission
        // (progress_applied) but before completeFinalization, neither the stale-turn,
        // stale-finalization, nor submission-retry queries surface it. This bounded
        // single-field status query makes those sessions discoverable so recovery
        // can re-drive the replay-safe submission_replay path. Single-field equality
        // is covered by Firestore's automatic index — no composite index is required
        // (mirrors the ready_to_finish query above).
        collection.where("status", "==", "grading_pending").limit(bounded).get(),
      ]);
      const unique = new Map<string, ConversationSessionDoc>();
      for (const snap of [staleTurns, staleFinalizations, hardLimitReady, gradingPending]) {
        for (const doc of snap.docs) {
          const session = asSession(docFromFirestore({ ...doc.data(), id: doc.id }));
          if (
            session.status !== "ready_to_finish" ||
            session.completionRecommendation?.hardLimitReached === true
          ) {
            unique.set(String(session.id), session);
          }
        }
      }
      return [...unique.values()]
        .sort(
          (a, b) =>
            a.updatedAt.localeCompare(b.updatedAt) || String(a.id).localeCompare(String(b.id))
        )
        .slice(0, bounded);
    },

    async claimTurn(input: ClaimConversationTurnInput): Promise<ClaimConversationTurnResult> {
      assertUsableLease(input.lease, input.now);
      const sessionRef = firestore.doc(conversationSessionDoc(input.tenantId, input.sessionId));
      const turnRef = firestore.doc(
        conversationTurnDoc(input.tenantId, input.sessionId, input.turnId)
      );
      const learnerRef = firestore.doc(
        conversationMessageDoc(input.tenantId, input.sessionId, input.learnerMessage.id)
      );
      return firestore.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        const turnSnap = await tx.get(turnRef);
        const learnerSnap = await tx.get(learnerRef);
        const session = readSnapshot<ConversationSessionDoc>(sessionSnap);
        const turn = readSnapshot<ConversationTurnDoc>(turnSnap);
        const existingLearner = readSnapshot<ConversationMessage>(learnerSnap);
        if (!session) throw makeRepoError("NOT_FOUND", "Conversation session was not found");
        assertSessionOwner(session, input.ownerUid);

        if (turn) {
          if (turn.requestInputHash !== input.requestInputHash) {
            throw makeRepoError("CONFLICT", "clientMessageId was reused with different turn input");
          }
          const learner = existingLearner;
          if (!learner) throw makeRepoError("CONFLICT", "Turn exists without its learner message");
          if (turn.status === "completed") {
            const assistantMessages = await readMessagesByIdsTx(
              firestore,
              tx,
              input.tenantId,
              input.sessionId,
              turn.assistantMessageIds
            );
            return {
              outcome: "completed_replay",
              session,
              turn,
              learnerMessage: learner,
              assistantMessages,
            };
          }
          if (turn.status === "failed_terminal") {
            return {
              outcome: "terminal_replay",
              session,
              turn,
              learnerMessage: learner,
              assistantMessages: [],
            };
          }
          if (
            TURN_RUNNING_STATUSES.has(turn.status) &&
            !isBeforeOrEqual(turn.lease?.expiresAt, input.now)
          ) {
            throw makeLeaseConflict("This turn is already running under an unexpired lease");
          }
          if (turn.status !== "failed_recoverable" && !TURN_RUNNING_STATUSES.has(turn.status)) {
            throw makeRepoError(
              "INVALID_TRANSITION",
              "Turn cannot be reclaimed from its current state"
            );
          }
          const reclaimed = asTurn({
            ...turn,
            status: "claimed",
            attemptCount: turn.attemptCount + 1,
            lease: input.lease,
            modelRequestIds: [],
            assistantMessageIds: [],
            error: undefined,
            claimedAt: input.now,
            updatedAt: input.now,
          });
          const nextSession = asSession({
            ...session,
            status: "active",
            activeTurnId: input.turnId,
            activeTurnLeaseExpiresAt: input.lease.expiresAt,
            revision: session.revision + 1,
            updatedAt: input.now,
          });
          write(tx, turnRef, reclaimed as unknown as Doc);
          write(tx, sessionRef, nextSession as unknown as Doc);
          return {
            outcome: "reclaimed",
            session: nextSession,
            turn: reclaimed,
            learnerMessage: learner,
            assistantMessages: [],
          };
        }

        if (existingLearner) {
          throw makeRepoError("CONFLICT", "Learner message id is already used by another turn");
        }
        if (session.status !== "active" && session.status !== "ready_to_finish") {
          throw makeRepoError("INVALID_TRANSITION", "Session is not accepting turns");
        }
        if (
          sessionHardLimitReached(session) ||
          hardLimitNow(session) ||
          simpleModeCapReached(session)
        ) {
          throw makeRepoError("INVALID_TRANSITION", "The assessment turn limit has been reached");
        }
        if (
          session.activeTurnId &&
          session.activeTurnId !== input.turnId &&
          !isBeforeOrEqual(session.activeTurnLeaseExpiresAt, input.now)
        ) {
          throw makeRepoError("CONFLICT", "A different turn currently owns the session");
        }

        const learner = makeLearnerMessage(input, session.nextSequence);
        const createdTurn = makeTurn(input, session);
        const nextSession = asSession({
          ...session,
          status: "active",
          nextSequence: learner.sequence + 1,
          learnerTurnCount: session.learnerTurnCount + 1,
          activeTurnId: input.turnId,
          activeTurnLeaseExpiresAt: input.lease.expiresAt,
          lastMessageAt: learner.createdAt,
          revision: session.revision + 1,
          updatedAt: input.now,
        });
        write(tx, turnRef, createdTurn as unknown as Doc);
        write(tx, learnerRef, learner as unknown as Doc);
        write(tx, sessionRef, nextSession as unknown as Doc);
        return {
          outcome: "claimed",
          session: nextSession,
          turn: createdTurn,
          learnerMessage: learner,
          assistantMessages: [],
        };
      });
    },

    async markTurnPhase(input: MarkTurnPhaseInput): Promise<ConversationTurn> {
      const turnRef = firestore.doc(
        conversationTurnDoc(input.tenantId, input.sessionId, input.turnId)
      );
      return firestore.runTransaction(async (tx) => {
        const turnSnap = await tx.get(turnRef);
        const turn = readSnapshot<ConversationTurnDoc>(turnSnap);
        if (!turn) throw makeRepoError("NOT_FOUND", "Conversation turn was not found");
        assertTurnLease(turn, input.leaseToken, input.now);
        // LLD §9.4/§10.2: phases only move FORWARD (never back to `claimed`, never
        // re-enter from a terminal/committed turn), but a SAME-phase re-mark is a
        // valid incremental update — the runtime re-marks `model_running` after a
        // generate to attach its modelRequestId, and re-marks `tool_running` once
        // per executed tool to persist each deterministic invocation. Forbidding
        // those self-transitions wrongly failed the first tool-calling turn with
        // INVALID_TRANSITION (CONV-P0: latent until a parseable model emitted tools).
        const valid =
          (input.status === "model_running" &&
            (turn.status === "claimed" ||
              turn.status === "model_running" ||
              turn.status === "tool_running")) ||
          (input.status === "tool_running" &&
            (turn.status === "model_running" || turn.status === "tool_running"));
        if (!valid) throw makeRepoError("INVALID_TRANSITION", "Turn phase cannot move backwards");

        const toolInvocations = [...turn.toolInvocations];
        if (input.toolInvocation) {
          const index = toolInvocations.findIndex((value) => value.id === input.toolInvocation?.id);
          if (index >= 0 && !sameCanonical(toolInvocations[index], input.toolInvocation)) {
            throw makeRepoError("CONFLICT", "Tool invocation id was reused with different content");
          }
          if (index < 0) toolInvocations.push(input.toolInvocation);
        }
        const next = asTurn({
          ...turn,
          status: input.status,
          modelRequestIds: input.modelRequestId
            ? [...new Set([...turn.modelRequestIds, input.modelRequestId])]
            : turn.modelRequestIds,
          toolInvocations,
          usageAggregate: usageSum(turn.usageAggregate, input.usageDelta),
          updatedAt: input.now,
        });
        write(tx, turnRef, next as unknown as Doc);
        return next as ConversationTurn;
      });
    },

    async commitTurn(input: CommitConversationTurnInput): Promise<CommitConversationTurnResult> {
      const sessionRef = firestore.doc(conversationSessionDoc(input.tenantId, input.sessionId));
      const turnRef = firestore.doc(
        conversationTurnDoc(input.tenantId, input.sessionId, input.turnId)
      );
      return firestore.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        const turnSnap = await tx.get(turnRef);
        const session = readSnapshot<ConversationSessionDoc>(sessionSnap);
        const turn = readSnapshot<ConversationTurnDoc>(turnSnap);
        if (!session || !turn)
          throw makeRepoError("NOT_FOUND", "Conversation session or turn was not found");
        const keyRef = firestore.doc(
          conversationSessionKeyDoc(
            input.tenantId,
            session.ownerUid,
            session.mode,
            session.contextBaseKey
          )
        );
        const keySnap = await tx.get(keyRef);
        const key = readSnapshot<ConversationSessionKeyDoc>(keySnap);

        const existingAssistantById = new Map<string, ConversationMessage>();
        for (const candidate of input.assistantMessages) {
          const snap = await tx.get(
            firestore.doc(conversationMessageDoc(input.tenantId, input.sessionId, candidate.id))
          );
          const message = readSnapshot<ConversationMessage>(snap);
          if (message) existingAssistantById.set(String(candidate.id), message);
        }
        const allMessages = await readMessagesTx(firestore, tx, input.tenantId, input.sessionId);
        const evidenceExisting = new Map<string, ConversationEvidenceDoc>();
        for (const evidence of input.evidence) {
          const snap = await tx.get(
            firestore.doc(conversationEvidenceDoc(input.tenantId, input.sessionId, evidence.id))
          );
          const existing = readSnapshot<ConversationEvidenceDoc>(snap);
          if (existing) evidenceExisting.set(String(evidence.id), existing);
        }

        if (turn.status === "completed") {
          const assistantMessages = await readMessagesByIdsTx(
            firestore,
            tx,
            input.tenantId,
            input.sessionId,
            turn.assistantMessageIds
          );
          if (
            assistantMessages.length !== input.assistantMessages.length ||
            input.assistantMessages.some((candidate) => {
              const stored = assistantMessages.find((message) => message.id === candidate.id);
              return !stored || !sameAssistantCandidate(stored, candidate, String(input.turnId));
            })
          ) {
            throw makeRepoError(
              "CONFLICT",
              "Completed turn was replayed with different assistant output"
            );
          }
          return { session, turn, assistantMessages, hardLimitAutoFinalize: hardLimitNow(session) };
        }

        if (session.activeTurnId !== input.turnId || session.status === "finalizing") {
          throw makeRepoError(
            "INVALID_TRANSITION",
            "Turn no longer owns an active, non-finalizing session"
          );
        }
        assertTurnLease(turn, input.leaseToken, input.now);
        if (!TURN_RUNNING_STATUSES.has(turn.status)) {
          throw makeRepoError("INVALID_TRANSITION", "Only a running turn can be committed");
        }
        if (
          input.configurationFingerprint !== session.configurationSnapshot.fingerprint ||
          input.configurationFingerprint !== turn.configurationFingerprint
        ) {
          throw makeRepoError(
            "CONFLICT",
            "Turn configuration fingerprint does not match the frozen session"
          );
        }

        const learner = allMessages.find((message) => message.id === turn.learnerMessageId);
        if (!learner || learner.role !== "learner") {
          throw makeRepoError("CONFLICT", "Turn learner message is missing");
        }
        const validLearnerSequences = new Set(
          allMessages
            .filter((message) => message.role === "learner" && message.sequence <= learner.sequence)
            .map((message) => message.sequence)
        );
        for (const evidence of input.evidence) {
          if (
            evidence.tenantId !== input.tenantId ||
            evidence.sessionId !== input.sessionId ||
            evidence.turnId !== input.turnId ||
            evidence.recorder.configurationFingerprint !== input.configurationFingerprint ||
            evidence.messageSequences.some((sequence) => !validLearnerSequences.has(sequence))
          ) {
            throw makeRepoError(
              "VALIDATION_ERROR",
              "Evidence is outside the committed turn's validated scope"
            );
          }
          const existing = evidenceExisting.get(String(evidence.id));
          if (existing && !sameCanonical(existing, evidence)) {
            throw makeRepoError("CONFLICT", "Evidence id was reused with different content");
          }
        }

        let nextSequence = session.nextSequence;
        const assistantMessages: ConversationMessage[] = [];
        const messageWrites: ConversationMessage[] = [];
        const seenIds = new Set<string>();
        for (const candidate of input.assistantMessages) {
          if (seenIds.has(String(candidate.id))) {
            throw makeRepoError(
              "VALIDATION_ERROR",
              "Assistant message ids must be unique within a turn"
            );
          }
          seenIds.add(String(candidate.id));
          const existing = existingAssistantById.get(String(candidate.id));
          if (existing) {
            if (!sameAssistantCandidate(existing, candidate, String(input.turnId))) {
              throw makeRepoError(
                "CONFLICT",
                "Assistant message id was reused with different content"
              );
            }
            assistantMessages.push(existing);
            continue;
          }
          const message = asMessage({
            id: candidate.id,
            sessionId: input.sessionId,
            sequence: nextSequence,
            role: "assistant",
            origin: "turn",
            turnId: input.turnId,
            content: candidate.content,
            deliveryStatus: "complete",
            createdAt: candidate.createdAt,
            completedAt: candidate.completedAt,
          });
          assistantMessages.push(message);
          messageWrites.push(message);
          nextSequence += 1;
        }
        const hardLimit = hardLimitNow(session);
        const simpleCap = simpleModeCapReached(session);
        const recommendation = hardLimit
          ? makeHardLimitRecommendation(session, input.now)
          : input.completionRecommendation;
        const latestAssistant = assistantMessages[assistantMessages.length - 1];
        const nextSession = asSession({
          ...session,
          status: simpleCap ? "completed" : recommendation ? "ready_to_finish" : "active",
          nextSequence,
          activeTurnId: undefined,
          activeTurnLeaseExpiresAt: undefined,
          completionRecommendation: recommendation,
          lastMessageAt: latestAssistant?.completedAt ?? session.lastMessageAt,
          lastMessagePreview:
            (latestAssistant ? learnerSafePreview(latestAssistant.content) : undefined) ??
            session.lastMessagePreview,
          revision: session.revision + 1,
          updatedAt: input.now,
          completedAt: simpleCap ? input.now : undefined,
        });
        const nextTurn = asTurn({
          ...turn,
          status: "completed",
          lease: undefined,
          modelRequestIds: [...new Set(input.modelRequestIds)],
          assistantMessageIds: assistantMessages.map((message) => message.id),
          usageAggregate: input.usageAggregate,
          error: undefined,
          completedAt: input.now,
          updatedAt: input.now,
        });

        write(tx, sessionRef, nextSession as unknown as Doc);
        write(tx, turnRef, nextTurn as unknown as Doc);
        for (const message of messageWrites) {
          write(
            tx,
            firestore.doc(conversationMessageDoc(input.tenantId, input.sessionId, message.id)),
            message as unknown as Doc
          );
        }
        for (const evidence of input.evidence) {
          if (!evidenceExisting.has(String(evidence.id))) {
            write(
              tx,
              firestore.doc(conversationEvidenceDoc(input.tenantId, input.sessionId, evidence.id)),
              evidence as unknown as Doc
            );
          }
        }
        if (simpleCap && key?.activeSessionId === session.id) {
          write(tx, keyRef, {
            ...key,
            activeSessionId: undefined,
            revision: key.revision + 1,
            updatedAt: input.now,
          });
        }
        return {
          session: nextSession,
          turn: nextTurn,
          assistantMessages,
          hardLimitAutoFinalize: hardLimit,
        };
      });
    },

    async failTurn(input: FailConversationTurnInput): Promise<FailConversationTurnResult> {
      const sessionRef = firestore.doc(conversationSessionDoc(input.tenantId, input.sessionId));
      const turnRef = firestore.doc(
        conversationTurnDoc(input.tenantId, input.sessionId, input.turnId)
      );
      return firestore.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        const turnSnap = await tx.get(turnRef);
        const session = readSnapshot<ConversationSessionDoc>(sessionSnap);
        const turn = readSnapshot<ConversationTurnDoc>(turnSnap);
        if (!session || !turn)
          throw makeRepoError("NOT_FOUND", "Conversation session or turn was not found");
        const learnerRef = firestore.doc(
          conversationMessageDoc(input.tenantId, input.sessionId, turn.learnerMessageId)
        );
        const keyRef = firestore.doc(
          conversationSessionKeyDoc(
            input.tenantId,
            session.ownerUid,
            session.mode,
            session.contextBaseKey
          )
        );
        const learnerSnap = await tx.get(learnerRef);
        const keySnap = await tx.get(keyRef);
        const learner = readSnapshot<ConversationMessage>(learnerSnap);
        const key = readSnapshot<ConversationSessionKeyDoc>(keySnap);
        assertTurnLease(turn, input.leaseToken, input.now);
        if (!TURN_RUNNING_STATUSES.has(turn.status)) {
          throw makeRepoError("INVALID_TRANSITION", "Only a running turn can fail");
        }

        const hardLimit = input.terminal && hardLimitNow(session);
        const simpleCap = input.terminal && simpleModeCapReached(session);
        const nextTurn = asTurn({
          ...turn,
          status: input.terminal ? "failed_terminal" : "failed_recoverable",
          lease: undefined,
          error: input.error,
          completedAt: input.terminal ? input.now : undefined,
          updatedAt: input.now,
        });
        const ownsActive = session.activeTurnId === input.turnId;
        const nextSession = asSession({
          ...session,
          status: simpleCap
            ? "completed"
            : hardLimit
              ? "ready_to_finish"
              : session.status === "ready_to_finish"
                ? "ready_to_finish"
                : "active",
          activeTurnId: ownsActive ? undefined : session.activeTurnId,
          activeTurnLeaseExpiresAt: ownsActive ? undefined : session.activeTurnLeaseExpiresAt,
          completionRecommendation: hardLimit
            ? makeHardLimitRecommendation(session, input.now)
            : session.completionRecommendation,
          lastMessagePreview: learner
            ? (learnerSafePreview(learner.content) ?? session.lastMessagePreview)
            : session.lastMessagePreview,
          revision: ownsActive || hardLimit || simpleCap ? session.revision + 1 : session.revision,
          updatedAt: ownsActive || hardLimit || simpleCap ? input.now : session.updatedAt,
          completedAt: simpleCap ? input.now : undefined,
        });
        write(tx, turnRef, nextTurn as unknown as Doc);
        if (ownsActive || hardLimit || simpleCap)
          write(tx, sessionRef, nextSession as unknown as Doc);
        if (simpleCap && key?.activeSessionId === session.id) {
          write(tx, keyRef, {
            ...key,
            activeSessionId: undefined,
            revision: key.revision + 1,
            updatedAt: input.now,
          });
        }
        return { session: nextSession, turn: nextTurn, hardLimitAutoFinalize: hardLimit };
      });
    },

    async acquireFinalization(input: AcquireFinalizationInput): Promise<FinalizationClaim> {
      assertUsableLease(input.lease, input.now);
      const sessionRef = firestore.doc(conversationSessionDoc(input.tenantId, input.sessionId));
      return firestore.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        const session = readSnapshot<ConversationSessionDoc>(sessionSnap);
        if (!session) throw makeRepoError("NOT_FOUND", "Conversation session was not found");
        if (input.source === "learner") assertSessionOwner(session, input.ownerUid);
        const submissionRef = session.finalization?.submissionId
          ? firestore.doc(itemSubmissionDoc(input.tenantId, session.finalization.submissionId))
          : undefined;
        const submissionSnap = submissionRef ? await tx.get(submissionRef) : undefined;
        const submission = submissionSnap ? readSnapshot<ItemSubmissionDoc>(submissionSnap) : null;

        // Tutor and question-help have no immutable assessment submission.  A
        // Finish call closes them under this same port so callers never need a
        // separate mutable-session close path.
        if (session.mode !== "agent_assessment") {
          if (session.status === "completed") {
            return {
              outcome: "completed_replay",
              session,
              frozenThroughSequence: 0,
              frozenRevision: session.revision,
            };
          }
          if (session.activeTurnId) {
            throw makeRepoError(
              "INVALID_TRANSITION",
              "An active turn must finish before closing a conversation"
            );
          }
          if (session.status !== "active" && session.status !== "ready_to_finish") {
            throw makeRepoError(
              "INVALID_TRANSITION",
              "Conversation cannot be closed from its current state"
            );
          }
          const keyRef = firestore.doc(
            conversationSessionKeyDoc(
              input.tenantId,
              session.ownerUid,
              session.mode,
              session.contextBaseKey
            )
          );
          const keySnap = await tx.get(keyRef);
          const key = readSnapshot<ConversationSessionKeyDoc>(keySnap);
          const completed = asSession({
            ...session,
            status: "completed",
            activeTurnId: undefined,
            activeTurnLeaseExpiresAt: undefined,
            revision: session.revision + 1,
            updatedAt: input.now,
            completedAt: input.now,
          });
          write(tx, sessionRef, completed as unknown as Doc);
          if (key?.activeSessionId === session.id) {
            write(tx, keyRef, {
              ...key,
              activeSessionId: undefined,
              revision: key.revision + 1,
              updatedAt: input.now,
            });
          }
          return {
            outcome: "completed_replay",
            session: completed,
            frozenThroughSequence: 0,
            frozenRevision: completed.revision,
          };
        }

        const frozenThroughSequence =
          session.finalization?.frozenThroughSequence ?? Math.max(0, session.nextSequence - 1);
        const frozenRevision = session.finalization?.frozenRevision ?? session.revision;
        if (session.status === "completed" || session.safeResult) {
          return {
            outcome: "completed_replay",
            session,
            frozenThroughSequence,
            frozenRevision,
            submission: submission ?? undefined,
          };
        }
        if (submission) {
          return {
            outcome: "submission_replay",
            session,
            frozenThroughSequence,
            frozenRevision,
            submission,
          };
        }
        const priorLease = session.finalization?.lease;
        if (
          session.status === "finalizing" &&
          priorLease &&
          !isBeforeOrEqual(priorLease.expiresAt, input.now)
        ) {
          if (priorLease.ownerRequestId !== input.ownerRequestId) {
            throw makeLeaseConflict("Another request is finalizing this conversation");
          }
          return { outcome: "claimed", session, frozenThroughSequence, frozenRevision };
        }
        if (session.activeTurnId && !isBeforeOrEqual(session.activeTurnLeaseExpiresAt, input.now)) {
          throw makeRepoError(
            "INVALID_TRANSITION",
            "An active turn must finish before finalization"
          );
        }
        if (
          session.status !== "active" &&
          session.status !== "ready_to_finish" &&
          session.status !== "finalizing"
        ) {
          throw makeRepoError(
            "INVALID_TRANSITION",
            "Session cannot enter finalization from its current state"
          );
        }
        const policy = completionPolicy(session);
        if (
          input.source === "learner" &&
          policy &&
          session.learnerTurnCount < policy.minLearnerTurns
        ) {
          if (!policy.allowEarlyFinish || input.earlyFinishConfirmed !== true) {
            throw makeRepoError(
              "PRECONDITION_FAILED",
              "Early finish requires confirmation after minimum turns"
            );
          }
        }
        if (input.source === "hard_limit" && !sessionHardLimitReached(session)) {
          throw makeRepoError(
            "PRECONDITION_FAILED",
            "Hard-limit finalization requires a hard-limit recommendation"
          );
        }
        if (input.source === "recovery" && session.status !== "finalizing") {
          throw makeRepoError(
            "INVALID_TRANSITION",
            "Recovery only reclaims an existing finalization"
          );
        }
        const requestedReason =
          input.source === "hard_limit"
            ? "hard_limit"
            : (session.finalization?.requestedReason ?? "learner_requested");
        const nextSession = asSession({
          ...session,
          status: "finalizing",
          finalization: {
            ...session.finalization,
            lease: input.lease,
            frozenThroughSequence: Math.max(0, session.nextSequence - 1),
            frozenRevision: session.revision + 1,
            requestedReason,
            ...(input.source === "learner"
              ? { earlyFinishConfirmed: input.earlyFinishConfirmed === true }
              : {}),
            startedAt: input.now,
          },
          revision: session.revision + 1,
          updatedAt: input.now,
        });
        write(tx, sessionRef, nextSession as unknown as Doc);
        return {
          outcome: "claimed",
          session: nextSession,
          frozenThroughSequence:
            nextSession.finalization?.frozenThroughSequence ??
            Math.max(0, nextSession.nextSequence - 1),
          frozenRevision: nextSession.finalization?.frozenRevision ?? nextSession.revision,
        };
      });
    },

    async freezeSubmission(input: FreezeSubmissionInput): Promise<FreezeSubmissionResult> {
      const sessionRef = firestore.doc(conversationSessionDoc(input.tenantId, input.sessionId));
      const requestedSubmissionRef = firestore.doc(
        itemSubmissionDoc(input.tenantId, input.submissionId)
      );
      return firestore.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        const submissionSnap = await tx.get(requestedSubmissionRef);
        const session = readSnapshot<ConversationSessionDoc>(sessionSnap);
        const existing = readSnapshot<ItemSubmissionDoc>(submissionSnap);
        if (!session) throw makeRepoError("NOT_FOUND", "Conversation session was not found");
        const lease = session.finalization?.lease;
        if (
          session.status !== "finalizing" ||
          !lease ||
          lease.token !== input.finalizationLeaseToken ||
          isBeforeOrEqual(lease.expiresAt, input.now)
        ) {
          throw makeRepoError("CONFLICT", "Finalization lease no longer owns this session");
        }
        if (session.mode !== "agent_assessment" || session.context.kind !== "agent_assessment") {
          throw makeRepoError(
            "INVALID_TRANSITION",
            "Only assessment conversations can create submissions"
          );
        }
        if (
          input.payload.frozenThroughSequence !== session.finalization?.frozenThroughSequence ||
          input.payload.configurationFingerprint !== session.configurationSnapshot.fingerprint ||
          !sameCanonical(input.payload.configurationSnapshot, session.configurationSnapshot)
        ) {
          throw makeRepoError(
            "CONFLICT",
            "Submission payload does not match the frozen conversation"
          );
        }
        if (existing) {
          if (
            existing.sessionId !== input.sessionId ||
            existing.ownerUid !== session.ownerUid ||
            !samePayload(existing.payload, input.payload)
          ) {
            throw makeRepoError(
              "CONFLICT",
              "Submission id already has a different immutable payload"
            );
          }
          return { session, submission: existing, replayed: true };
        }
        const submission = asSubmission({
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
          workflow: {
            status: "frozen",
            evaluationAttemptCount: 0,
          },
          createdAt: input.now,
          updatedAt: input.now,
        });
        const nextSession = asSession({
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
        });
        write(tx, requestedSubmissionRef, submission as unknown as Doc);
        write(tx, sessionRef, nextSession as unknown as Doc);
        return { session: nextSession, submission, replayed: false };
      });
    },

    async completeFinalization(input) {
      const sessionRef = firestore.doc(conversationSessionDoc(input.tenantId, input.sessionId));
      const submissionRef = firestore.doc(itemSubmissionDoc(input.tenantId, input.submissionId));
      return firestore.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        const submissionSnap = await tx.get(submissionRef);
        const session = readSnapshot<ConversationSessionDoc>(sessionSnap);
        const submission = readSnapshot<ItemSubmissionDoc>(submissionSnap);
        if (!session || !submission) {
          throw makeRepoError(
            "NOT_FOUND",
            "Conversation session or immutable submission was not found"
          );
        }
        const markerRef = firestore.doc(
          progressApplicationDoc(
            input.tenantId,
            submission.ownerUid,
            submission.spaceId,
            input.submissionId
          )
        );
        const keyRef = firestore.doc(
          conversationSessionKeyDoc(
            input.tenantId,
            session.ownerUid,
            session.mode,
            session.contextBaseKey
          )
        );
        const markerSnap = await tx.get(markerRef);
        const keySnap = await tx.get(keyRef);
        const marker = readSnapshot<Doc>(markerSnap);
        const key = readSnapshot<ConversationSessionKeyDoc>(keySnap);
        const finalization = session.finalization;

        if (session.status === "completed" || session.safeResult) {
          if (session.safeResult?.submissionId !== input.submissionId) {
            throw makeRepoError("CONFLICT", "Completed session is bound to a different submission");
          }
          return { session, replayed: true };
        }
        if (
          session.mode !== "agent_assessment" ||
          finalization?.submissionId !== input.submissionId ||
          finalization.frozenRevision !== input.expectedFrozenRevision ||
          finalization.transcriptHash !== input.expectedTranscriptHash ||
          submission.sessionId !== input.sessionId ||
          submission.tenantId !== input.tenantId ||
          !submission.evaluation ||
          submission.workflow.status !== "progress_applied" ||
          !marker ||
          marker["submissionId"] !== input.submissionId ||
          marker["evaluationResultHash"] !== submission.evaluation.resultHash
        ) {
          throw makeRepoError(
            "CONFLICT",
            "Finalization bindings, evaluation, or progress marker do not match"
          );
        }
        const completed = asSession({
          ...session,
          status: "completed",
          activeTurnId: undefined,
          activeTurnLeaseExpiresAt: undefined,
          finalization: {
            ...finalization,
            lease: undefined,
            completedAt: input.now,
          },
          safeResult: {
            submissionId: input.submissionId,
            evaluation: submission.evaluation.safeResult,
            progressApplied: true,
          },
          revision: session.revision + 1,
          updatedAt: input.now,
          completedAt: input.now,
        });
        write(tx, sessionRef, completed as unknown as Doc);
        if (key?.activeSessionId === session.id) {
          write(tx, keyRef, {
            ...key,
            activeSessionId: undefined,
            revision: key.revision + 1,
            updatedAt: input.now,
          });
        }
        return { session: completed, replayed: false };
      });
    },

    async abandon(input: AbandonConversationInput) {
      const sessionRef = firestore.doc(conversationSessionDoc(input.tenantId, input.sessionId));
      return firestore.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        const session = readSnapshot<ConversationSessionDoc>(sessionSnap);
        if (!session) throw makeRepoError("NOT_FOUND", "Conversation session was not found");
        assertSessionOwner(session, input.ownerUid);
        if (session.clientRequestId !== input.clientRequestId) {
          throw makeRepoError("CONFLICT", "Session id was reused with a different start request");
        }
        if (session.status === "abandoned") return { session, replayed: true };
        if (session.status === "completed") {
          throw makeRepoError("INVALID_TRANSITION", "A completed conversation cannot be abandoned");
        }
        if (
          session.activeTurnId ||
          session.status === "finalizing" ||
          session.status === "grading_pending"
        ) {
          throw makeRepoError(
            "INVALID_TRANSITION",
            "An active or finalizing conversation cannot be abandoned"
          );
        }
        const keyRef = firestore.doc(
          conversationSessionKeyDoc(
            input.tenantId,
            session.ownerUid,
            session.mode,
            session.contextBaseKey
          )
        );
        const keySnap = await tx.get(keyRef);
        const key = readSnapshot<ConversationSessionKeyDoc>(keySnap);
        const nextSession = asSession({
          ...session,
          status: "abandoned",
          abandonedAt: input.now,
          revision: session.revision + 1,
          updatedAt: input.now,
        });
        write(tx, sessionRef, nextSession as unknown as Doc);
        if (key?.activeSessionId === session.id) {
          write(tx, keyRef, {
            ...key,
            activeSessionId: undefined,
            revision: key.revision + 1,
            updatedAt: input.now,
          });
        }
        return { session: nextSession, replayed: false };
      });
    },
  };
}

/** Kept exported for focused unit tests that assert persisted message ordering. */
export { readMessages };
