import { createHash } from "node:crypto";

/**
 * Tenant-scoped Firestore path builders — the ONLY place collection paths live
 * (server-shared.md §5.1). Resolves the dual item-path drift (REVIEW D1) to ONE
 * canonical nested item path: the rest of the system is path-agnostic.
 *
 * Canonical paths:
 *   tenants/{t}
 *   tenants/{t}/spaces/{spaceId}
 *   tenants/{t}/spaces/{spaceId}/storyPoints/{storyPointId}
 *   tenants/{t}/spaces/{spaceId}/storyPoints/{spId}/items/{itemId}      ← D1 single canonical
 *   …/items/{itemId}/answerKey/key                                      ← ⚷ deny-all subcollection
 *   tenants/{t}/spaceProgress/{userId}_{spaceId}                        ← D14 canonical (keyed userId)
 *   …/spaceProgress/{userId}_{spaceId}/live                            ← slim realtime projection
 *   tenants/{t}/idempotency/{uid}_{key}
 *   tenants/{t}/outbox/{id}
 *   tenants/{t}/audit/{id}
 *
 * A document id alone is insufficient for nested collections (items). The entity
 * docs carry the parent ids (`spaceId`, `storyPointId`) so a collection-group
 * read can resolve the full path; for direct gets the caller passes the ids.
 */

/**
 * The env-driven top-level collection prefix (Student-Vertical, Slice A). Default
 * `''` → ZERO behaviour change (emulator/dev). When set (e.g. `v2_`) it prefixes
 * ONLY top-level collection NAMES; tenant-scoped subcollections inherit it via the
 * prefixed `tenants` root (they are NOT double-prefixed). MUST stay mirrored with
 * `@levelup/seed` `engine/paths.ts`.
 */
export function collectionPrefix(): string {
  return process.env["LVLUP_COLLECTION_PREFIX"] ?? "";
}

/** Prefix a top-level collection name (the first path segment only). */
export function topLevel(name: string): string {
  return `${collectionPrefix()}${name}`;
}

/** Reserved platform-tenant sentinel + its top-level audit collection (Firestore rejects `tenants/__platform__/…`). */
const PLATFORM_TENANT = "__platform__";

/** Top-level `tenants` root — prefixed; every tenant-scoped path inherits via this. */
export function tenantsRoot(): string {
  return topLevel("tenants");
}

export function tenantDoc(tenantId: string): string {
  return `${tenantsRoot()}/${tenantId}`;
}

/** Flat tenant-scoped collection (spaces, students, exams, …). */
export function tenantCollection(tenantId: string, collection: string): string {
  return `${tenantDoc(tenantId)}/${collection}`;
}

export function tenantCollectionDoc(tenantId: string, collection: string, id: string): string {
  return `${tenantCollection(tenantId, collection)}/${id}`;
}

// --- content nesting (D1) -------------------------------------------------

export function spacesPath(tenantId: string): string {
  return tenantCollection(tenantId, "spaces");
}

export function spaceDoc(tenantId: string, spaceId: string): string {
  return `${spacesPath(tenantId)}/${spaceId}`;
}

export function storyPointsPath(tenantId: string, spaceId: string): string {
  return `${spaceDoc(tenantId, spaceId)}/storyPoints`;
}

export function storyPointDoc(tenantId: string, spaceId: string, storyPointId: string): string {
  return `${storyPointsPath(tenantId, spaceId)}/${storyPointId}`;
}

/** The single canonical nested items collection (D1). */
export function itemsPath(tenantId: string, spaceId: string, storyPointId: string): string {
  return `${storyPointDoc(tenantId, spaceId, storyPointId)}/items`;
}

export function itemDoc(
  tenantId: string,
  spaceId: string,
  storyPointId: string,
  itemId: string
): string {
  return `${itemsPath(tenantId, spaceId, storyPointId)}/${itemId}`;
}

/** Collection-group id used to resolve an item by id alone (`listItems`/`getItem`). */
export const ITEMS_COLLECTION_GROUP = "items";

/**
 * Server-only answer-key document under an item (⚷ §6.4). Stored as a fixed
 * single-doc subcollection so rules can `read,write:if false` the whole path.
 */
export function answerKeyDoc(
  tenantId: string,
  spaceId: string,
  storyPointId: string,
  itemId: string
): string {
  // The deny-all answer-key subcollection is `answerKeys` (plural) — the SAME
  // path the seed engine + the rules layer use. We use a STABLE doc id (the
  // itemId) so a service write is upsert-idempotent (one key doc per item).
  return `${itemDoc(tenantId, spaceId, storyPointId, itemId)}/answerKeys/${itemId}`;
}

/** The `answerKeys` collection-group name (deny-all subcollection, §6.4). */
export const ANSWER_KEYS_COLLECTION_GROUP = "answerKeys";

/** B2C store reviews — one doc per reviewer, keyed by uid (`spaces/{s}/reviews/{uid}`). */
export function spaceReviewsPath(tenantId: string, spaceId: string): string {
  return `${spaceDoc(tenantId, spaceId)}/reviews`;
}

export function spaceReviewDoc(tenantId: string, spaceId: string, uid: string): string {
  return `${spaceReviewsPath(tenantId, spaceId)}/${uid}`;
}

/** ContentVersion change-log — legacy-compatible `spaces/{s}/versions` subcollection. */
export function spaceVersionsPath(tenantId: string, spaceId: string): string {
  return `${spaceDoc(tenantId, spaceId)}/versions`;
}

// --- progress (D14 canonical: keyed userId) -------------------------------

export function spaceProgressId(userId: string, spaceId: string): string {
  return `${userId}_${spaceId}`;
}

export function spaceProgressDoc(tenantId: string, userId: string, spaceId: string): string {
  return `${tenantCollection(tenantId, "spaceProgress")}/${spaceProgressId(userId, spaceId)}`;
}

// (the `/projection/live` Firestore doc is retired — AD-12: the spaceProgressLive
// realtime channel is an RTDB projection written via `levelupProjections`)

export function storyPointProgressDoc(
  tenantId: string,
  userId: string,
  spaceId: string,
  storyPointId: string
): string {
  return `${spaceProgressDoc(tenantId, userId, spaceId)}/storyPointProgress/${storyPointId}`;
}

// --- conversational runtime (callable/Admin SDK only) --------------------

/**
 * `conversationSessions/{sessionId}` under the prefix-aware tenant root.
 * Runtime records deliberately inherit the root prefix through `tenantDoc()`;
 * subcollection names themselves are never prefixed.
 */
export function conversationSessionsPath(tenantId: string): string {
  return tenantCollection(tenantId, "conversationSessions");
}

export function conversationSessionDoc(tenantId: string, sessionId: string): string {
  return `${conversationSessionsPath(tenantId)}/${sessionId}`;
}

export function conversationSessionKeysPath(tenantId: string): string {
  return tenantCollection(tenantId, "conversationSessionKeys");
}

/**
 * The session-key document is the concurrency authority for one owner/mode/
 * context-base tuple. Keep its identity opaque and delimiter-safe: source
 * values may themselves contain `:` or other readable separators.
 */
export function conversationSessionKeyId(
  ownerUid: string,
  mode: string,
  contextBaseKey: string
): string {
  const source = JSON.stringify([ownerUid, mode, contextBaseKey]);
  return `csk_${createHash("sha256").update(source).digest("base64url").slice(0, 26)}`;
}

export function conversationSessionKeyDoc(
  tenantId: string,
  ownerUid: string,
  mode: string,
  contextBaseKey: string
): string {
  return `${conversationSessionKeysPath(tenantId)}/${conversationSessionKeyId(
    ownerUid,
    mode,
    contextBaseKey
  )}`;
}

export function conversationMessagesPath(tenantId: string, sessionId: string): string {
  return `${conversationSessionDoc(tenantId, sessionId)}/messages`;
}

export function conversationMessageDoc(
  tenantId: string,
  sessionId: string,
  messageId: string
): string {
  return `${conversationMessagesPath(tenantId, sessionId)}/${messageId}`;
}

export function conversationTurnsPath(tenantId: string, sessionId: string): string {
  return `${conversationSessionDoc(tenantId, sessionId)}/turns`;
}

export function conversationTurnDoc(tenantId: string, sessionId: string, turnId: string): string {
  return `${conversationTurnsPath(tenantId, sessionId)}/${turnId}`;
}

export function conversationEvidencePath(tenantId: string, sessionId: string): string {
  return `${conversationSessionDoc(tenantId, sessionId)}/privateEvidence`;
}

export function conversationEvidenceDoc(
  tenantId: string,
  sessionId: string,
  evidenceId: string
): string {
  return `${conversationEvidencePath(tenantId, sessionId)}/${evidenceId}`;
}

export function itemSubmissionsPath(tenantId: string): string {
  return tenantCollection(tenantId, "itemSubmissions");
}

export function itemSubmissionDoc(tenantId: string, submissionId: string): string {
  return `${itemSubmissionsPath(tenantId)}/${submissionId}`;
}

export function itemSubmissionAttemptsPath(tenantId: string, submissionId: string): string {
  return `${itemSubmissionDoc(tenantId, submissionId)}/evaluationAttempts`;
}

export function itemSubmissionAttemptDoc(
  tenantId: string,
  submissionId: string,
  attemptId: string
): string {
  return `${itemSubmissionAttemptsPath(tenantId, submissionId)}/${attemptId}`;
}

export function progressApplicationDoc(
  tenantId: string,
  uid: string,
  spaceId: string,
  submissionId: string
): string {
  return `${spaceProgressDoc(tenantId, uid, spaceId)}/applications/${submissionId}`;
}

// --- infrastructure collections -------------------------------------------

export function idempotencyDoc(tenantId: string, uid: string, key: string): string {
  return `${tenantCollection(tenantId, "idempotency")}/${uid}_${key}`;
}

export function outboxPath(tenantId: string): string {
  return tenantCollection(tenantId, "outbox");
}

export function auditPath(tenantId: string): string {
  // Platform-level audit rows (`ctx.tenantId ?? '__platform__'`) must NOT live under a
  // `tenants/__platform__/…` doc — Firestore rejects `__platform__` as a reserved id.
  // Route them to a dedicated top-level `platformAudit` collection instead.
  if (tenantId === PLATFORM_TENANT) return topLevel("platformAudit");
  return tenantCollection(tenantId, "audit");
}

// --- top-level (un-tenant-scoped) collection builders ---------------------
// Every reference below routes through `topLevel()` so the env prefix lands on
// the FIRST path segment ONLY. These mirror `@levelup/seed` `Paths` so seeded
// data and the callable reads resolve to the SAME prefixed collection.

/** `users` (top-level). */
export function usersCollection(): string {
  return topLevel("users");
}
export function usersDoc(uid: string): string {
  return `${usersCollection()}/${uid}`;
}

/** `userMemberships/{uid}_{tenantId}` (top-level). */
export function userMembershipsCollection(): string {
  return topLevel("userMemberships");
}
export function userMembershipId(uid: string, tenantId: string): string {
  return `${uid}_${tenantId}`;
}
export function userMembershipDoc(uid: string, tenantId: string): string {
  return `${userMembershipsCollection()}/${userMembershipId(uid, tenantId)}`;
}

/** `userProviderKeys/{uid}:{provider}` (top-level; per-user BYOK metadata — the
 *  key VALUE lives in Secret Manager, this doc holds only the ref + masked hint).
 *  User-global (follows the user across tenants). Server-only (rules deny-all). */
export function userProviderKeysCollection(): string {
  return topLevel("userProviderKeys");
}
export function userProviderKeyDocId(uid: string, provider: string): string {
  return `${uid}:${provider}`;
}
export function userProviderKeyDoc(uid: string, provider: string): string {
  return `${userProviderKeysCollection()}/${userProviderKeyDocId(uid, provider)}`;
}

/** `keyMetadata/{scopeKey}` (top-level; masked/status/version metadata for
 *  tenant + platform owned keys — never the value). scopeKey is
 *  `tenant:{tenantId}:{provider}` or `platform:{provider}`. Server-only. */
export function keyMetadataDoc(scopeKey: string): string {
  return `${topLevel("keyMetadata")}/${scopeKey}`;
}

/** `tenantCodes/{code}` (top-level public join-code index). */
export function tenantCodesCollection(): string {
  return topLevel("tenantCodes");
}
export function tenantCodeDoc(code: string): string {
  return `${tenantCodesCollection()}/${code}`;
}

/** `consumerProfiles/{uid}` (top-level B2C). */
export function consumerProfilesCollection(): string {
  return topLevel("consumerProfiles");
}
export function consumerProfileDoc(uid: string): string {
  return `${consumerProfilesCollection()}/${uid}`;
}

/** `impersonationSessions/{id}` (top-level super-admin ledger). */
export function impersonationSessionsCollection(): string {
  return topLevel("impersonationSessions");
}
export function impersonationSessionDoc(sessionId: string): string {
  return `${impersonationSessionsCollection()}/${sessionId}`;
}

/** `globalEvaluationPresets/{id}` (top-level platform presets). */
export function globalEvaluationPresetsCollection(): string {
  return topLevel("globalEvaluationPresets");
}
export function globalEvaluationPresetDoc(id: string): string {
  return `${globalEvaluationPresetsCollection()}/${id}`;
}

/** `platformActivityLog/{id}` (top-level platform activity ledger). */
export function platformActivityLogCollection(): string {
  return topLevel("platformActivityLog");
}
