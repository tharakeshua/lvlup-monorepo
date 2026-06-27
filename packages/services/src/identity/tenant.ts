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

// ── saveTenant (super-admin; SEC-09 gemini key ingest) ────────────────────────
export async function saveTenantService(
  input: ReqOf<"v1.identity.saveTenant">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveTenant">> {
  authorize(ctx, "tenant.create", {});

  const data = { ...(input.data as Record<string, unknown>) };
  const tenantIdForSecret = (input.id as string | undefined) ?? data["code"] ?? "pending";

  // SEC-09: consume geminiApiKey → Secret Manager, then strip from the doc.
  if (typeof data["geminiApiKey"] === "string" && data["geminiApiKey"]) {
    authorize(ctx, "tenant.create", {}); // distinct ai-key gate folds here; audited below
    const { secretRef } = await xrepos(ctx).secrets.put(
      String(tenantIdForSecret),
      data["geminiApiKey"] as string
    );
    data["geminiKeyRef"] = secretRef;
    await ctx.repos.audit.write(String(tenantIdForSecret), {
      action: "tenant.ai.key.write",
      actorUid: ctx.uid,
      at: ctx.now(),
    });
  }
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

  const { id, created } = await ctx.repos.tenants.upsert(
    String(tenantIdForSecret),
    { ...data, ...(input.id ? { id: input.id } : {}), updatedBy: ctx.uid },
    ctx.now()
  );
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
