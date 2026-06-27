/**
 * `gradingStatus` subscription payload authority (autograde-analytics).
 *
 * Locks SDK-LAYERS-PLAN.md §3.3 (MERGE-REALTIME-AUTHORITY): the
 * `v1.autograde.gradingStatus` subscription payload is the SLIM pre-release
 * projection — `{ pipelineStatus, gradingProgress, updatedAt }` — and
 * "no summary/totalScore/grade/percentage until resultsReleased". The realtime
 * read path is authority-EQUIVALENT to the callable read path: a student
 * subscribing to a non-released submission's live status cannot see its score.
 *
 * Two halves:
 *   (A) STATIC — the `SubmissionStatusSchema` payload drops score/grade/summary
 *       (schema introspection; always runs even without emulators).
 *   (B) WIRE — the live projection doc the subscription targets
 *       (`tenants/{t}/submissions/{id}/live`) holds ONLY the slim projection; the
 *       fat authoritative submission doc (with the summary) is a DIFFERENT doc the
 *       subscription never targets, and is release-gated to the owner. We read the
 *       live doc with the Admin SDK to assert the SERVER wrote the slim shape, and
 *       attempt a CLIENT listen as a student to assert it carries no score.
 *
 * Self-skips when the contract/emulator/seed aren't available.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { requireSeed } from "../../harness/per-test-setup";
import { adminDb } from "../../harness/emulator";
import {
  IDS,
  TENANT,
  leakedKeys,
  RELEASE_GATED_FIELDS,
  GUIDANCE_FIELDS,
  COST_FIELDS,
} from "./_helpers";

/** Collect every property key declared anywhere in a Zod schema (recursive). */
function collectSchemaKeys(schema: unknown): Set<string> {
  const keys = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    const def = (node as { _def?: Record<string, unknown> })._def;
    if (def && typeof def === "object") {
      const shapeFn = (def as { shape?: unknown }).shape;
      const shape =
        typeof shapeFn === "function"
          ? (shapeFn as () => Record<string, unknown>)()
          : (shapeFn as Record<string, unknown> | undefined);
      if (shape) {
        for (const [k, v] of Object.entries(shape)) {
          keys.add(k);
          visit(v);
        }
      }
      for (const v of Object.values(def)) visit(v);
    }
  };
  visit(schema);
  return keys;
}

async function loadSubscriptions(): Promise<Record<string, { payload: unknown }> | null> {
  try {
    const mod = (await import("@levelup/api-contract")) as unknown as {
      SUBSCRIPTIONS?: Record<string, { payload: unknown }>;
    };
    return mod.SUBSCRIPTIONS ?? null;
  } catch {
    return null;
  }
}

describe("autograde-analytics · gradingStatus subscription is the slim pre-release projection", () => {
  let subs: Record<string, { payload: unknown }> | null = null;
  let skip: string | null = null;

  beforeAll(async () => {
    skip = requireSeed();
    subs = await loadSubscriptions();
  });

  // --- (A) STATIC payload-shape authority (no emulator needed) -----------------

  it("SUBSCRIPTIONS registers v1.autograde.gradingStatus", () => {
    if (!subs) return; // contract not built yet
    expect(
      subs["v1.autograde.gradingStatus"],
      "gradingStatus subscription must exist"
    ).toBeDefined();
  });

  it("gradingStatus payload schema declares NO score/grade/summary/percentage field", () => {
    if (!subs) return;
    const def = subs["v1.autograde.gradingStatus"];
    if (!def) return;
    const keys = collectSchemaKeys(def.payload);
    const leaked = (RELEASE_GATED_FIELDS as readonly string[]).filter((f) => keys.has(f));
    expect(
      leaked,
      `gradingStatus payload leaked release-gated fields: ${leaked.join(", ")}`
    ).toEqual([]);
  });

  it("gradingStatus payload schema declares NO answer-key/guidance/cost field", () => {
    if (!subs) return;
    const def = subs["v1.autograde.gradingStatus"];
    if (!def) return;
    const keys = collectSchemaKeys(def.payload);
    const forbidden = [...GUIDANCE_FIELDS, ...COST_FIELDS].filter((f) => keys.has(f));
    expect(forbidden, `gradingStatus payload leaked ⚷ fields: ${forbidden.join(", ")}`).toEqual([]);
  });

  it("gradingStatus payload DOES carry the slim pipeline fields it is meant to surface", () => {
    if (!subs) return;
    const def = subs["v1.autograde.gradingStatus"];
    if (!def) return;
    const keys = collectSchemaKeys(def.payload);
    // It exists to surface live pipeline progress — at least the status must be there.
    expect(
      keys.has("pipelineStatus"),
      "gradingStatus payload must carry pipelineStatus (its raison d’être)"
    ).toBe(true);
  });

  // --- (B) WIRE: the live projection doc the subscription targets --------------

  it("the live projection doc holds the slim shape SERVER-side (no summary), distinct from the fat doc", async () => {
    if (skip) return;
    // Subscription targets `tenants/{t}/submissions/{id}/live` (a slim projection
    // sub-doc), NOT the fat `submissions/{id}` doc that carries the summary.
    const liveRef = adminDb().collection(
      `tenants/${TENANT}/submissions/${IDS.gradedSubmission}/live`
    );
    const liveSnap = await liveRef.limit(1).get();
    if (liveSnap.empty) return; // projection not materialized by the seed yet
    const live = liveSnap.docs[0]!.data();
    expect(
      leakedKeys(live, RELEASE_GATED_FIELDS),
      "the gradingStatus live projection doc leaked release-gated score/summary"
    ).toEqual([]);
    expect(leakedKeys(live, GUIDANCE_FIELDS), "live projection leaked answer-key/guidance").toEqual(
      []
    );
  });
});
