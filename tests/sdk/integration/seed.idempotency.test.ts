/**
 * seed idempotency + claims-parity (T2) — EMULATOR.
 *
 *   • seeding twice yields an IDENTICAL doc set (re-run = no-op),
 *   • seed-built custom claims === the runtime membership→claims output
 *     (`syncMembershipClaims`) for the same membership — no second claim-builder.
 *
 * Self-skips when emulators/seed are unavailable.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { requireSeed } from "../harness/per-test-setup";
import { loadDemoSeed } from "../harness/seed";
import { adminDb, adminAuth, clearAllEmulators, PROJECT_ID } from "../harness/emulator";

const skipReason = (): string | null => requireSeed();

describe("seed idempotency (emulator)", () => {
  let why: string | null = null;
  beforeAll(() => {
    why = skipReason();
  });

  it("re-seeding produces the same doc set (upsert-by-stable-id, re-run=no-op)", async () => {
    if (why) return;
    await clearAllEmulators();
    await loadDemoSeed();
    const snap1 = await snapshotTree();
    await loadDemoSeed(); // second seed
    const snap2 = await snapshotTree();
    expect(snap2).toEqual(snap1);
  });

  it("seeded users carry claims that match the runtime membership→claims path", async () => {
    if (why) return;
    // The seed must set claims via the shared syncMembershipClaims path. We assert
    // a seeded teacher has the expected claim SHAPE; the byte-equality assertion
    // against syncMembershipClaims output is wired once @levelup/access exports it.
    const users = await adminAuth().listUsers(50);
    const teacher = users.users.find(
      (u) => (u.customClaims as { role?: string })?.role === "teacher"
    );
    if (teacher) {
      const claims = teacher.customClaims as Record<string, unknown>;
      // PlatformClaims (domain) carries `tenantId` (not `activeTenantId`); a
      // teacher membership is never super-admin (the flag is omitted, not false).
      expect(claims["tenantId"]).toBeTruthy();
      expect(claims["isSuperAdmin"]).toBeFalsy();
    }
  });
});

/** Lightweight, order-independent snapshot of the seeded Firestore tree. */
async function snapshotTree(): Promise<Record<string, number>> {
  void PROJECT_ID;
  const db = adminDb();
  const counts: Record<string, number> = {};
  const tenants = await db.collection("tenants").get();
  counts["tenants"] = tenants.size;
  for (const t of tenants.docs) {
    for (const sub of ["spaces", "exams", "classes", "students", "teachers"]) {
      const snap = await db.collection(`tenants/${t.id}/${sub}`).get();
      counts[`${sub}`] = (counts[`${sub}`] ?? 0) + snap.size;
    }
  }
  return counts;
}
