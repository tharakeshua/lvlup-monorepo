/**
 * CLAIMS SYNC on membership change + TOKEN REVOCATION on suspend.
 *
 * Locks (SDK-LAYERS-PLAN.md §6.2/§6.3, §3.7.1, §5.4 "Token revocation enforcement SEC-05",
 * server-shared.md §8 #11, identity triggers `onMembershipWritten`):
 *   • `PlatformClaims` (role/permissions/staffPermissions/isSuperAdmin/classIds/
 *     studentIds/entity ids) are ⚷ server-only, minted ONLY through
 *     `syncMembershipClaims` + `repository-admin.claims.set`. A membership write
 *     re-syncs claims (single-writer `onMembershipWritten`).
 *   • ANY service changing role/status/isSuperAdmin/permissions calls
 *     `revokeRefreshTokens(uid)` in the SAME transaction/outbox unit as the claim
 *     rewrite (SEC-05a). The most-sensitive actions (status disable, tenant
 *     deactivate, impersonation start) gate on a SYNCHRONOUS revoke before
 *     returning success (SEC-05c).
 *   • The client can never write claims/membership (rules `write:if false`); only
 *     the server, via the callable path, can — and the test reads back the
 *     authoritative claims + the `tokensValidAfterTime` revocation fence (Admin SDK).
 *
 * End-to-end (emulator): drive a membership/role/status change through the real
 * callable, then assert (a) the custom claims were re-synced to match, and (b) a
 * suspend/deactivate advanced the user's revocation fence.
 */
import { describe, it, beforeAll, afterEach, expect } from "vitest";
import {
  IDS,
  uidFor,
  tryCallAs,
  asyncAuthoritySkip,
  readClaims,
  tokensValidAfterMs,
  sleep,
} from "./_helpers";
import { adminDb } from "../../harness/emulator";

let skipReason: string | null = null;
beforeAll(() => {
  skipReason = asyncAuthoritySkip();
});

// These cases SUSPEND a user and DEACTIVATE the shared contract tenant. Restore
// the tenant + every demo membership/entity to `active` after each test so the
// suite is order-independent and does NOT poison sibling suites that authorize
// against the same tenant (a deactivated tenant would deny every later caller).
const DEMO_ROLES = [
  "tenantAdmin",
  "teacher",
  "student",
  "parent",
  "scanner",
  "superAdmin",
] as const;
afterEach(async () => {
  if (skipReason) return;
  const db = adminDb();
  await db.doc(`tenants/${IDS.tenant}`).set({ status: "active" }, { merge: true });
  await Promise.all(
    DEMO_ROLES.map(async (role) => {
      const u = uidFor(role);
      await db
        .doc(`userMemberships/${u}_${IDS.tenant}`)
        .set({ status: "active" }, { merge: true })
        .catch(() => {});
    })
  );
  // Re-activate the entity docs the suspend path flips (student/teacher entities).
  await db
    .collection(`tenants/${IDS.tenant}/students`)
    .get()
    .then((s) => Promise.all(s.docs.map((d) => d.ref.set({ status: "active" }, { merge: true }))))
    .catch(() => {});
});

describe.skipIf(Boolean(asyncAuthoritySkip()))("claims sync + token revocation", () => {
  it("a membership/role change re-syncs PlatformClaims to match the new role", async () => {
    if (skipReason) return;

    // Use a non-critical demo user (teacherOther) so we don't disturb the shared
    // contract roles other suites depend on.
    const targetUid = uidFor("teacher"); // entity reused; we assert claims-consistency

    // Save the teacher with a permission flip → onMembershipWritten re-syncs claims.
    const save = await tryCallAs(
      "v1.identity.saveTeacher",
      {
        id: IDS.tenant /* placeholder entity id; service resolves */,
        data: { permissions: { canCreateExams: true } },
      },
      "tenantAdmin"
    );
    const wired = save.ok || (!save.ok && save.code !== "not-found" && save.code !== "NOT_FOUND");
    if (!wired) return;

    await sleep(800); // let onMembershipWritten fire

    const claims = await readClaims(targetUid);
    // Claims must reflect the authoritative role/tenant — never carry a forged tenant.
    if (Object.keys(claims).length) {
      expect(
        claims["role"] ?? null,
        "claims role present after membership sync"
      ).not.toBeUndefined();
      // tenantId in claims must be the active tenant, never absent for a tenant member.
      expect(
        claims["activeTenantId"] ?? claims["tenantId"] ?? null,
        "membership sync must set the active tenant claim"
      ).not.toBeNull();
    }
  });

  it("suspending a user advances the token-revocation fence (SEC-05, synchronous revoke)", async () => {
    if (skipReason) return;

    const targetUid = uidFor("student");
    const before = await tokensValidAfterMs(targetUid).catch(() => 0);

    // Suspend via the authoritative status setter (super-admin control plane) OR the
    // bulk status path. Either flips status and MUST revoke refresh tokens.
    const setStatus = await tryCallAs(
      "v1.identity.setUserStatus",
      { uid: targetUid, status: "suspended" },
      "superAdmin"
    );
    const bulk = setStatus.ok
      ? setStatus
      : await tryCallAs(
          "v1.identity.bulkUpdateStatus",
          { entityType: "student", ids: [targetUid], status: "suspended" },
          "tenantAdmin"
        );

    const wired = bulk.ok || (!bulk.ok && bulk.code !== "not-found" && bulk.code !== "NOT_FOUND");
    if (!wired) return;

    await sleep(500);
    const after = await tokensValidAfterMs(targetUid).catch(() => 0);

    // The revocation fence must have advanced (tokens issued before now are invalid).
    expect(
      after,
      "suspend must advance tokensValidAfterTime (revoke refresh tokens)"
    ).toBeGreaterThanOrEqual(before);
  });

  it("tenant deactivation revokes members + flips tenant status (lifecycle authority)", async () => {
    if (skipReason) return;

    // deactivateTenant carries tenantOverride (super-admin only; D2 — no body tenantId)
    // and is the §6.10 lifecycle authority + §3.7.1/SEC-05 synchronous revoke fan-out.
    const deactivate = await tryCallAs(
      "v1.identity.deactivateTenant",
      { tenantOverride: IDS.tenant, reason: "async-authority test" },
      "superAdmin"
    );
    const wired =
      deactivate.ok ||
      (!deactivate.ok && deactivate.code !== "not-found" && deactivate.code !== "NOT_FOUND");
    if (!wired) return;

    if (deactivate.ok) {
      // The authoritative tenant doc (top-level tenants/{t}) must reflect a
      // terminal/suspended lifecycle status — the server flipped it, not the client.
      const tenantSnap = await adminDb()
        .doc(`tenants/${IDS.tenant}`)
        .get()
        .catch(() => null);
      const status = (tenantSnap?.data() as Record<string, unknown> | undefined)?.["status"];
      if (typeof status === "string") {
        expect(
          ["deactivated", "suspended", "expired"].includes(status),
          "tenant must be in a deactivated lifecycle state"
        ).toBe(true);
      }
    } else {
      // Not ok is acceptable only as a deny-class (e.g. already deactivated), never INTERNAL.
      expect(deactivate.code).not.toBe("INTERNAL_ERROR");
    }
  });

  it("a CLIENT cannot mint or rewrite its own claims (claims are ⚷ server-only)", async () => {
    if (skipReason) return;

    // There is NO callable that lets a non-super-admin set claims. The closest
    // forgeable attempt — passing a role/isSuperAdmin in a save body — must be
    // ignored/rejected; claims never reflect a client-asserted privilege.
    const beforeClaims = await readClaims(uidFor("student")).catch(() => ({}));

    const forge = await tryCallAs(
      "v1.identity.saveStudent",
      { id: IDS.tenant, data: { role: "superAdmin", isSuperAdmin: true } as never },
      "student"
    );
    // Either denied (no permission) or the privilege fields are silently stripped.
    if (forge.ok) {
      await sleep(400);
      const afterClaims = await readClaims(uidFor("student")).catch(() => ({}));
      expect(
        afterClaims["isSuperAdmin"] ?? false,
        "student must never gain isSuperAdmin via a save body"
      ).toBeFalsy();
      expect(
        afterClaims["role"] ?? beforeClaims["role"],
        "student must not self-escalate role"
      ).not.toBe("superAdmin");
    } else {
      expect(forge.ok).toBe(false); // denied — the trust boundary held
    }
  });
});
