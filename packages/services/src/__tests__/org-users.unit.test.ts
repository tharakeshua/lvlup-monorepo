/**
 * bulkImportStudents FULL-PROVISIONING unit test (IDN-2 — v1 bulk onboarding).
 *
 * Proves the fix for the v1 blocker where bulk-imported students got a student
 * ENTITY doc only — no Firebase Auth user, no membership, no claims — and so
 * could never log in. Each row now runs the SAME saga `createOrgUser` uses
 * (Auth user → entity → membership → claims), and:
 *   • an imported row mints an Auth user + an active `student` membership +
 *     synced claims (with `studentId`), and stamps `authUid` on the entity,
 *   • per-row error isolation — one bad row lands in `errors[]` and does NOT
 *     abort the batch (later rows still provision),
 *   • a re-import of the same email is an idempotent no-op counted as `skipped`
 *     (the Auth user is linked, not duplicated; one membership),
 *   • the response shape stays exactly `{ created, skipped, errors }`.
 *
 * Uses a hand-rolled in-memory repo + fake ctx (no emulator), mirroring
 * `tenant.unit.test.ts`, so it exercises the real service logic in isolation.
 */
import { describe, it, expect } from "vitest";
import { bulkImportStudentsService, bulkImportTeachersService } from "../identity/org-users";
import type { AuthContext } from "../shared/context";

type Doc = Record<string, unknown>;

const CLOCK = "2026-07-04T00:00:00.000Z";
const TENANT = "tenant_test";

/** In-memory stand-in for the tenants + students/teachers + users + memberships + claims repos. */
function makeFakeRepos() {
  const tenants = new Map<string, Doc>(); // tenantId -> tenant doc
  const students = new Map<string, Doc>(); // studentId -> entity doc
  const teachers = new Map<string, Doc>(); // teacherId -> entity doc
  const memberships = new Map<string, Doc>(); // `${uid}_${tid}` -> membership doc
  const claims = new Map<string, Doc>(); // uid -> custom claims
  const authByEmail = new Map<string, { id: string }>(); // email -> auth user
  const passwords = new Map<string, string | undefined>(); // uid -> password given at create
  const revoked = new Set<string>();
  let uidSeq = 0;
  let studentSeq = 0;
  let teacherSeq = 0;
  const now = () => CLOCK;

  // Seed the tenant so the service resolves a tenantCode (canonical field).
  tenants.set(TENANT, { id: TENANT, tenantCode: "SUB001" });

  const repos = {
    tenants: {
      async get(_t: string, id: string): Promise<Doc | null> {
        return tenants.get(id) ?? null;
      },
    },
    students: {
      async get(_t: string, id: string): Promise<Doc | null> {
        return students.get(id) ?? null;
      },
      async upsert(_tid: string, data: Doc, ts: string = now()) {
        // Sentinel used by the error-isolation test to fail exactly one row.
        if (data["firstName"] === "Bad") throw new Error("simulated bad row");
        const id = (data["id"] as string | undefined) ?? `student_${++studentSeq}`;
        const created = !students.has(id);
        students.set(id, { ...students.get(id), ...data, id, updatedAt: ts });
        return { id, created };
      },
    },
    teachers: {
      async get(_t: string, id: string): Promise<Doc | null> {
        return teachers.get(id) ?? null;
      },
      async upsert(_tid: string, data: Doc, ts: string = now()) {
        if (data["firstName"] === "Bad") throw new Error("simulated bad row");
        const id = (data["id"] as string | undefined) ?? `teacher_${++teacherSeq}`;
        const created = !teachers.has(id);
        teachers.set(id, { ...teachers.get(id), ...data, id, updatedAt: ts });
        return { id, created };
      },
    },
    users: {
      async get(uidOrEmail: string): Promise<Doc | null> {
        return authByEmail.get(uidOrEmail) ?? null;
      },
      async create(input: { email?: string; displayName?: string; password?: string }) {
        const uid = `uid_${++uidSeq}`;
        if (input.email) authByEmail.set(input.email, { id: uid });
        passwords.set(uid, input.password);
        return { uid };
      },
      async updateProfile(): Promise<void> {},
    },
    memberships: {
      async get(uid: string, tid: string): Promise<Doc | null> {
        return memberships.get(`${uid}_${tid}`) ?? null;
      },
      async upsert(uid: string, tid: string, data: Doc, ts: string = now()) {
        const key = `${uid}_${tid}`;
        const created = !memberships.has(key);
        memberships.set(key, { ...memberships.get(key), ...data, id: key, updatedAt: ts });
        return { id: key, created };
      },
    },
    claims: {
      async set(uid: string, c: Doc): Promise<void> {
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

  return {
    repos,
    tenants,
    students,
    teachers,
    memberships,
    claims,
    authByEmail,
    passwords,
    revoked,
    now,
  };
}

/** Extract the RFC-4180 quoted fields of one CSV line. */
function csvFields(line: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"]|"")*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) out.push(m[1]!.replace(/""/g, '"'));
  return out;
}

/** Super-admin actor scoped to TENANT (passes `user.bulkImport` + `requireTenant`). */
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

describe("bulkImportStudentsService — full provisioning (IDN-2)", () => {
  it("provisions Auth user + active student membership + synced claims per row", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);

    const res = (await bulkImportStudentsService(
      {
        rows: [
          {
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@school.edu",
            rollNumber: "R1",
            section: "A",
          },
        ],
        defaultClassIds: ["class_9a"],
      },
      ctx
    )) as { created: number; skipped: number; errors: unknown[] };

    expect(res.created).toBe(1);
    expect(res.skipped).toBe(0);
    expect(res.errors).toEqual([]);

    // (1) an Auth user was minted and linked by email.
    const auth = fx.authByEmail.get("ada@school.edu");
    expect(auth).toBeTruthy();
    const uid = auth!.id;

    // (2) student entity carries the authUid + role columns + default classIds.
    const student = [...fx.students.values()][0]!;
    expect(student["authUid"]).toBe(uid);
    expect(student["rollNumber"]).toBe("R1");
    expect(student["section"]).toBe("A");
    expect(student["classIds"]).toEqual(["class_9a"]);
    expect(student["status"]).toBe("active");

    // (3) an ACTIVE student membership links the entity via studentId.
    const membership = fx.memberships.get(`${uid}_${TENANT}`);
    expect(membership).toBeTruthy();
    expect(membership!["role"]).toBe("student");
    expect(membership!["status"]).toBe("active");
    expect(membership!["studentId"]).toBe(student["id"]);
    expect(membership!["tenantCode"]).toBe("SUB001");

    // (4) claims minted from the membership so the student can actually log in.
    const claim = fx.claims.get(uid)!;
    expect(claim).toBeTruthy();
    expect(claim["role"]).toBe("student");
    expect(claim["tenantId"]).toBe(TENANT);
    expect(claim["studentId"]).toBe(student["id"]);
  });

  it("isolates a bad row to errors[] without aborting the batch", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);

    const res = (await bulkImportStudentsService(
      {
        rows: [
          { firstName: "Grace", lastName: "Hopper", email: "grace@school.edu" },
          { firstName: "Bad", lastName: "Row", email: "bad@school.edu" }, // sentinel → throws
          { firstName: "Alan", lastName: "Turing", email: "alan@school.edu" },
        ],
      },
      ctx
    )) as { created: number; skipped: number; errors: { row: number; error: string }[] };

    // The good rows both provision; the bad row is isolated to errors[].
    expect(res.created).toBe(2);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]!.row).toBe(1);

    // Row 2 (after the failure) still ran → batch was NOT aborted.
    expect(fx.authByEmail.has("alan@school.edu")).toBe(true);
    // The bad row left NO membership/claims (its entity write failed first).
    expect(fx.memberships.size).toBe(2);
    expect(fx.claims.size).toBe(2);
  });

  it("re-import of the same email is an idempotent no-op counted as skipped", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);

    const rows = [{ firstName: "Edsger", lastName: "Dijkstra", email: "ed@school.edu" }];
    const first = (await bulkImportStudentsService({ rows }, ctx)) as {
      created: number;
      skipped: number;
    };
    const second = (await bulkImportStudentsService({ rows }, ctx)) as {
      created: number;
      skipped: number;
    };

    expect(first.created).toBe(1);
    expect(first.skipped).toBe(0);
    // Second run links the existing Auth user + upserts the same membership.
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);

    // No duplicate Auth user, exactly one membership.
    expect(fx.authByEmail.size).toBe(1);
    expect(fx.memberships.size).toBe(1);
  });

  it("returns the { created, skipped, errors } core shape with no dryRun/preview leak on commit", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);
    const res = (await bulkImportStudentsService(
      { rows: [{ firstName: "Katherine", lastName: "Johnson" }] },
      ctx
    )) as Doc;
    expect(res["created"]).toBe(1);
    expect(res["errors"]).toEqual([]);
    // A commit never echoes the simulation-only fields.
    expect(res["dryRun"]).toBeUndefined();
    expect(res["preview"]).toBeUndefined();
    // IDN-4: the row had no admin password → a credential was generated + delivered
    // via the signed-URL CSV, so `credentials` is the only addition to the core shape.
    expect(Object.keys(res).sort()).toEqual(["created", "credentials", "errors", "skipped"]);
  });
});

// ── IDN-4: dryRun simulation ──────────────────────────────────────────────────
describe("bulkImportStudentsService — dryRun (IDN-4)", () => {
  it("validates + projects every row with ZERO writes and echoes dryRun:true", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);

    const res = (await bulkImportStudentsService(
      {
        rows: [
          { firstName: "Ada", lastName: "Lovelace", email: "ada@school.edu" },
          { firstName: "Grace", lastName: "Hopper", email: "grace@school.edu" },
        ],
        dryRun: true,
      },
      ctx
    )) as {
      created: number;
      skipped: number;
      errors: unknown[];
      dryRun: boolean;
      preview: { row: number; outcome: string }[];
      credentials?: unknown;
    };

    // Echoed flag so a simulation can never be mistaken for a commit.
    expect(res.dryRun).toBe(true);
    // Accurate would-create projection.
    expect(res.created).toBe(2);
    expect(res.skipped).toBe(0);
    expect(res.errors).toEqual([]);
    expect(res.preview).toEqual([
      { row: 0, outcome: "create" },
      { row: 1, outcome: "create" },
    ]);
    // No credentials CSV is produced on a simulation.
    expect(res.credentials).toBeUndefined();

    // ZERO writes: no auth users, no entity docs, no memberships, no claims.
    expect(fx.authByEmail.size).toBe(0);
    expect(fx.students.size).toBe(0);
    expect(fx.memberships.size).toBe(0);
    expect(fx.claims.size).toBe(0);
  });

  it("projects an already-provisioned row as would-skip (still zero writes)", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);
    const row = { firstName: "Edsger", lastName: "Dijkstra", email: "ed@school.edu" };

    // Real import first so a membership exists.
    await bulkImportStudentsService({ rows: [row] }, ctx);
    const beforeMemberships = fx.memberships.size;
    const beforeStudents = fx.students.size;

    const res = (await bulkImportStudentsService({ rows: [row], dryRun: true }, ctx)) as {
      created: number;
      skipped: number;
      preview: { row: number; outcome: string }[];
    };

    expect(res.created).toBe(0);
    expect(res.skipped).toBe(1);
    expect(res.preview).toEqual([{ row: 0, outcome: "skip" }]);
    // The simulation added nothing on top of the real import.
    expect(fx.memberships.size).toBe(beforeMemberships);
    expect(fx.students.size).toBe(beforeStudents);
  });
});

// ── IDN-4: server-generated credentials via signed-URL CSV ────────────────────
describe("bulkImportStudentsService — credentials delivery (IDN-4)", () => {
  it("puts generated passwords in the CSV only — never in the response", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);

    // Capture the CSV + path the service hands the storage sink.
    let capturedCsv = "";
    let capturedPath = "";
    let capturedTtl = 0;
    (ctx as unknown as { storage: unknown }).storage = {
      async putCredentialsCsv(path: string, csv: string, ttlMs: number) {
        capturedPath = path;
        capturedCsv = csv;
        capturedTtl = ttlMs;
        return {
          url: `https://signed.example/${path}?sig=abc`,
          expiresAt: "2026-07-04T00:15:00.000Z",
        };
      },
    };

    const res = (await bulkImportStudentsService(
      { rows: [{ firstName: "Ada", lastName: "Lovelace", email: "ada@school.edu" }] },
      ctx
    )) as { created: number; credentials?: { url: string; expiresAt: string; count: number } };

    // A signed URL is returned; the CSV holds exactly one generated credential.
    expect(res.credentials).toBeTruthy();
    expect(res.credentials!.count).toBe(1);
    expect(res.credentials!.url).toContain("https://signed.example/");

    // Tenant-scoped, deny-all credentials path + short TTL (<= 15 min).
    expect(capturedPath.startsWith(`tenants/${TENANT}/credentials/`)).toBe(true);
    expect(capturedTtl).toBeLessThanOrEqual(15 * 60 * 1000);

    // The CSV carries the login id + a non-empty generated password.
    const dataLine = capturedCsv.trim().split("\n")[1]!;
    const [name, loginId, password] = csvFields(dataLine);
    expect(name).toBe("Ada Lovelace");
    expect(loginId).toBe("ada@school.edu");
    expect(password!.length).toBeGreaterThanOrEqual(6);

    // HARD constraint: the plaintext password appears NOWHERE in the callable
    // response payload (responses can land in audit / llmCallLogs).
    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain(password!);
    expect(serialized).not.toContain("password");
  });

  it("does NOT generate/deliver a credential when the admin supplies a password", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);

    let hookCalled = false;
    (ctx as unknown as { storage: unknown }).storage = {
      async putCredentialsCsv() {
        hookCalled = true;
        return { url: "x", expiresAt: "y" };
      },
    };

    const res = (await bulkImportStudentsService(
      {
        rows: [
          {
            firstName: "Alan",
            lastName: "Turing",
            email: "alan@school.edu",
            password: "SetByAdmin!1",
          },
        ],
      },
      ctx
    )) as { created: number; credentials?: unknown };

    expect(res.created).toBe(1);
    // Admin password wins → nothing generated, no CSV, no delivery.
    expect(hookCalled).toBe(false);
    expect(res.credentials).toBeUndefined();

    // The auth user was created with the admin-supplied password (not a generated one).
    const uid = fx.authByEmail.get("alan@school.edu")!.id;
    expect(fx.passwords.get(uid)).toBe("SetByAdmin!1");
  });
});

// ── IDN-4: bulkImportTeachers full provisioning via the shared saga ───────────
describe("bulkImportTeachersService — full provisioning (IDN-4)", () => {
  it("provisions Auth user + active teacher membership + synced claims per row", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);

    const res = (await bulkImportTeachersService(
      {
        rows: [
          {
            firstName: "Marie",
            lastName: "Curie",
            email: "marie@school.edu",
            subjects: ["Physics", "Chemistry"],
            department: "Science",
            phone: "555-0100",
          },
        ],
      },
      ctx
    )) as { created: number; skipped: number; errors: unknown[] };

    expect(res.created).toBe(1);
    expect(res.errors).toEqual([]);

    // (1) an Auth user was minted + linked by email.
    const auth = fx.authByEmail.get("marie@school.edu");
    expect(auth).toBeTruthy();
    const uid = auth!.id;

    // (2) teacher entity carries authUid + the role columns (phone/department/subjects).
    const teacher = [...fx.teachers.values()][0]!;
    expect(teacher["authUid"]).toBe(uid);
    expect(teacher["phone"]).toBe("555-0100");
    expect(teacher["department"]).toBe("Science");
    expect(teacher["subjects"]).toEqual(["Physics", "Chemistry"]);
    expect(teacher["status"]).toBe("active");

    // (3) an ACTIVE teacher membership linking the entity via teacherId.
    const membership = fx.memberships.get(`${uid}_${TENANT}`)!;
    expect(membership).toBeTruthy();
    expect(membership["role"]).toBe("teacher");
    expect(membership["status"]).toBe("active");
    expect(membership["teacherId"]).toBe(teacher["id"]);
    expect(membership["tenantCode"]).toBe("SUB001");

    // (4) claims minted so the teacher can actually log in.
    const claim = fx.claims.get(uid)!;
    expect(claim["role"]).toBe("teacher");
    expect(claim["tenantId"]).toBe(TENANT);
  });

  it("supports dryRun (zero writes) and credential delivery for generated passwords", async () => {
    const fx = makeFakeRepos();
    const ctx = makeAdminCtx(fx.repos, fx.now);

    // dryRun → zero writes.
    const dry = (await bulkImportTeachersService(
      {
        rows: [{ firstName: "Isaac", lastName: "Newton", email: "isaac@school.edu" }],
        dryRun: true,
      },
      ctx
    )) as { dryRun: boolean; created: number; preview: unknown[] };
    expect(dry.dryRun).toBe(true);
    expect(dry.created).toBe(1);
    expect(fx.authByEmail.size).toBe(0);
    expect(fx.teachers.size).toBe(0);

    // Real import with the storage sink → credentials delivered via CSV.
    let capturedCsv = "";
    (ctx as unknown as { storage: unknown }).storage = {
      async putCredentialsCsv(path: string, csv: string) {
        capturedCsv = csv;
        return { url: `https://signed.example/${path}`, expiresAt: "2026-07-04T00:15:00.000Z" };
      },
    };
    const res = (await bulkImportTeachersService(
      { rows: [{ firstName: "Isaac", lastName: "Newton", email: "isaac@school.edu" }] },
      ctx
    )) as { created: number; credentials?: { count: number } };

    expect(res.created).toBe(1);
    expect(res.credentials!.count).toBe(1);
    const password = csvFields(capturedCsv.trim().split("\n")[1]!)[2]!;
    expect(JSON.stringify(res)).not.toContain(password);
  });
});
