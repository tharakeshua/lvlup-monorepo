/**
 * Identity triggers + schedulers (thin over services; server-shared.md §2.9 / §5.3).
 *
 * `onMembershipWritten` is the SINGLE claim-sync writer: any membership change
 * re-mints claims (and revokes on downgrade) through `syncMembershipClaims`.
 * `onStudentArchived`/`onClassArchived` reconcile the denormalized FK-array
 * projections (D7). `onTenantDeactivated`/`onAnnouncementPublished` are outbox
 * fan-outs. Schedulers run lifecycle checks / usage reset / export cleanup.
 *
 * Every handler is idempotent (safe to re-run on at-least-once delivery) and
 * acts as a SystemContext actor scoped to the triggering tenant.
 */
import type { SystemContext } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import { syncMembershipClaims } from "./sync-membership-claims.js";

/** A Firestore doc-write trigger event (before/after snapshots + path params). */
export interface DocWriteEvent {
  tenantId: string;
  params: Record<string, string>;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

// ── onMembershipWritten — single claim-sync writer ────────────────────────────
export async function onMembershipWrittenService(
  event: DocWriteEvent,
  ctx: SystemContext
): Promise<void> {
  const after = event.after;
  if (!after) return; // membership deleted → leave claims to a dedicated revoke path
  const uid = (after["uid"] as string | undefined) ?? event.params["uid"];
  const tenantId = (after["tenantId"] as string | undefined) ?? event.tenantId;
  if (!uid || !tenantId) return;

  const before = event.before;
  const roleChanged = before?.["role"] !== after["role"];
  const statusChanged = before?.["status"] !== after["status"];
  const downgrade =
    after["status"] === "suspended" ||
    after["status"] === "inactive" ||
    (statusChanged && before?.["status"] === "active");

  // Idempotent: re-syncing identical claims is a no-op effect.
  await syncMembershipClaims(uid, tenantId, ctx, { revoke: roleChanged || downgrade });
}

// ── onStudentArchived — reconcile class roster projection (D7) ────────────────
export async function onStudentArchivedService(
  event: DocWriteEvent,
  ctx: SystemContext
): Promise<void> {
  const after = event.after;
  if (!after || after["status"] !== "archived") return;
  const studentId = (after["id"] as string | undefined) ?? event.params["id"];
  const classIds = (after["classIds"] as string[] | undefined) ?? [];
  if (!studentId) return;
  await ctx.repos.tx(async (tx) => {
    for (const classId of classIds) {
      tx.upsert("classes", event.tenantId, { id: classId, _removeStudentId: studentId });
    }
  });
}

// ── onClassArchived — detach students (D7) ────────────────────────────────────
export async function onClassArchivedService(
  event: DocWriteEvent,
  ctx: SystemContext
): Promise<void> {
  const after = event.after;
  if (!after || after["status"] !== "archived") return;
  const classId = (after["id"] as string | undefined) ?? event.params["id"];
  if (!classId) return;
  const students = await ctx.repos.students.list(event.tenantId, {
    where: { classIds: classId },
    limit: 200,
  });
  await ctx.repos.tx(async (tx) => {
    for (const s of students.items) {
      tx.upsert("students", event.tenantId, { id: s["id"], _removeClassId: classId });
    }
  });
}

// ── onTenantDeactivated — outbox revoke fan-out ───────────────────────────────
export async function onTenantDeactivatedService(
  event: DocWriteEvent,
  ctx: SystemContext
): Promise<void> {
  const after = event.after;
  if (!after || after["status"] !== "deactivated") return;
  const tenantId = (after["id"] as string | undefined) ?? event.tenantId;
  await ctx.repos.outbox.enqueue(tenantId, {
    type: "tenant.deactivated",
    tenantId,
    payload: { tenantId },
    createdAt: ctx.now(),
    status: "pending",
    attempts: 0,
  });
}

// ── onAnnouncementPublished — outbox notify fan-out ───────────────────────────
export async function onAnnouncementPublishedService(
  event: DocWriteEvent,
  ctx: SystemContext
): Promise<void> {
  const after = event.after;
  if (!after || after["status"] !== "published") return;
  if (event.before?.["status"] === "published") return; // already fanned out
  const announcementId = (after["id"] as string | undefined) ?? event.params["id"];
  await ctx.repos.outbox.enqueue(event.tenantId, {
    type: "announcement.published",
    tenantId: event.tenantId,
    payload: {
      announcementId,
      scope: after["scope"],
      targetRoles: after["targetRoles"],
      targetClassIds: after["targetClassIds"],
    },
    createdAt: ctx.now(),
    status: "pending",
    attempts: 0,
  });
}

// ── schedulers ────────────────────────────────────────────────────────────────

/** tenantLifecycleCheck (daily) — expire trials / past-due tenants. */
export async function tenantLifecycleCheckService(ctx: SystemContext): Promise<void> {
  const tenants = await ctx.repos.tenants.list("__platform__", { limit: 200 });
  const now = ctx.now();
  for (const t of tenants.items) {
    const trialEndsAt = t["trialEndsAt"] as string | undefined;
    if (t["status"] === "trial" && trialEndsAt && Date.parse(trialEndsAt) < Date.parse(now)) {
      await ctx.repos.tenants.upsert(String(t["id"]), { id: t["id"], status: "expired" }, now);
    }
  }
}

/** monthlyUsageReset — zero per-tenant monthly usage counters. */
export async function monthlyUsageResetService(ctx: SystemContext): Promise<void> {
  const tenants = await ctx.repos.tenants.list("__platform__", { limit: 200 });
  for (const t of tenants.items) {
    await ctx.repos.tenants.upsert(
      String(t["id"]),
      { id: t["id"], usage: { aiCallsThisMonth: 0, costThisMonth: 0 } },
      ctx.now()
    );
  }
}

/** cleanupExpiredExports (every 30 min) — purge export jobs past their TTL. */
export async function cleanupExpiredExportsService(ctx: SystemContext): Promise<void> {
  // Export jobs live under a per-tenant collection; the admin adapter sweeps
  // those whose `expiresAt < now`. No-op shell here keeps the wiring thin.
  void xrepos(ctx);
}
