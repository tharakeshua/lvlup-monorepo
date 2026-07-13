/**
 * Notification + announcement + preference + device services (notification.md).
 *
 * `emitNotificationService` is THE 4-copy consolidation — the SINGLE notification
 * creator + badge writer (REVIEW §6.9). `markNotificationReadService` is the only
 * counter writer for the recipient's own read-state. Announcements are
 * lifecycle-transitioned (assertTransition('announcement', …)); their read-state
 * is the owner-write `/reads/{uid}` subcollection. NO request carries `tenantId`.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize, assertTransition } from "@levelup/access";
import type { AuthContext, SystemContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import { projectNotification } from "../shared/projections.js";

type Doc = Record<string, unknown>;

// ── emitNotificationService (server-only; THE single creator + badge writer) ──
export interface EmitNotificationInput {
  tenantId: string;
  recipientUids: string[];
  /** Canonical recipient role (defaults to student). */
  recipientRole?: "teacher" | "student" | "parent" | "tenantAdmin";
  type: string;
  title: string;
  body: string;
  payload?: Doc;
  entityType?: "exam" | "space" | "submission" | "student" | "class";
  entityId?: string;
  actionUrl?: string;
  /** Dedupe key so at-least-once outbox delivery yields one notification. */
  dedupeKey?: string;
}

export async function emitNotificationService(
  input: EmitNotificationInput,
  ctx: AuthContext | SystemContext
): Promise<{ created: number }> {
  const now = ctx.now();
  let created = 0;
  const role = input.recipientRole ?? "student";

  for (const uid of input.recipientUids) {
    if (!uid) continue;
    // Empty enabledTypes = all types allowed (empty allow-list must not mute everything).
    const prefs = await xrepos(ctx).notificationReads.getPreferences(input.tenantId, uid);
    const enabledTypes = prefs?.["enabledTypes"] as string[] | undefined;
    if (
      Array.isArray(enabledTypes) &&
      enabledTypes.length > 0 &&
      !enabledTypes.includes(input.type)
    ) {
      continue;
    }
    const muteUntil = prefs?.["muteUntil"] as string | null | undefined;
    if (muteUntil && Date.parse(muteUntil) > Date.parse(now)) continue;

    // Dual-write recipientUid (canonical) + recipientId (legacy indexes/readers).
    await ctx.repos.tx(async (tx) => {
      tx.upsert("notifications", input.tenantId, {
        tenantId: input.tenantId,
        recipientUid: uid,
        recipientId: uid,
        recipientRole: role,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        actionUrl: input.actionUrl ?? null,
        isRead: false,
        readAt: null,
        createdAt: now,
        dedupeKey: input.dedupeKey,
        ...(input.payload ? { payload: input.payload } : {}),
      });
    });
    const unread = await xrepos(ctx).notificationReads.unreadCount(input.tenantId, uid);
    await xrepos(ctx).badges.set(uid, input.tenantId, {
      unreadCount: unread,
      updatedAt: Date.parse(now),
    });
    created++;
  }
  return { created };
}

// ── listNotifications (shared read) ───────────────────────────────────────────
export async function listNotificationsService(
  input: ReqOf<"v1.identity.listNotifications">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listNotifications">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "notification.read", { tenantId });
  const limit = input.limit ?? 20;

  // Avoid orderBy(createdAt): deployed composites still key on legacy `recipientId`,
  // so recipientUid+createdAt queries 500 (FAILED_PRECONDITION → INTERNAL_ERROR).
  // Equality-only queries are index-safe; we merge legacy recipientId rows and sort.
  const fetchLimit = Math.min(Math.max(limit * 2, 40), 100);
  const [byUid, byLegacy] = await Promise.all([
    ctx.repos.notifications.list(tenantId, {
      where: { recipientUid: ctx.uid },
      limit: fetchLimit,
    }),
    ctx.repos.notifications.list(tenantId, {
      where: { recipientId: ctx.uid },
      limit: fetchLimit,
    }),
  ]);

  const seen = new Set<string>();
  const merged: Doc[] = [];
  for (const item of [...byUid.items, ...byLegacy.items]) {
    const id = String(item["id"] ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
  }
  merged.sort((a, b) => String(b["createdAt"] ?? "").localeCompare(String(a["createdAt"] ?? "")));

  let start = 0;
  if (input.cursor) {
    try {
      const cur = ctx.repos.decodeCursor(input.cursor) as { id?: string };
      const idx = merged.findIndex((m) => String(m["id"]) === String(cur.id ?? ""));
      if (idx >= 0) start = idx + 1;
    } catch {
      /* ignore bad cursor */
    }
  }

  const page = merged.slice(start, start + limit);
  const hasMore = merged.length > start + limit;
  const last = page[page.length - 1];
  return {
    items: page.map((n) => projectNotification(n, tenantId, ctx.now())),
    nextCursor:
      hasMore && last ? ctx.repos.encodeCursor({ v: last["createdAt"], id: last["id"] }) : null,
  } as unknown as ResOf<"v1.identity.listNotifications">;
}

// ── getNotificationBadge (shared read) ────────────────────────────────────────
export async function getNotificationBadgeService(
  _input: ReqOf<"v1.identity.getNotificationBadge">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.getNotificationBadge">> {
  void _input;
  const tenantId = requireTenant(ctx);
  const badge = await xrepos(ctx).badges.get(ctx.uid, tenantId);
  return badge as unknown as ResOf<"v1.identity.getNotificationBadge">;
}

// ── markNotificationReadService (✅ optimistic; the only counter writer) ──────
export async function markNotificationReadService(
  input: ReqOf<"v1.identity.markNotificationRead">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.markNotificationRead">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "notification.markRead", { tenantId });
  const now = ctx.now();
  const notificationId = input.mode === "one" ? input.notificationId : null;
  const unreadCount = await xrepos(ctx).notificationReads.markRead(
    tenantId,
    ctx.uid,
    notificationId,
    now
  );
  await xrepos(ctx).badges.set(ctx.uid, tenantId, { unreadCount, updatedAt: Date.parse(now) });
  return { unreadCount } as ResOf<"v1.identity.markNotificationRead">;
}

// ── getNotificationPreferences (shared read) ──────────────────────────────────
export async function getNotificationPreferencesService(
  _input: ReqOf<"v1.identity.getNotificationPreferences">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.getNotificationPreferences">> {
  void _input;
  const tenantId = requireTenant(ctx);
  const prefs = await xrepos(ctx).notificationReads.getPreferences(tenantId, ctx.uid);
  return {
    id: ctx.uid,
    tenantId,
    userId: ctx.uid,
    enabledTypes: (prefs?.["enabledTypes"] as string[] | undefined) ?? [],
    muteUntil: (prefs?.["muteUntil"] as string | null | undefined) ?? null,
  } as unknown as ResOf<"v1.identity.getNotificationPreferences">;
}

// ── saveNotificationPreferences (self) ────────────────────────────────────────
export async function saveNotificationPreferencesService(
  input: ReqOf<"v1.identity.saveNotificationPreferences">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveNotificationPreferences">> {
  const tenantId = requireTenant(ctx);
  const now = ctx.now();
  await xrepos(ctx).notificationReads.savePreferences(
    tenantId,
    ctx.uid,
    { enabledTypes: input.enabledTypes ?? [], muteUntil: input.muteUntil ?? null },
    now
  );
  return {
    id: ctx.uid,
    tenantId,
    userId: ctx.uid,
    enabledTypes: input.enabledTypes ?? [],
    muteUntil: input.muteUntil ?? null,
  } as unknown as ResOf<"v1.identity.saveNotificationPreferences">;
}

// ── saveAnnouncementService (lifecycle; outbox) ───────────────────────────────
export async function saveAnnouncementService(
  input: ReqOf<"v1.identity.saveAnnouncement">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveAnnouncement">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "announcement.write", { tenantId });

  if (input.delete && input.id) {
    await ctx.repos.announcements.delete(tenantId, input.id);
    return { id: input.id, deleted: true } as ResOf<"v1.identity.saveAnnouncement">;
  }

  const existing = input.id ? await ctx.repos.announcements.get(tenantId, input.id) : null;
  const from = (existing?.["status"] as string | undefined) ?? "draft";
  const to = (input.data.status as string | undefined) ?? from;
  if (to !== from) assertTransition("announcement", from, to);

  const now = ctx.now();
  const { id, created } = await ctx.repos.announcements.upsert(
    tenantId,
    {
      ...(existing ?? {}),
      ...input.data,
      ...(input.id ? { id: input.id } : {}),
      status: to,
      authorUid: (existing?.["authorUid"] as string | undefined) ?? ctx.uid,
      ...(to === "published" && from !== "published" ? { publishedAt: now } : {}),
    },
    now
  );
  return { id, created } as ResOf<"v1.identity.saveAnnouncement">;
}

// ── listAnnouncements (shared read) ───────────────────────────────────────────
export async function listAnnouncementsService(
  input: ReqOf<"v1.identity.listAnnouncements">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.listAnnouncements">> {
  const tenantId = requireTenant(ctx);
  const where: Record<string, unknown> = {};
  if (input.scope) where["scope"] = input.scope;
  if (input.status) where["status"] = input.status;
  const page = await ctx.repos.announcements.list(tenantId, {
    where,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  const items = await Promise.all(
    page.items.map(async (a) => ({
      id: a["id"],
      title: (a["title"] as string | undefined) ?? "",
      body: (a["body"] as string | undefined) ?? "",
      scope: a["scope"] === "platform" ? "platform" : "tenant",
      status: a["status"],
      authorName: (a["authorName"] as string | undefined) ?? "",
      publishedAt: (a["publishedAt"] as string | undefined) ?? null,
      expiresAt: (a["expiresAt"] as string | undefined) ?? null,
      isReadByMe: await xrepos(ctx).announcementReads.isReadBy(
        tenantId,
        a["id"] as string,
        ctx.uid
      ),
    }))
  );
  return {
    items,
    nextCursor: page.nextCursor,
  } as unknown as ResOf<"v1.identity.listAnnouncements">;
}

// ── markAnnouncementRead (✅ optimistic) ──────────────────────────────────────
export async function markAnnouncementReadService(
  input: ReqOf<"v1.identity.markAnnouncementRead">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.markAnnouncementRead">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "notification.markRead", { tenantId });
  await xrepos(ctx).announcementReads.markRead(tenantId, input.announcementId, ctx.uid, ctx.now());
  return { isReadByMe: true } as ResOf<"v1.identity.markAnnouncementRead">;
}

// ── estimateAudience ──────────────────────────────────────────────────────────
export async function estimateAudienceService(
  input: ReqOf<"v1.identity.estimateAudience">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.estimateAudience">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "announcement.write", { tenantId });
  let recipientCount = 0;
  const classIds = input.targetClassIds ?? [];
  for (const classId of classIds) {
    const page = await ctx.repos.students.list(tenantId, {
      where: { classIds: classId },
      limit: 200,
    });
    recipientCount += page.items.length;
  }
  if (classIds.length === 0 && input.targetRoles?.length) {
    const page = await ctx.repos.students.list(tenantId, { limit: 200 });
    recipientCount = page.items.length;
  }
  return { recipientCount } as ResOf<"v1.identity.estimateAudience">;
}

// ── device tokens (C4) ────────────────────────────────────────────────────────
export async function registerDeviceTokenService(
  input: ReqOf<"v1.identity.registerDeviceToken">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.registerDeviceToken">> {
  const tenantId = requireTenant(ctx);
  await xrepos(ctx).devices.register(
    ctx.uid,
    tenantId,
    input.token,
    input.platform,
    input.appKey,
    ctx.now()
  );
  return { ok: true } as ResOf<"v1.identity.registerDeviceToken">;
}

export async function unregisterDeviceTokenService(
  input: ReqOf<"v1.identity.unregisterDeviceToken">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.unregisterDeviceToken">> {
  const tenantId = requireTenant(ctx);
  await xrepos(ctx).devices.unregister(ctx.uid, tenantId, input.token);
  return { ok: true } as ResOf<"v1.identity.unregisterDeviceToken">;
}

// ── sendDirectMessage (C14) — delegates to emitNotificationService ────────────
export async function sendDirectMessageService(
  input: ReqOf<"v1.identity.sendDirectMessage">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.sendDirectMessage">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "announcement.write", { tenantId });
  if (input.recipientUids.length === 0) fail("INVALID_ARGUMENT", "no recipients");
  const { created } = await emitNotificationService(
    {
      tenantId,
      recipientUids: input.recipientUids as string[],
      type: "system_announcement",
      title: input.title,
      body: input.body,
    },
    ctx
  );
  return { sent: true, count: created } as ResOf<"v1.identity.sendDirectMessage">;
}
