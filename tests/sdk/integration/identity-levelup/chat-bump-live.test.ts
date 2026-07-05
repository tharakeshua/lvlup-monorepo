/**
 * INTEGRATION — CHAT-1 chatBump end-to-end (AD-12 addendum; emulator, wire path).
 *
 * Proves the bump-node design LIVE:
 *   1. `sendChatMessage` (deployed callable) appends both turns AND the Admin-RTDB
 *      adapter writes `chatBump/{t}/{uid}/{sessionId}` — MINIMAL `{rev,
 *      lastMessageAt}` at rest (rev == 2 after the user+assistant double append;
 *      no message content in RTDB, asserted on the raw node).
 *   2. The OWNER's client (student token) can read the bump node under
 *      database.rules.json, and the bump → `getChatSession` refetch observes the
 *      appended messages in < 2s (the CHAT-1 acceptance timing).
 *   3. A NON-owner (teacher token) is DENIED on the same node (owner-only root —
 *      chat is USER-owned, AD-9).
 *
 * Requires the functions + database emulators (self-skips otherwise). The
 * sdk-v1 bootstrap wires the RTDB projections whenever
 * FIREBASE_DATABASE_EMULATOR_HOST is set, so the bump write is the REAL adapter,
 * not a stub.
 */
import { describe, it, expect } from "vitest";
import {
  getDatabase,
  connectDatabaseEmulator,
  ref,
  onValue,
  get,
  type Database,
} from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { toDeployedCallableId } from "@levelup/transport-firebase";
import type { CallableName } from "@levelup/api-contract";
import { skipReason, CONTRACT_TENANT_ID } from "./_invoke";
import { signInAsDemoUser, type TestClaims } from "../../harness/auth-context";
import {
  getClientApp,
  clientFunctions,
  EMULATOR_HOST,
  PORTS,
  PROJECT_ID,
} from "../../harness/emulator";

const skip = () => Boolean(skipReason());

/**
 * The RTDB rules gate on `auth.token.tenantId` (canonical PlatformClaims field);
 * the demo-harness base claims only mint the `activeTenantId` alias, so the
 * override mirrors what prod claim minters emit.
 */
const TENANT_CLAIM = { tenantId: CONTRACT_TENANT_ID } as unknown as Partial<TestClaims>;

let rtdb: Database | undefined;
function clientRtdb(): Database {
  if (!rtdb) {
    rtdb = getDatabase(getClientApp());
    connectDatabaseEmulator(rtdb, EMULATOR_HOST, PORTS.database);
  }
  return rtdb;
}

function call<T>(name: CallableName, data: unknown): Promise<T> {
  const fn = httpsCallable(clientFunctions(), toDeployedCallableId(name));
  return fn(data).then((r) => r.data as T);
}

/** First non-null value of an RTDB node (rejects on rules denial / timeout). */
function awaitNode(db: Database, path: string, timeoutMs = 5000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      detach();
      reject(new Error(`timed out waiting for ${path}`));
    }, timeoutMs);
    const detach = onValue(
      ref(db, path),
      (snap) => {
        if (snap.val() === null) return; // not written yet — keep listening
        clearTimeout(timer);
        detach();
        resolve(snap.val());
      },
      (err) => {
        clearTimeout(timer);
        detach();
        reject(err);
      }
    );
  });
}

describe.skipIf(skip())("CHAT-1 chatBump — live bump → refetch (< 2s), rules-gated", () => {
  it("send → bump node holds MINIMAL {rev:2, lastMessageAt}; owner refetch sees both turns < 2s", async () => {
    const { uid } = await signInAsDemoUser("student", TENANT_CLAIM);

    // Warm-up OUTSIDE the timed window — a real client has a warm functions
    // runtime and an already-connected RTDB socket before any message is sent;
    // only the emulator's first-invocation cold start would otherwise bill
    // 2-3s of boot into the acceptance measurement.
    await call("v1.levelup.listChatSessions", {}).catch(() => undefined);
    await get(ref(clientRtdb(), "chatBump/_warmup")).catch(() => undefined);

    const sent = await call<{ sessionId: string }>("v1.levelup.sendChatMessage", {
      spaceId: "space_chat_bump_e2e",
      storyPointId: "sp_chat_bump_e2e",
      itemId: "item_chat_bump_e2e",
      text: "bump-e2e: what is a binary heap?",
    });
    expect(sent.sessionId).toBeTruthy();

    // Message appended (send resolved) → the clock starts: the client must
    // observe the bump AND refetch the thread inside the 2s acceptance window.
    const t0 = Date.now();

    const bump = (await awaitNode(
      clientRtdb(),
      `chatBump/${CONTRACT_TENANT_ID}/${uid}/${sent.sessionId}`
    )) as Record<string, unknown>;

    // MINIMAL at rest: rev + lastMessageAt, nothing else — content never in RTDB.
    expect(Object.keys(bump).sort()).toEqual(["lastMessageAt", "rev"]);
    expect(bump["rev"]).toBe(2); // user append + assistant append
    expect(typeof bump["lastMessageAt"]).toBe("string");
    expect(JSON.stringify(bump)).not.toContain("binary heap");

    // The bump-triggered refetch: getChatSession is the single authority.
    const got = await call<{ session: { messages: Array<{ role: string; text: string }> } }>(
      "v1.levelup.getChatSession",
      { sessionId: sent.sessionId }
    );
    const elapsed = Date.now() - t0;

    // Order-agnostic: the user+assistant turns share one server timestamp, so
    // Firestore's orderBy(timestamp) tie-breaks by doc id (nondeterministic).
    expect(got.session.messages.length).toBeGreaterThanOrEqual(2);
    expect(got.session.messages.some((m) => m.text.includes("binary heap"))).toBe(true);
    expect(got.session.messages.some((m) => m.role === "assistant")).toBe(true);
    // eslint-disable-next-line no-console
    console.log(`[CHAT-1 e2e] bump observed + getChatSession refetched in ${elapsed}ms`);
    expect(elapsed, `bump→refetch took ${elapsed}ms (acceptance: < 2000ms)`).toBeLessThan(2000);
  });

  it("owner reads, NON-owner (teacher) is denied on the bump node (owner-only root)", async () => {
    // REST-probe pattern (per-request `auth=` token — no websocket auth-carryover;
    // the U2.4/U2.5 rules-verification convention). NAMESPACE CAVEAT: the database
    // emulator registers database.rules.json ONLY for its configured instance
    // `<project>-default-rtdb`, while the harness clients + the functions-side
    // Admin SDK operate on `?ns=<project>` (rule-less in the emulator). So the
    // rules gate is probed on the RULED namespace, seeded with the exact
    // {rev, lastMessageAt} shape read off the LIVE node (deployed RTDB has a
    // single instance, so live node ≡ ruled node in prod).
    const student = await signInAsDemoUser("student", TENANT_CLAIM);
    const sent = await call<{ sessionId: string }>("v1.levelup.sendChatMessage", {
      spaceId: "space_chat_bump_e2e",
      storyPointId: "sp_chat_bump_e2e",
      itemId: "item_chat_bump_e2e",
      text: "bump-e2e: rules probe",
    });
    const nodePath = `chatBump/${CONTRACT_TENANT_ID}/${student.uid}/${sent.sessionId}`;
    const base = `http://${EMULATOR_HOST}:${PORTS.database}/${nodePath}.json`;

    // Read the live bump (unruled admin namespace) and seed it verbatim into the
    // ruled namespace via the emulator's admin bypass.
    const live = (await awaitNode(clientRtdb(), nodePath)) as Record<string, unknown>;
    expect(Object.keys(live).sort()).toEqual(["lastMessageAt", "rev"]);
    const RULED_NS = `${PROJECT_ID}-default-rtdb`;
    const seed = await fetch(`${base}?ns=${RULED_NS}`, {
      method: "PUT",
      headers: { Authorization: "Bearer owner" },
      body: JSON.stringify(live),
    });
    expect(seed.status).toBe(200);

    // Owner reads the bump under the rules.
    const ownerResp = await fetch(`${base}?ns=${RULED_NS}&auth=${student.idToken}`);
    expect(ownerResp.status, "owner must read their own bump node").toBe(200);
    const ownerBody = (await ownerResp.json()) as Record<string, unknown>;
    expect(Object.keys(ownerBody).sort()).toEqual(["lastMessageAt", "rev"]);

    // Same-tenant teacher is denied (chat is USER-owned, AD-9 — no role grants).
    const teacher = await signInAsDemoUser("teacher", TENANT_CLAIM);
    const teacherResp = await fetch(`${base}?ns=${RULED_NS}&auth=${teacher.idToken}`);
    expect(teacherResp.status, "teacher must be denied on the student's bump node").toBe(401);

    // Client writes are denied outright (.write false — Admin SDK only).
    const writeResp = await fetch(`${base}?ns=${RULED_NS}&auth=${student.idToken}`, {
      method: "PUT",
      body: JSON.stringify({ rev: 999, lastMessageAt: "spoof" }),
    });
    expect(writeResp.status, "client writes to chatBump must be denied").toBe(401);
  });
});
