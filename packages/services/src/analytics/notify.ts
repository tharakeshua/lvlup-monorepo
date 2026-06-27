/**
 * `notifyService` — THE single notification fan-out producer + single badge writer
 * (analytics.md §"services/server"; notification.md THE 4-copy consolidation).
 * Dual-writes the Firestore `notifications/{id}` doc (with `recipientUid`) + the
 * RTDB `/notifications/{tenantId}/{uid}` badge. ALL notification producers
 * (triggers/schedulers across the 4 codebases) delegate here so there is exactly
 * one badge writer. `(input, ctx: SystemContext)`.
 */
import type { SystemContext } from "../shared/context.js";

export interface NotificationInput {
  tenantId: string;
  recipientUid: string;
  recipientRole: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}

/** Emit a single notification (doc + badge). The ONLY badge writer. */
export async function sendNotificationService(
  input: NotificationInput,
  ctx: SystemContext
): Promise<void> {
  const now = ctx.now();
  const { id } = await ctx.repos.notifications.upsert(
    input.tenantId,
    {
      tenantId: input.tenantId,
      recipientUid: input.recipientUid,
      recipientRole: input.recipientRole,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl,
      isRead: false,
      createdAt: now,
      readAt: null,
    },
    now
  );

  // Bump the RTDB badge projection (single writer). Modeled here as an upsert with
  // a `_kind:'badge'` discriminator; the real adapter writes the RTDB node.
  await bumpBadge(ctx, input.tenantId, input.recipientUid, {
    id,
    title: input.title,
    type: input.type,
    createdAt: now,
  });
}

/** Bulk fan-out (e.g. results-released to a class) — single badge writer per uid. */
export async function sendBulkNotificationsService(
  inputs: NotificationInput[],
  ctx: SystemContext
): Promise<void> {
  for (const n of inputs) await sendNotificationService(n, ctx);
}

async function bumpBadge(
  ctx: SystemContext,
  tenantId: string,
  uid: string,
  latest: { id: string; title: string; type: string; createdAt: string }
): Promise<void> {
  const id = `badge_${uid}`;
  const existing = await ctx.repos.notifications.get(tenantId, id);
  const unreadCount = ((existing?.["unreadCount"] as number | undefined) ?? 0) + 1;
  await ctx.repos.notifications.upsert(
    tenantId,
    { id, _kind: "badge", uid, unreadCount, latest },
    ctx.now()
  );
}
