/**
 * Versioned conversation-agent writer.
 *
 * A conversation session freezes the agent version it was configured from, so
 * authoring cannot use a read-then-upsert sequence: two concurrent saves could
 * otherwise both emit the same next version. This adapter owns the one
 * transaction that compares the persisted semantic shape and advances the
 * version exactly once when needed.
 */
import { type Firestore, type Transaction } from "firebase-admin/firestore";
import { docFromFirestore, toFirestore } from "./firestore.js";
import { tenantCollection } from "./paths.js";
import type {
  SaveVersionedAgentInput,
  SaveVersionedAgentResult,
  VersionedAgentRepo,
} from "./types.js";

type Doc = Record<string, unknown>;
const hasOwn = (value: Doc, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

/** Audit/identity fields do not change a frozen configuration. Everything else
 * is semantic by default, including future canonical agent fields added by T-A.
 */
export const NON_SEMANTIC_AGENT_FIELDS = new Set([
  "id",
  "tenantId",
  "version",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
]);

function isRecord(value: unknown): value is Doc {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Stable JSON representation: key order cannot create a spurious version. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;

  const out: Doc = {};
  for (const key of Object.keys(value).sort()) {
    const child = value[key];
    if (child !== undefined) out[key] = canonicalize(child);
  }
  return out;
}

function semanticShape(agent: Doc): Doc {
  const shape: Doc = {};
  for (const [key, value] of Object.entries(agent)) {
    if (!NON_SEMANTIC_AGENT_FIELDS.has(key) && value !== undefined) shape[key] = value;
  }
  return canonicalize(shape) as Doc;
}

export function sameAgentSemanticShape(a: Doc, b: Doc): boolean {
  return JSON.stringify(semanticShape(a)) === JSON.stringify(semanticShape(b));
}

export function storedAgentVersion(agent: Doc): number {
  const version = agent["version"];
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 1 ? version : 1;
}

export function makeAgentVersionConflict(expectedVersion: number, currentVersion: number): Error {
  const error = new Error("Agent version conflict") as Error & {
    code: string;
    expectedVersion: number;
    currentVersion: number;
  };
  error.code = "CONFLICT";
  error.expectedVersion = expectedVersion;
  error.currentVersion = currentVersion;
  return error;
}

function invalidAgentInput(message: string): Error {
  const error = new Error(message) as Error & { code: string };
  error.code = "VALIDATION_ERROR";
  return error;
}

/** Data is deliberately semantic-only: repository ownership stamps identity,
 * version, and audit fields inside the same transaction. */
export function assertSemanticAgentPayload(data: Doc): void {
  for (const field of NON_SEMANTIC_AGENT_FIELDS) {
    if (hasOwn(data, field)) {
      throw invalidAgentInput(`agentVersions.save data must not include ${field}`);
    }
  }
}

export function assertAgentActorUid(actorUid: string): void {
  if (actorUid.trim().length === 0) {
    throw invalidAgentInput("agentVersions.save requires actorUid");
  }
}

function assertExistingUpdateFence(input: SaveVersionedAgentInput, currentVersion: number): void {
  if (
    input.expectedVersion == null ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1
  ) {
    throw invalidAgentInput("agentVersions.save requires expectedVersion for an existing agent");
  }
  if (input.expectedVersion !== currentVersion) {
    throw makeAgentVersionConflict(input.expectedVersion, currentVersion);
  }
}

export function assertAgentSpaceUnchanged(existing: Doc, data: Doc): void {
  if (
    hasOwn(data, "spaceId") &&
    existing["spaceId"] !== undefined &&
    existing["spaceId"] !== data["spaceId"]
  ) {
    const error = new Error("An agent cannot move between spaces") as Error & {
      code: string;
      currentSpaceId: unknown;
    };
    error.code = "CONFLICT";
    error.currentSpaceId = existing["spaceId"];
    throw error;
  }
}

/**
 * Make the authoritative Firestore implementation. The chosen `now` is passed
 * from the caller so retries of a Firestore transaction do not manufacture a
 * different semantic document or version decision.
 */
export function makeVersionedAgentRepo(
  firestore: Firestore,
  nowFn: () => string
): VersionedAgentRepo {
  const agents = (tenantId: string) => firestore.collection(tenantCollection(tenantId, "agents"));

  return {
    async save(
      tenantId: string,
      input: SaveVersionedAgentInput,
      now: string = nowFn()
    ): Promise<SaveVersionedAgentResult> {
      assertAgentActorUid(input.actorUid);
      assertSemanticAgentPayload(input.data);
      const id = input.id ?? agents(tenantId).doc().id;
      const ref = agents(tenantId).doc(id);

      return firestore.runTransaction(async (tx: Transaction) => {
        const snap = await tx.get(ref);
        const existing = snap.exists
          ? docFromFirestore({ ...snap.data(), id: snap.id })
          : undefined;

        if (!existing && input.expectedVersion != null && input.expectedVersion !== 0) {
          throw makeAgentVersionConflict(input.expectedVersion, 0);
        }

        if (existing) {
          const currentVersion = storedAgentVersion(existing);
          assertExistingUpdateFence(input, currentVersion);
          assertAgentSpaceUnchanged(existing, input.data);
        }

        // Preserve fields not present in a patch; explicit null remains a
        // semantic value and is persisted, while undefined is ignored at the
        // Firestore boundary just as it is for the existing EntityRepo.
        const candidate: Doc = {
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

        const agent: Doc = {
          ...candidate,
          id,
          tenantId,
          version,
          createdAt: existing?.["createdAt"] ?? now,
          createdBy: existing?.["createdBy"] ?? input.actorUid,
          updatedAt: now,
          updatedBy: input.actorUid,
        };

        // This is a full merged record created from the transaction snapshot,
        // not an out-of-transaction merge write. A concurrent save retries,
        // compares the latest semantic shape, and obtains the next version.
        tx.set(ref, toFirestore(agent));
        return { id, created, semanticChanged, version, agent };
      });
    },
  };
}
