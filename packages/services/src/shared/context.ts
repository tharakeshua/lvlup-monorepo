/**
 * The `AuthContext` / `SystemContext` shapes every service in `@levelup/services`
 * consumes (server-shared.md §2.2 / §3). Declared STRUCTURALLY here — NOT imported
 * from `@levelup/functions-shared`, which sits ABOVE this package. The real
 * `AuthContext` built by `buildAuthContext` (functions-shared) and the server-side
 * test harness `TestAuthContext` both structurally satisfy this.
 *
 * A service is `fn(input, ctx: AuthContext): Promise<output>` — it never imports
 * `firebase-functions`/`firebase-admin`. `tenantId` comes from `ctx` (claims),
 * NEVER from `input` (REVIEW D2 / #1 boundary). All data access is `ctx.repos.*`,
 * all LLM access is `ctx.ai.*`, all clock reads are `ctx.now()`.
 */
import type { TenantRole } from "@levelup/domain";
import type { Repos } from "../repo-admin/types.js";
import type { AiGateway } from "./ai.js";

/** Entity-id bag derived from claims (which membership doc the caller is). */
export interface EntityIds {
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  staffId?: string;
  scannerId?: string;
}

/**
 * The server `AuthContext`. `tenantId` is claim-derived (super-admin
 * `tenantOverride` is the ONLY off-claim path, resolved before the service runs).
 */
export interface AuthContext {
  uid: string;
  isSuperAdmin: boolean;
  tenantId: string | null;
  /** Active membership role from claims (TenantRole satisfies @levelup/access's AccessContext). */
  role: TenantRole | null;
  permissions: Record<string, boolean> | null;
  staffPermissions: Record<string, boolean> | null;
  classIds: string[];
  studentIds: string[];
  entityIds: EntityIds;
  idempotencyKey?: string;
  /** Injected server-authoritative clock (ISO-8601 string). */
  now: () => string;
  /** Injected admin repos — the ONLY Firestore handle a service sees. */
  repos: Repos;
  /** Injected AI gateway — the ONLY LLM handle a service sees. */
  ai: AiGateway;
  /** Set on a constrained impersonation session. */
  impersonating?: boolean;
}

/**
 * SystemContext — the trigger/scheduler/task actor: super-admin-equivalent
 * authority SCOPED to the triggering tenant, no rate-limit/quota. `uid='<system>'`.
 */
export type SystemContext = AuthContext;

/** Assert a tenant is present on the ctx; narrows `string | null` → `string`. */
export function requireTenant(ctx: AuthContext): string {
  if (!ctx.tenantId) {
    throw new ServiceError("TENANT_REQUIRED", "No active tenant on the auth context");
  }
  return ctx.tenantId;
}

/**
 * Transport-neutral service error. `functions-shared`'s `mapError` (and the test
 * harness) translate this to an `HttpsError`. Mirrors `@levelup/access`'s
 * `AccessError` so both throw the same wire-shape.
 */
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public meta?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function fail(code: string, message: string, meta?: Record<string, unknown>): never {
  throw new ServiceError(code, message, meta);
}
