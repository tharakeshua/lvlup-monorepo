/**
 * `AuthContext` — the heart of the trust boundary (server-shared.md §2.2).
 *
 * Every service is `fn(input, ctx: AuthContext)`. The context carries the
 * claim-derived identity (NEVER a request-body tenantId), the injected clock,
 * and the injected `repos`/`ai` ports — so a service touches Firestore ONLY
 * through `ctx.repos` and LLMs ONLY through `ctx.ai`.
 *
 * `AuthContext` structurally satisfies `@levelup/access`'s `AccessContext`, so
 * `authorize(ctx, action, resource)` accepts it directly.
 */
import type {
  UserId,
  TenantId,
  ClassId,
  StudentId,
  TeacherId,
  ParentId,
  StaffId,
  ScannerId,
  Timestamp,
  TenantRole,
  TeacherPermissionKey,
  StaffPermissionKey,
} from "@levelup/domain";
import type { Repos, AiGateway, StorageSignerPort, PipelineEnqueuePort } from "./ports.js";

export interface AuthContext {
  uid: UserId | string;
  isSuperAdmin: boolean;
  /** From claims (active tenant) — NEVER from the request body (REVIEW D2/#1). */
  tenantId: TenantId | null;
  role: TenantRole | null;
  permissions: Partial<Record<TeacherPermissionKey, boolean>> | null;
  staffPermissions: Partial<Record<StaffPermissionKey, boolean>> | null;
  /** Overflow-resolved (see buildAuthContext fallback). */
  classIds: ClassId[];
  /** Parent → linked children. */
  studentIds: StudentId[];
  entityIds: {
    teacherId?: TeacherId;
    studentId?: StudentId;
    parentId?: ParentId;
    staffId?: StaffId;
    scannerId?: ScannerId;
  };
  idempotencyKey?: string;
  /** Set true on a constrained impersonation session (blocks re-impersonate/claims.sync). */
  impersonating?: boolean;
  /** Set true when tenantId came from a super-admin tenantOverride (audited by the adapter). */
  usedTenantOverride?: boolean;
  /** Injected clock — server-authoritative, testable (ISO-8601 string). */
  now: () => Timestamp;
  /** Injected admin repos; services touch Firestore ONLY through this. */
  repos: Repos;
  /** Injected AI gateway; services call LLMs ONLY through this. */
  ai: AiGateway;
  /**
   * Signed-upload-URL hook (`requestUploadUrlService` reads `ctx.storage`).
   * Absent in emulator/unit tests → the service returns its stub-URL fallback.
   */
  storage?: StorageSignerPort;
  /**
   * Cloud Tasks pipeline-advance hook, ALREADY curried over this ctx's tenant
   * (`enqueuePipelineAdvance` in `@levelup/services` reads it as
   * `ctx.enqueuePipelineAdvance(submissionId, step)`). Absent in emulator/unit
   * tests → the reducer runs the step inline.
   */
  enqueuePipelineAdvance?: (submissionId: string, step: string) => Promise<void>;
}

/**
 * `SystemContext` — the trigger/scheduler/task actor (server-shared.md §2.9).
 * Super-admin-EQUIVALENT authority SCOPED to the triggering tenant, no
 * rate-limit/quota. `uid='<system>'` is what `@levelup/access` keys the
 * "system actor" branch on (cannot cross tenants).
 */
export type SystemContext = AuthContext & { readonly uid: "<system>" };

/** Build a SystemContext for a trigger/scheduler/task scoped to one tenant. */
export function makeSystemContext(
  tenantId: TenantId | null,
  deps: {
    repos: Repos;
    ai: AiGateway;
    clock?: () => Timestamp;
    storage?: StorageSignerPort;
    pipelineTasks?: PipelineEnqueuePort;
  }
): SystemContext {
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
    now: deps.clock ?? (() => new Date().toISOString() as Timestamp),
    repos: deps.repos,
    ai: deps.ai,
    storage: deps.storage,
    // Curry the enqueue port over THIS ctx's tenant so the services hook
    // signature stays `(submissionId, step)` while the task payload still
    // carries the tenant for the consumer-side SystemContext rebuild.
    enqueuePipelineAdvance: deps.pipelineTasks
      ? (submissionId, step) => deps.pipelineTasks!({ tenantId, submissionId, step })
      : undefined,
  };
}
