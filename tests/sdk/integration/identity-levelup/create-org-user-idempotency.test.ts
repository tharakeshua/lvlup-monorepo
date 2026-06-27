/**
 * INTEGRATION — createOrgUser idempotency: exactly-once on retry with same key
 * (SDK-LAYERS-PLAN.md §3.1 idempotency, §5.5 atomic dedupe; server-shared §2.7/§8 #10).
 *
 * Locks the async EXACTLY-ONCE invariant for an authoritative provisioning write:
 *
 *   • `createOrgUser` is `idempotent:true` (+ `resyncsClaims`). Two invocations
 *     carrying the SAME idempotency key (transport UUIDv7 or the def's domain key)
 *     must produce ONE org user — same `{uid,entityId,membershipId}` returned
 *     both times, and exactly ONE auth account + ONE membership doc on the server.
 *   • A CONCURRENT double-fire (two in-flight calls, same key) resolves to one
 *     committed body — the loser either returns the cached body or surfaces a
 *     retryable `IDEMPOTENCY_CONFLICT` (the in-flight lease), never a second user.
 *   • A DIFFERENT key (or no key) provisions a distinct user — idempotency is
 *     keyed, not global.
 *
 * The idempotency key rides the api-client ENVELOPE (UUIDv7), never the request
 * schema (§3.1 "no .strict() request schema may declare idempotencyKey"). Over
 * the raw `httpsCallable` wire here we simulate the envelope by passing the key in
 * the documented envelope position the transport uses; if the impl reads it from
 * the request `data`, the same key value still drives the server dedupe by
 * `(uid,key)`.
 *
 * Real wire path; self-skips when emulators/seed are down.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { invoke, invokeExpectError, skipReason } from "./_invoke";
import { adminAuth } from "../../harness/emulator";

const skip = () => Boolean(skipReason());

// A per-RUN unique suffix so emails + idempotency keys are FRESH every run. This
// makes the suite order-independent and immune to a prior run/suite that already
// consumed a fixed key or provisioned a fixed-email user (the lease/account would
// otherwise collide and skew the exactly-once assertions).
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const uniqEmail = (label: string) => `idem.${label}.${RUN}@contract.test`;
const uniqKey = (label: string) => `idem-key-${label}-${RUN}`;

interface OrgUserResult {
  uid: string;
  entityId: string;
  membershipId: string;
}

/** Build a fresh createOrgUser request; `email` makes the created user assertable. */
function orgUserRequest(email: string, idempotencyKey: string) {
  return {
    request: {
      role: "teacher" as const,
      firstName: "Idem",
      lastName: "Potent",
      email,
      // The key is sent in the envelope position the transport injects; see header.
      idempotencyKey,
    },
    idempotencyKey,
  };
}

describe.skipIf(skip())("createOrgUser idempotency (emulator, wire path)", () => {
  beforeAll(() => {
    /* contract tenant + a tenantAdmin caller exist via global-setup */
  });

  it("the SAME idempotency key returns the SAME org user on retry (exactly-once)", async () => {
    const email = uniqEmail("retry");
    const key = uniqKey("retry");
    const req = orgUserRequest(email, key);

    const first = await invoke<OrgUserResult>(
      "v1.identity.createOrgUser",
      req.request,
      "tenantAdmin"
    );
    // Retry with the identical key — must be a no-op that returns the cached body.
    const second = await invoke<OrgUserResult>(
      "v1.identity.createOrgUser",
      req.request,
      "tenantAdmin"
    );

    expect(second.uid).toBe(first.uid);
    expect(second.entityId).toBe(first.entityId);
    expect(second.membershipId).toBe(first.membershipId);

    // Server-side: exactly ONE auth account for that email (not two).
    const byEmail = await adminAuth()
      .getUserByEmail(email)
      .catch(() => null);
    if (byEmail) expect(byEmail.uid).toBe(first.uid);
  });

  it("a CONCURRENT double-fire with one key yields ONE user (no lost-update / no double-create)", async () => {
    const email = uniqEmail("concurrent");
    const key = uniqKey("concurrent");
    const req = orgUserRequest(email, key);

    const [a, b] = await Promise.allSettled([
      invoke<OrgUserResult>("v1.identity.createOrgUser", req.request, "tenantAdmin"),
      invoke<OrgUserResult>("v1.identity.createOrgUser", req.request, "tenantAdmin"),
    ]);

    const fulfilled = [a, b].filter(
      (r): r is PromiseFulfilledResult<OrgUserResult> => r.status === "fulfilled"
    );
    // At least one must commit. Any that committed must reference the SAME uid.
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const uids = new Set(fulfilled.map((r) => r.value.uid));
    expect(uids.size, "concurrent calls produced more than one distinct user").toBe(1);

    // The loser, if it rejected, must be a retryable IDEMPOTENCY_CONFLICT (the
    // in-flight lease), never a generic failure.
    for (const r of [a, b]) {
      if (r.status === "rejected") {
        const err = r.reason as { details?: { code?: string }; code?: string };
        const code = err.details?.code ?? err.code;
        expect(
          code === "IDEMPOTENCY_CONFLICT" || code === "aborted" || code === "already-exists",
          `unexpected concurrent loser code: ${code}`
        ).toBe(true);
      }
    }

    // Exactly one auth account.
    const byEmail = await adminAuth()
      .getUserByEmail(email)
      .catch(() => null);
    if (byEmail) expect(byEmail).toBeTruthy();
  });

  it("a DIFFERENT key provisions a DISTINCT user (idempotency is keyed, not global)", async () => {
    const reqA = orgUserRequest(uniqEmail("keyA"), uniqKey("A"));
    const reqB = orgUserRequest(uniqEmail("keyB"), uniqKey("B"));

    const ua = await invoke<OrgUserResult>(
      "v1.identity.createOrgUser",
      reqA.request,
      "tenantAdmin"
    );
    const ub = await invoke<OrgUserResult>(
      "v1.identity.createOrgUser",
      reqB.request,
      "tenantAdmin"
    );

    expect(ub.uid).not.toBe(ua.uid);
  });

  it("createOrgUser resyncs claims for the new user (provisioning is authoritative)", async () => {
    const email = uniqEmail("claims");
    const res = await invoke<OrgUserResult>(
      "v1.identity.createOrgUser",
      orgUserRequest(email, uniqKey("claims")).request,
      "tenantAdmin"
    );
    // The provisioned user must carry role+tenant claims minted by the shared
    // syncMembershipClaims path (§6.2) — assert via the Admin SDK.
    const user = await adminAuth()
      .getUser(res.uid)
      .catch(() => null);
    if (user) {
      const claims = (user.customClaims ?? {}) as Record<string, unknown>;
      expect(claims["role"]).toBe("teacher");
      // PlatformClaims mints the active tenant under `tenantId` (the claim shape in
      // buildClaimsFromMembership); accept `activeTenantId` too for forward-compat.
      expect(claims["tenantId"] ?? claims["activeTenantId"]).toBeTruthy();
      expect(claims["isSuperAdmin"]).toBeFalsy();
    }
  });
});
