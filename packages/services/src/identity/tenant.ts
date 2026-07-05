/**
 * Tenant lifecycle + provisioning services (identity.md). `saveTenant` is
 * super-admin; it consumes an inbound `geminiApiKey` into Secret Manager and
 * DELETES it from the doc before any write (SEC-09). `deactivate/reactivateTenant`
 * are lifecycle transitions (assertTransition('tenant', …)) with outbox revoke
 * fan-out. `lookupTenantByCode` is the one PUBLIC read.
 *
 * `tenantId` for tenant-scoped ops comes from `ctx`; super-admin cross-tenant
 * arrives via the resolved `ctx.tenantId` (the adapter applied `tenantOverride`).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize, assertTransition } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { enqueueOutboxEvent } from "../shared/side-effects.js";
import { xrepos } from "../shared/extended-repos.js";
import { provisionMembership } from "./provision-membership.js";

/** Trial window granted to a freshly-created tenant (days). Product knob. */
const TRIAL_DAYS = 14;

/** URL-safe slug from a display name (server-derived when the caller omits `slug`). */
function slugify(source: string): string {
  return (
    source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tenant"
  );
}

/**
 * Generate a join code that is unique against the `tenantCodes/{code}` index.
 * Deterministic for a given seed + index state (fixed-clock testable): derives a
 * compact alphanumeric base from the seed and suffixes a counter until free.
 */
async function generateUniqueTenantCode(
  seed: string,
  resolveCode: (code: string) => Promise<string | null>
): Promise<string> {
  const base =
    seed
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "TENANT";
  let candidate = base;
  let n = 1;
  while (await resolveCode(candidate)) {
    n += 1;
    candidate = `${base}${n}`;
  }
  return candidate;
}

// ── saveTenant (super-admin; SEC-09 gemini key ingest) ────────────────────────
export async function saveTenantService(
  input: ReqOf<"v1.identity.saveTenant">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveTenant">> {
  authorize(ctx, "tenant.create", {});

  const data = { ...(input.data as Record<string, unknown>) };

  // SEC-09: pull the inbound key OUT of the doc now (it is never persisted). The
  // Secret Manager write is deferred until AFTER the tenant id is allocated, so the
  // secret is owned by the REAL created tenantId — a create-without-id used to fall
  // back to the non-existent `data['code']` → 'pending', orphaning the secret ref.
  const geminiApiKey =
    typeof data["geminiApiKey"] === "string" && data["geminiApiKey"]
      ? (data["geminiApiKey"] as string)
      : null;
  delete data["geminiApiKey"];

  if (input.delete && input.id) {
    const existing = await ctx.repos.tenants.get(input.id, input.id);
    const from = (existing?.["status"] as string | undefined) ?? "trial";
    assertTransition("tenant", from, "deactivated");
    await ctx.repos.tenants.upsert(
      input.id,
      { ...(existing ?? {}), id: input.id, status: "deactivated" },
      ctx.now()
    );
    return { id: input.id, deleted: true } as ResOf<"v1.identity.saveTenant">;
  }

  // CREATE vs UPDATE — determined BEFORE the write so create-only provisioning
  // (owner membership, join-code index, trial clock) never re-runs on an update.
  // An update always carries `input.id`; a create-without-id has no existing doc
  // and lets the repo allocate a fresh id at write time.
  const providedId = input.id as string | undefined;
  const existing = providedId ? await ctx.repos.tenants.get(providedId, providedId) : null;
  const isCreate = !existing;

  const codeRepo = ctx.repos.tenants as unknown as {
    resolveCode(code: string): Promise<string | null>;
    writeCode(code: string, tenantId: string, ts?: string): Promise<void>;
  };
  const resolveCode = (code: string): Promise<string | null> => codeRepo.resolveCode(code);

  const tenantWrite: Record<string, unknown> = {
    ...data,
    ...(input.id ? { id: input.id } : {}),
    updatedBy: ctx.uid,
  };

  // INVARIANT (Core ruling): every created tenant ends with BOTH `slug` and a
  // resolvable `tenantCode` set + the `tenantCodes/{code}` index written. The
  // domain entity requires both non-optional; the request makes them optional, so
  // the SERVER derives them here (slug from name, tenantCode generated-unique) when
  // absent. An explicit code is uniqueness-checked before any write.
  let tenantCode: string | undefined;
  if (isCreate) {
    const nameSeed = String(data["name"] ?? providedId ?? "tenant");
    const explicitCode = (data["tenantCode"] as string | undefined)?.trim();
    if (explicitCode) {
      const owner = await resolveCode(explicitCode);
      if (owner && owner !== providedId) {
        fail("ALREADY_EXISTS", `tenant code ${explicitCode} is already in use`);
      }
      tenantCode = explicitCode;
    } else {
      tenantCode = await generateUniqueTenantCode(nameSeed, resolveCode);
    }

    const trialEndsAt = new Date(
      Date.parse(ctx.now()) + TRIAL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    tenantWrite["ownerUid"] = ctx.uid;
    tenantWrite["createdBy"] = ctx.uid;
    tenantWrite["tenantCode"] = tenantCode;
    tenantWrite["slug"] = (data["slug"] as string | undefined)?.trim() || slugify(nameSeed);
    tenantWrite["status"] = (data["status"] as string | undefined) ?? "trial";
    tenantWrite["trialEndsAt"] = trialEndsAt;
    tenantWrite["subscription"] = {
      plan: (data["plan"] as string | undefined) ?? "trial",
      renewsAt: null,
    };
  }

  // Routing arg is only used to pick the top-level `tenants` collection (any non-
  // platform id does); the created id is allocated by the repo when absent.
  const { id, created } = await ctx.repos.tenants.upsert(
    providedId ?? tenantCode ?? "tenant",
    tenantWrite,
    ctx.now()
  );

  // SEC-09: ingest the Gemini key into Secret Manager NOW that the real tenantId
  // exists (owner = the created `id`, never a code, never 'pending'), record the
  // ref, and stamp `geminiKeyRef` on the tenant doc. The secret name the writer
  // produces is exactly what the AI resolver reads back (`tenant-{id}-gemini`).
  if (geminiApiKey) {
    const { secretRef } = await xrepos(ctx).secrets.put(id, geminiApiKey);
    await ctx.repos.tenants.upsert(id, { id, geminiKeyRef: secretRef }, ctx.now());
    await ctx.repos.audit.write(id, {
      action: "tenant.ai.key.write",
      actorUid: ctx.uid,
      at: ctx.now(),
    });
  }

  // On CREATE only: publish the public join-code index + provision the creating
  // user's OWNER (tenantAdmin) membership + claims, so v1 onboarding resolves
  // end-to-end (lookupTenantByCode / joinTenant find the tenant; the creator can
  // act as tenantAdmin). Mirrors the createOrgUser saga.
  if (isCreate && tenantCode) {
    await codeRepo.writeCode(tenantCode, id, ctx.now());

    // Owner membership + claims via the single provisioning factory. tenantAdmin
    // has no entity doc, so no entityIds. `isSuperAdmin` is preserved so a super-
    // admin onboarding a school is not demoted by the minted tenantAdmin claim.
    await provisionMembership(
      {
        uid: ctx.uid,
        tenantId: id,
        tenantCode,
        role: "tenantAdmin",
        joinSource: "admin_created",
      },
      ctx,
      { isSuperAdmin: ctx.isSuperAdmin }
    );
  }

  return { id, created } as ResOf<"v1.identity.saveTenant">;
}

// ── deactivateTenant ──────────────────────────────────────────────────────────
export async function deactivateTenantService(
  input: ReqOf<"v1.identity.deactivateTenant">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.deactivateTenant">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenant.lifecycle", { tenantId });

  const existing = await ctx.repos.tenants.get(tenantId, tenantId);
  const from = (existing?.["status"] as string | undefined) ?? "active";
  assertTransition("tenant", from, "deactivated");

  const now = ctx.now();
  await ctx.repos.tx(async (tx) => {
    tx.upsert("tenants", tenantId, {
      id: tenantId,
      status: "deactivated",
      deactivationReason: input.reason ?? null,
    });
    // Outbox revoke fan-out: every member's refresh tokens revoked reliably.
    enqueueOutboxEvent(tx, {
      type: "notification.emit",
      tenantId,
      payload: { kind: "tenant.deactivated", tenantId, reason: input.reason ?? null },
      createdAt: now,
    });
  });
  return { tenantId, status: "deactivated" } as ResOf<"v1.identity.deactivateTenant">;
}

// ── reactivateTenant ──────────────────────────────────────────────────────────
export async function reactivateTenantService(
  input: ReqOf<"v1.identity.reactivateTenant">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.reactivateTenant">> {
  void input;
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenant.lifecycle", { tenantId });
  const existing = await ctx.repos.tenants.get(tenantId, tenantId);
  const from = (existing?.["status"] as string | undefined) ?? "deactivated";
  assertTransition("tenant", from, "active");
  await ctx.repos.tenants.upsert(tenantId, { id: tenantId, status: "active" }, ctx.now());
  return { tenantId, status: "active" } as ResOf<"v1.identity.reactivateTenant">;
}

// ── lookupTenantByCode (PUBLIC) ───────────────────────────────────────────────
export async function lookupTenantByCodeService(
  input: ReqOf<"v1.identity.lookupTenantByCode">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.lookupTenantByCode">> {
  // public callable — no authorize; resolve the code index server-side, then read
  // the (top-level) tenant doc and project to the public view (TenantPublicView).
  const codeRepo = ctx.repos.tenants as unknown as {
    resolveCode(code: string): Promise<string | null>;
  };
  const tenantId = (await codeRepo.resolveCode(input.tenantCode)) ?? input.tenantCode;
  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  if (!tenant) fail("NOT_FOUND", `no tenant for code ${input.tenantCode}`);
  return {
    tenantId: tenant["id"],
    name: tenant["name"],
    status: tenant["status"],
    // Pre-auth trial-expiry signal: the app login gates allow status='trial'
    // until this passes (evaluateTenantAccess in @levelup/domain).
    ...(tenant["trialEndsAt"] !== undefined ? { trialEndsAt: tenant["trialEndsAt"] } : {}),
    ...(tenant["branding"] ? { branding: tenant["branding"] } : {}),
  } as unknown as ResOf<"v1.identity.lookupTenantByCode">;
}

// ── exportTenantData ──────────────────────────────────────────────────────────
export async function exportTenantDataService(
  input: ReqOf<"v1.identity.exportTenantData">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.exportTenantData">> {
  void input;
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenant.export", { tenantId });
  // The actual export is a Cloud-Tasks job; here we enqueue + return a signed URL stub.
  const now = ctx.now();
  const expiresAt = new Date(Date.parse(now) + 10 * 60 * 1000).toISOString();
  await ctx.repos.tx(async (tx) => {
    enqueueOutboxEvent(tx, {
      type: "notification.emit",
      tenantId,
      payload: { kind: "export.requested" },
      createdAt: now,
    });
  });
  return { downloadUrl: "", expiresAt } as unknown as ResOf<"v1.identity.exportTenantData">;
}

// ── uploadTenantAsset ─────────────────────────────────────────────────────────
export async function uploadTenantAssetService(
  input: ReqOf<"v1.identity.uploadTenantAsset">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.uploadTenantAsset">> {
  void input;
  const tenantId = requireTenant(ctx);
  authorize(ctx, "tenant.asset.upload", { tenantId });
  // Path-scoped to tenants/{ctx.tenantId}/… by the storage layer; return the asset URL.
  return {
    assetUrl: `tenants/${tenantId}/assets/pending`,
  } as unknown as ResOf<"v1.identity.uploadTenantAsset">;
}
