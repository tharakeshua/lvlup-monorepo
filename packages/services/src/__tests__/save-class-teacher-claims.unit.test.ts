/**
 * saveClass → teacher claims sync unit test (IDN-6 / P2-I).
 *
 * Proves the fix for the E2E-1 stage-2 evidence where assigning a teacher to a
 * class via `saveClass({ teacherIds })` did NOT propagate into the teacher's
 * auth claims (`claims.classIds` stayed `[]`), silently killing class-scoped
 * access (rules + reads gate on `token.classIds`). `saveClassService` now diffs
 * the roster old-vs-new and funnels every affected teacher through the single
 * `syncMembershipClaims` primitive (membership doc = derivation source):
 *   • create/update with ADDED teachers → each teacher's `membership.classIds`
 *     and minted `claims.classIds` contain the class (existing classes kept),
 *   • REMOVED teachers → the class is dropped from membership + claims and the
 *     teacher's refresh tokens are revoked (privilege narrowing, trigger
 *     downgrade semantics),
 *   • a no-op update (same roster / `teacherIds` omitted) re-mints nothing,
 *   • teachers with no auth account or membership are skipped without aborting.
 *
 * Uses the same hand-rolled in-memory repo + fake ctx harness as
 * `org-users.unit.test.ts` (no emulator).
 */
import { describe, it, expect } from "vitest";
import { saveClassService } from "../identity/save-entities";
import type { AuthContext } from "../shared/context";

type Doc = Record<string, unknown>;

const CLOCK = "2026-07-04T00:00:00.000Z";
const TENANT = "tenant_test";

/** In-memory stand-in for the classes + teachers + memberships + claims repos. */
function makeFakeRepos() {
  const classes = new Map<string, Doc>(); // classId -> class doc
  const teachers = new Map<string, Doc>(); // teacherId -> entity doc
  const memberships = new Map<string, Doc>(); // `${uid}_${tid}` -> membership doc
  const claims = new Map<string, Doc>(); // uid -> custom claims
  const revoked = new Set<string>();
  let claimWrites = 0;
  let classSeq = 0;
  const now = () => CLOCK;

  const repos = {
    classes: {
      async get(_t: string, id: string): Promise<Doc | null> {
        return classes.get(id) ?? null;
      },
      async getMany(_t: string, ids: string[]): Promise<Doc[]> {
        return ids.map((id) => classes.get(id)).filter((d): d is Doc => !!d);
      },
      async upsert(_tid: string, data: Doc, ts: string = now()) {
        const id = (data["id"] as string | undefined) ?? `class_${++classSeq}`;
        const created = !classes.has(id);
        classes.set(id, { ...classes.get(id), ...data, id, updatedAt: ts });
        return { id, created };
      },
    },
    teachers: {
      async get(_t: string, id: string): Promise<Doc | null> {
        return teachers.get(id) ?? null;
      },
    },
    memberships: {
      async get(uid: string, tid: string): Promise<Doc | null> {
        return memberships.get(`${uid}_${tid}`) ?? null;
      },
      // Mirrors the admin adapter: `set(..., { merge: true })` over the existing doc.
      async upsert(uid: string, tid: string, data: Doc, ts: string = now()) {
        const key = `${uid}_${tid}`;
        const created = !memberships.has(key);
        memberships.set(key, { ...memberships.get(key), ...data, id: key, updatedAt: ts });
        return { id: key, created };
      },
    },
    claims: {
      async set(uid: string, c: Doc): Promise<void> {
        claimWrites++;
        claims.set(uid, c);
      },
      async get(uid: string): Promise<Doc | null> {
        return claims.get(uid) ?? null;
      },
      async revokeRefreshTokens(uid: string): Promise<void> {
        revoked.add(uid);
      },
    },
  };

  /** Seed one provisioned teacher: entity doc + active membership (+ optional classes). */
  function seedTeacher(teacherId: string, uid: string, classIds: string[] = []) {
    teachers.set(teacherId, { id: teacherId, authUid: uid, status: "active" });
    memberships.set(`${uid}_${TENANT}`, {
      id: `${uid}_${TENANT}`,
      uid,
      tenantId: TENANT,
      tenantCode: "SUB001",
      role: "teacher",
      status: "active",
      teacherId,
      classIds,
    });
  }

  return {
    repos,
    classes,
    teachers,
    memberships,
    claims,
    revoked,
    seedTeacher,
    claimWriteCount: () => claimWrites,
    now,
  };
}

/** Tenant-admin actor scoped to TENANT (passes `class.write` + `requireTenant`). */
function makeAdminCtx(repos: unknown, now: () => string): AuthContext {
  return {
    uid: "admin_1",
    isSuperAdmin: true,
    tenantId: TENANT,
    role: "superAdmin",
    permissions: null,
    staffPermissions: null,
    classIds: [],
    studentIds: [],
    entityIds: {},
    now,
    repos,
    ai: {},
  } as unknown as AuthContext;
}

type SaveClassInput = Parameters<typeof saveClassService>[0];

describe("saveClassService — teacherIds → teacher claims sync (IDN-6)", () => {
  it("create with teacherIds mints the class into each teacher's membership + claims", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);
    fx.seedTeacher("t1", "uid_t1");
    fx.seedTeacher("t2", "uid_t2", ["class_other"]);

    const res = await saveClassService(
      { data: { name: "9A", grade: "9", teacherIds: ["t1", "t2"] } } as SaveClassInput,
      ctx
    );
    expect(res.created).toBe(true);
    const classId = res.id as string;

    // Membership doc is the derivation source — the class landed on both.
    expect(fx.memberships.get(`uid_t1_${TENANT}`)!["classIds"]).toEqual([classId]);
    // Existing classes are KEPT (append, not clobber).
    expect(fx.memberships.get(`uid_t2_${TENANT}`)!["classIds"]).toEqual(["class_other", classId]);

    // Minted claims contain the class — the E2E-1 failure (`classIds: []`) is dead.
    expect(fx.claims.get("uid_t1")!["classIds"]).toEqual([classId]);
    expect(fx.claims.get("uid_t2")!["classIds"]).toEqual(["class_other", classId]);
    // Claim carries the rest of the membership projection untouched.
    expect(fx.claims.get("uid_t1")!["role"]).toBe("teacher");
    expect(fx.claims.get("uid_t1")!["teacherId"]).toBe("t1");
    // Adding access is not a downgrade → no token revocation.
    expect(fx.revoked.size).toBe(0);
  });

  it("update removing a teacher drops the class from membership + claims and revokes", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);
    fx.seedTeacher("t1", "uid_t1");
    fx.seedTeacher("t2", "uid_t2");

    const { id } = await saveClassService(
      { data: { name: "9A", grade: "9", teacherIds: ["t1", "t2"] } } as SaveClassInput,
      ctx
    );

    // Roster update: t2 is unassigned.
    await saveClassService(
      { id, data: { name: "9A", grade: "9", teacherIds: ["t1"] } } as SaveClassInput,
      ctx
    );

    // t2 lost the class in membership AND claims; refresh tokens revoked (SEC-05
    // narrowing — an old token keeping the class cannot linger).
    expect(fx.memberships.get(`uid_t2_${TENANT}`)!["classIds"]).toEqual([]);
    expect(fx.claims.get("uid_t2")!["classIds"]).toEqual([]);
    expect(fx.revoked.has("uid_t2")).toBe(true);

    // t1 keeps access, untouched by the removal.
    expect(fx.claims.get("uid_t1")!["classIds"]).toEqual([id]);
    expect(fx.revoked.has("uid_t1")).toBe(false);
  });

  it("no-op update (same roster) and omitted teacherIds re-mint nothing", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);
    fx.seedTeacher("t1", "uid_t1");

    const { id } = await saveClassService(
      { data: { name: "9A", grade: "9", teacherIds: ["t1"] } } as SaveClassInput,
      ctx
    );
    const writesAfterCreate = fx.claimWriteCount();
    expect(writesAfterCreate).toBe(1);

    // Same roster re-sent → idempotent, no claim churn.
    await saveClassService(
      { id, data: { name: "9A renamed", grade: "9", teacherIds: ["t1"] } } as SaveClassInput,
      ctx
    );
    expect(fx.claimWriteCount()).toBe(writesAfterCreate);

    // teacherIds omitted entirely → metadata-only update, roster untouched, no re-mint.
    await saveClassService({ id, data: { name: "9A again", grade: "9" } } as SaveClassInput, ctx);
    expect(fx.claimWriteCount()).toBe(writesAfterCreate);
    expect(fx.classes.get(id)!["teacherIds"]).toEqual(["t1"]);
    expect(fx.claims.get("uid_t1")!["classIds"]).toEqual([id]);
  });

  it("skips teachers with no auth account or membership without aborting the save", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);
    fx.seedTeacher("t_ok", "uid_ok");
    // t_noauth: entity doc but never provisioned (no authUid).
    fx.teachers.set("t_noauth", { id: "t_noauth", status: "active" });
    // t_nomem: auth account but no membership in this tenant.
    fx.teachers.set("t_nomem", { id: "t_nomem", authUid: "uid_nomem", status: "active" });

    const res = await saveClassService(
      {
        data: { name: "9A", grade: "9", teacherIds: ["t_noauth", "t_nomem", "t_ok", "t_missing"] },
      } as SaveClassInput,
      ctx
    );

    // The save succeeded and the provisioned teacher got the class.
    expect(res.created).toBe(true);
    expect(fx.claims.get("uid_ok")!["classIds"]).toEqual([res.id]);
    // Nothing was minted for the unprovisioned/missing ones (no membership → the
    // provisioning saga owns creation, this path never invents one).
    expect(fx.claims.has("uid_nomem")).toBe(false);
    expect(fx.memberships.has(`uid_nomem_${TENANT}`)).toBe(false);
    expect(fx.claims.size).toBe(1);
  });
});
