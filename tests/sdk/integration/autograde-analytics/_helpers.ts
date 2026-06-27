/**
 * Shared helpers for the autograde-analytics integration/contract suite.
 *
 * These tests assert the AUTHORITATIVE SERVER BEHAVIOR + the trust boundary
 * end-to-end against the Firebase emulator + the seeded contract tenant
 * (SDK-LAYERS-PLAN.md §3.1 contract tests, §3.3 realtime authority, §4.4
 * authority/optimistic, §6 the ⚷ server-only list, autograde domain plan
 * "Authority boundary"). They run in a later validation phase under
 * `firebase emulators:exec --project demo-levelup`.
 *
 * Everything here is thin over the EXISTING harness (do not re-implement the
 * emulator connector / seed loader / auth-context — reuse them):
 *   • `clientFunctions()` + `httpsCallable` — the real client→callable wire.
 *   • `signInAsDemoUser(role)` — a real Auth-emulator session with custom claims.
 *   • `adminDb()` — the privileged Admin SDK, used ONLY to (a) read answer-key
 *     subcollections that clients can never see (deny-all), and (b) assert that
 *     grading outputs are SERVER-written (not present until the server writes
 *     them). The Admin SDK bypasses rules, so reading a deny-all path through it
 *     is the correct way to prove "the server wrote X" without leaking it to a
 *     client.
 *   • `requireSeed()` — skip (not fail) when emulators/seed are unavailable.
 *
 * Wire-name convention matches `tests/sdk/contract/callable-contract.test.ts`:
 * the deployed callable is named by the fully-qualified registry key
 * (`v1.autograde.uploadAnswerSheets`, …).
 */
import { expect } from "vitest";
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { clientFunctions, adminDb } from "../../harness/emulator";
// Deployed-id (dashed) resolution from the dotted contract name — same convention
// as `@levelup/transport-firebase` (Firebase forbids dots in a function id).
import { toDeployedCallableId } from "@levelup/transport-firebase";
import type { CallableName } from "@levelup/api-contract";
import { signInAsDemoUser, signOutClient, type Role } from "../../harness/auth-context";
import {
  CONTRACT_TENANT_KEY,
  DEMO_CONTENT_KEYS,
  DEMO_USER_KEYS,
  localSeedId,
} from "../../harness/fixtures-ids";

/** The deterministic contract-tenant id every autograde-analytics test runs in. */
export const TENANT = localSeedId("tenant", CONTRACT_TENANT_KEY);

/** Well-known deterministic ids the seed materializes for this slice. */
export const IDS = {
  exam: localSeedId("exam", DEMO_CONTENT_KEYS.exam.split(".").pop()!), // exam.midterm → 'midterm'
  examQuestion: localSeedId("examq", "1"),
  class: localSeedId("class", "10a"),
  /** A submission that is fully graded but NOT yet released (the release-gate fixture). */
  gradedSubmission: localSeedId("submission", "s1"),
  /** A DEDICATED graded-but-unreleased submission that NO suite ever releases — used
   *  by the pre-release STRIP assertions so they stay order-independent. */
  lockedSubmission: `${localSeedId("submission", "s1")}_locked`,
  /** The owning student of `gradedSubmission` (== the linked child of `parent`). */
  student: localSeedId("student", DEMO_USER_KEYS.student.split(".").pop()!), // student.sam → 'sam'
  /** A DIFFERENT student in a different class — used for cross-ownership denial. */
  studentOther: localSeedId("student", DEMO_USER_KEYS.studentOther.split(".").pop()!),
  item: localSeedId("item", "arrays.q1"),
  /** The seeded space + story point that OWN `item` (valid ids so authoring reads reach authorize()). */
  space: localSeedId("space", "dsa"),
  storyPoint: localSeedId("sp", "arrays"),
} as const;

/** Admin SDK path roots (the ONLY direct-Firestore reads, for ⚷ assertions). */
export const PATHS = {
  exams: `tenants/${TENANT}/exams`,
  submissions: `tenants/${TENANT}/submissions`,
  /** answer-key subcollection — deny-all to clients (REVIEW §6.4 / autograde plan). */
  answerKeysFor: (itemId: string) =>
    `tenants/${TENANT}/spaces/${localSeedId("space", "dsa")}/storyPoints/${localSeedId("sp", "arrays")}/items/${itemId}/answerKeys`,
} as const;

/** Invoke a callable through the REAL client→Functions-emulator wire, as `role`. */
export async function callAs<Req = unknown, Res = unknown>(
  name: string,
  data: Req,
  role: Role | "public"
): Promise<Res> {
  if (role !== "public") await signInAsDemoUser(role);
  else await signOutClient();
  const fn = httpsCallable<Req, Res>(clientFunctions(), toDeployedCallableId(name as CallableName));
  const res: HttpsCallableResult<Res> = await fn(data);
  return res.data;
}

/**
 * Assert a callable invocation is DENIED by the server with the expected
 * `AppErrorCode` (mapped to an `HttpsError` by functions-shared `mapError`). The
 * trust-boundary half of every test: a client trying to read/write a ⚷ field is
 * rejected at the server, not just hidden by a projection.
 *
 * `firebase/functions` surfaces the code as `error.code` like
 * `functions/permission-denied`. We match on the suffix so the test is robust to
 * the `functions/` prefix.
 */
export async function expectDenied<Req = unknown>(
  name: string,
  data: Req,
  role: Role | "public",
  expectedHttpsCode:
    | "permission-denied"
    | "unauthenticated"
    | "not-found"
    | "failed-precondition"
    | "invalid-argument"
    | "already-exists"
    | "resource-exhausted"
    | "aborted"
): Promise<void> {
  let threw = false;
  try {
    await callAs(name, data, role);
  } catch (e) {
    threw = true;
    const code = String((e as { code?: string }).code ?? "");
    expect(
      code.endsWith(expectedHttpsCode),
      `${name} as ${role}: expected https code '${expectedHttpsCode}', got '${code}' (${(e as Error).message})`
    ).toBe(true);
  }
  expect(threw, `${name} as ${role}: expected the server to DENY but it resolved`).toBe(true);
}

/** Deep-search a JSON-serializable response for any of the forbidden keys. Returns the offenders found. */
export function leakedKeys(res: unknown, forbidden: readonly string[]): string[] {
  const found = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      if (forbidden.includes(k) && (v as Record<string, unknown>)[k] !== undefined) found.add(k);
      walk(child);
    }
  };
  walk(res);
  return [...found];
}

/** The release-gated score/grade fields that must NOT appear before `resultsReleased`. */
export const RELEASE_GATED_FIELDS = [
  "totalScore",
  "maxScore",
  "percentage",
  "grade",
  "summary",
  "score",
  "evaluation",
] as const;

/** Rubric/answer-key guidance fields a non-authoring role must never see (REVIEW §6.4/§6.7). */
export const GUIDANCE_FIELDS = [
  "correctAnswer",
  "acceptableAnswers",
  "evaluationGuidance",
  "evaluatorGuidance",
  "modelAnswer",
  "promptGuidance",
  "systemPrompt",
  "confidenceConfig",
] as const;

/** AI cost fields that must never ride a client response (REVIEW §6 AI row / CD4). */
export const COST_FIELDS = ["costUsd", "cost", "tokensUsed", "geminiApiKey"] as const;
