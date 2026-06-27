/**
 * v1.notification.badge — live unread-badge state for the calling user.
 *
 * RTDB node written by emitNotificationService. `params: {}` — the subject is
 * `auth.currentUser`. Payload is the domain `NotificationBadgeState` (RTDB
 * epoch-ms fenced: `latest.createdAt` is an integer ms timestamp, the fence the
 * transport decode test asserts).
 *
 * `module: 'identity'` is the documented `notification → identity` name fold
 * (api-contract-core §7.2 / §10.5 allow-listed mapping): the channel name segment
 * reads `notification` while the owning/deploying codebase is `identity`.
 *
 * Plan: SDK-LAYERS-PLAN §3.3 (notification badge row) / api-contract-core §7.2.
 */
import type { z } from "zod";
import { zObject, NotificationBadgeStateSchema } from "@levelup/domain";
import { defineSubscription } from "../../subscriptions/subscription-def.js";

/** RTDB epoch-ms-fenced badge state (alias of the domain projection). */
export const NotificationStateSchema = NotificationBadgeStateSchema;
export type NotificationState = z.infer<typeof NotificationStateSchema>;

export const NotificationBadgeParamsSchema = zObject({});
export type NotificationBadgeParams = z.infer<typeof NotificationBadgeParamsSchema>;

export const notificationBadge = defineSubscription({
  name: "v1.notification.badge",
  module: "identity",
  source: "rtdb-node",
  params: NotificationBadgeParamsSchema,
  payload: NotificationStateSchema,
});
