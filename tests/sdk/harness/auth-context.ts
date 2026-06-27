/**
 * Per-test auth-context helpers for the SDK-rebuild suite.
 *
 * Two layers of "who is the caller", matching the plan's trust boundary:
 *
 *  1. CLIENT-SIDE / wire (emulator integration): mint a real signed-in session
 *     for a demo user via the Auth emulator so the `@levelup/transport-firebase`
 *     → callable path carries a genuine ID token with custom claims. Use
 *     `signInAsDemoUser(role)` / `mintIdToken(role)`.
 *
 *  2. SERVER-SIDE (service unit tests): build an `AuthContext` /`SystemContext`
 *     directly (no token) over the in-memory fakes, since `@levelup/services`
 *     is `fn(input, ctx)`. Use `makeAuthContext(...)` / `makeSystemContext(...)`.
 *     This is the cheap path the T5 per-rule policy table + service unit tests use.
 *
 * Claims are kept CONSISTENT with the runtime: a seeded user's custom claims are
 * set by `@levelup/seed` via the shared `syncMembershipClaims` path (T2). When we
 * need to mint claims directly in a test (server ctx, or a synthetic user), we go
 * through `buildClaimsForRole` which mirrors the `PlatformClaims` shape from
 * `@levelup/domain` — the validation phase swaps it for the real builder import.
 */
import { CONTRACT_TENANT_KEY, DEMO_USER_KEYS, FIXED_CLOCK_ISO, localSeedId } from "./fixtures-ids";
import type { DemoUserKey } from "./fixtures-ids";
import { createInMemoryRepos, type InMemoryRepos } from "../fakes/in-memory-repos";
import { createFakeAiGateway, type FakeAiGateway } from "../fakes/fake-ai-gateway";
import type { Auth as ClientAuth } from "firebase/auth";

/**
 * The CLIENT-SIDE helpers below talk to the Auth emulator + client Firebase SDK.
 * Those modules (`./emulator`, `firebase/auth`) are imported LAZILY so that the
 * SERVER-SIDE path (`makeAuthContext` / `makeSystemContext` — the in-memory,
 * no-emulator service-unit + policy-table harness) never pulls the client
 * `firebase/*` SDK into packages that only depend on `firebase-admin`
 * (e.g. `@levelup/services`, `@levelup/access`). Static-importing `./emulator`
 * here would force-load `firebase/app` in those unit suites and break resolution.
 */

export type Role =
  | "superAdmin"
  | "tenantAdmin"
  | "teacher"
  | "student"
  | "parent"
  | "staff"
  | "scanner";

/**
 * PlatformClaims shape (mirror of `@levelup/domain` PlatformClaims — REVIEW §6.2).
 * `isSuperAdmin` is a CLAIM (no `/users` get in rules).
 */
export interface TestClaims {
  isSuperAdmin: boolean;
  activeTenantId: string | null;
  role: Role | null;
  permissions?: Record<string, boolean>;
  staffPermissions?: Record<string, boolean>;
  classIds?: string[];
  studentIds?: string[]; // parent → linked children
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  staffId?: string;
  scannerId?: string;
}

const TENANT_ID = localSeedId("tenant", CONTRACT_TENANT_KEY);

function uidForRole(role: Role): string {
  const key = DEMO_USER_KEYS[role];
  return localSeedId("uid", key);
}

/**
 * Build a deterministic PlatformClaims for a role in the contract tenant.
 * Mirrors the runtime membership→claims mapping; swap for the real
 * `syncMembershipClaims`/`buildPlatformClaims` once `@levelup/access` lands.
 */
export function buildClaimsForRole(role: Role, overrides: Partial<TestClaims> = {}): TestClaims {
  const base: TestClaims = {
    isSuperAdmin: role === "superAdmin",
    activeTenantId: role === "superAdmin" ? null : TENANT_ID,
    role,
    classIds: [],
    studentIds: [],
  };
  switch (role) {
    case "teacher":
      base.classIds = [localSeedId("class", "10a")];
      base.teacherId = localSeedId("teacher", DEMO_USER_KEYS.teacher);
      base.permissions = { canGrade: true, canAuthorContent: true };
      break;
    case "student":
      base.studentId = localSeedId("student", DEMO_USER_KEYS.student);
      break;
    case "parent":
      base.parentId = localSeedId("parent", DEMO_USER_KEYS.parent);
      // linked child — both id forms (the CLAIM form the analytics summaries key on,
      // and the SHORT form the contract fixtures reference) so the parent gate
      // (`studentId ∈ ctx.studentIds`) resolves either.
      base.studentIds = [
        localSeedId("student", DEMO_USER_KEYS.student),
        localSeedId("student", "sam"),
      ];
      break;
    case "staff":
      base.staffId = localSeedId("staff", DEMO_USER_KEYS.staff);
      base.staffPermissions = { canManageContent: true };
      break;
    case "scanner":
      base.scannerId = localSeedId("scanner", DEMO_USER_KEYS.scanner);
      base.classIds = [localSeedId("class", "10a")];
      break;
    default:
      break;
  }
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// (1) CLIENT-SIDE — real Auth-emulator session for the transport→callable path
// ---------------------------------------------------------------------------

/**
 * Ensure a demo user exists in the Auth emulator with the right custom claims,
 * then mint a custom token the client SDK can exchange. Returns the uid + claims.
 *
 * In emulator mode the Admin SDK can set claims + create the user directly; the
 * client exchanges a custom token (no password roundtrip needed).
 */
export async function ensureDemoAuthUser(
  role: Role,
  overrides: Partial<TestClaims> = {}
): Promise<{ uid: string; claims: TestClaims }> {
  const uid = uidForRole(role);
  const claims = buildClaimsForRole(role, overrides);
  const { adminAuth } = await import("./emulator");
  const auth = adminAuth();
  try {
    await auth.getUser(uid);
  } catch {
    await auth.createUser({
      uid,
      email: `${DEMO_USER_KEYS[role]}@${CONTRACT_TENANT_KEY}.test`,
      emailVerified: true,
      displayName: DEMO_USER_KEYS[role],
    });
  }
  // PlatformClaims live as custom claims (Firebase requires JSON-serializable).
  await auth.setCustomUserClaims(uid, claims as unknown as Record<string, unknown>);
  return { uid, claims };
}

/** Sign the client SDK in as a demo user (custom-token exchange). Returns the ID token. */
export async function signInAsDemoUser(
  role: Role,
  overrides: Partial<TestClaims> = {}
): Promise<{ uid: string; idToken: string; auth: ClientAuth }> {
  const { uid } = await ensureDemoAuthUser(role, overrides);
  const { adminAuth, clientAuthHandle, settleFunctionsAuthToken } = await import("./emulator");
  const { signInWithCustomToken } = await import("firebase/auth");
  const customToken = await adminAuth().createCustomToken(uid, { _role: role });
  const auth = clientAuthHandle();
  const cred = await signInWithCustomToken(auth, customToken);
  const idToken = await cred.user.getIdToken(/* forceRefresh */ true);
  // SETTLE the auth-internal interop the Firebase Functions client SDK reads the
  // caller's token from. The Functions SDK does NOT force-refresh; it reads that
  // provider's cached token, which updates via an internal `onIdTokenChanged`
  // listener lagging `signInWithCustomToken` by an event-loop turn. On rapid ROLE
  // SWITCHES (teacher→student in released-gating; superAdmin/public→student in the
  // identity suite) the PRIOR caller's token can bleed into the next call, so the
  // server derives the wrong identity/tenant → flaky "not your submission" /
  // "not a linked child" / "space not found" denials (a cross-CALL race, not
  // cross-file). `settleFunctionsAuthToken` drives that exact provider to the new
  // uid before we return, making every subsequent call deterministic.
  await settleFunctionsAuthToken(uid);
  return { uid, idToken, auth };
}

/** Email/password sign-in for suites that prefer the credential path (parity with e2e auth helper). */
export async function signInWithCredentials(
  email: string,
  password: string
): Promise<{ uid: string; idToken: string }> {
  const { clientAuthHandle } = await import("./emulator");
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const auth = clientAuthHandle();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return { uid: cred.user.uid, idToken: await cred.user.getIdToken(true) };
}

/** Mint just an ID token for a role (forces a fresh token so new claims apply). */
export async function mintIdToken(
  role: Role,
  overrides: Partial<TestClaims> = {}
): Promise<string> {
  const { idToken } = await signInAsDemoUser(role, overrides);
  return idToken;
}

export async function signOutClient(): Promise<void> {
  const { clientAuthHandle, settleFunctionsAuthToken } = await import("./emulator");
  const { signOut } = await import("firebase/auth");
  await signOut(clientAuthHandle()).catch(() => undefined);
  // Drive the auth-internal interop to "no user" so a subsequent `public` call
  // can't carry a bled token from the previously signed-in caller.
  await settleFunctionsAuthToken("").catch(() => undefined);
}

// ---------------------------------------------------------------------------
// (2) SERVER-SIDE — direct AuthContext over in-memory fakes (service unit tests)
// ---------------------------------------------------------------------------

/**
 * The server `AuthContext` the services consume (mirror of
 * server-shared.md §2.2). `now` is the injected fixed clock; `repos`/`ai` are the
 * in-memory fakes. This is what `makeAuthContext(role)` returns so a test can call
 * `saveSpaceService(input, ctx)` with no emulator.
 */
export interface TestAuthContext {
  uid: string;
  isSuperAdmin: boolean;
  tenantId: string | null;
  role: Role | null;
  permissions: Record<string, boolean> | null;
  staffPermissions: Record<string, boolean> | null;
  classIds: string[];
  studentIds: string[];
  entityIds: {
    teacherId?: string;
    studentId?: string;
    parentId?: string;
    staffId?: string;
    scannerId?: string;
  };
  idempotencyKey?: string;
  now: () => string;
  repos: InMemoryRepos;
  ai: FakeAiGateway;
}

export interface MakeCtxOptions {
  tenantOverride?: string; // honored only when isSuperAdmin (audited)
  idempotencyKey?: string;
  clockIso?: string;
  repos?: InMemoryRepos;
  ai?: FakeAiGateway;
  claimsOverride?: Partial<TestClaims>;
}

export function makeAuthContext(role: Role, opts: MakeCtxOptions = {}): TestAuthContext {
  const claims = buildClaimsForRole(role, opts.claimsOverride);
  const isSuperAdmin = claims.isSuperAdmin;
  // super-admin tenantOverride is the ONLY way a tenant id arrives off-claim.
  const tenantId = isSuperAdmin
    ? (opts.tenantOverride ?? claims.activeTenantId)
    : claims.activeTenantId;
  const clockIso = opts.clockIso ?? FIXED_CLOCK_ISO;
  return {
    uid: uidForRole(role),
    isSuperAdmin,
    tenantId,
    role: claims.role,
    permissions: claims.permissions ?? null,
    staffPermissions: claims.staffPermissions ?? null,
    classIds: claims.classIds ?? [],
    studentIds: claims.studentIds ?? [],
    entityIds: {
      teacherId: claims.teacherId,
      studentId: claims.studentId,
      parentId: claims.parentId,
      staffId: claims.staffId,
      scannerId: claims.scannerId,
    },
    idempotencyKey: opts.idempotencyKey,
    now: () => clockIso,
    repos: opts.repos ?? createInMemoryRepos({ now: () => clockIso }),
    ai: opts.ai ?? createFakeAiGateway(),
  };
}

/**
 * SystemContext — the trigger/scheduler/task actor (server-shared.md §3): superadmin-
 * equivalent authority SCOPED to the triggering tenant, no rate-limit/quota.
 * The T5 `system-context.test.ts` asserts it cannot cross tenants.
 */
export function makeSystemContext(tenantId: string, opts: MakeCtxOptions = {}): TestAuthContext {
  const clockIso = opts.clockIso ?? FIXED_CLOCK_ISO;
  return {
    uid: "<system>",
    isSuperAdmin: true,
    tenantId,
    role: null,
    permissions: null,
    staffPermissions: null,
    classIds: [],
    studentIds: [],
    entityIds: {},
    idempotencyKey: opts.idempotencyKey,
    now: () => clockIso,
    repos: opts.repos ?? createInMemoryRepos({ now: () => clockIso }),
    ai: opts.ai ?? createFakeAiGateway(),
  };
}

/** Named fixed-clock helper (testability.md T6 — `fixedClock(iso)`). */
export function fixedClock(iso: string = FIXED_CLOCK_ISO): () => string {
  return () => iso;
}
