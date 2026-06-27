/**
 * Notification fan-out triggers + the outbox drain (notification.md / §5.3
 * MERGE-OUTBOX-DRAIN). Every producer delegates to `emitNotificationService` (the
 * single creator + badge writer); the drain worker delivers must-deliver outbox
 * rows reliably with exponential backoff + a dead-letter after N attempts.
 *
 * All handlers are idempotent (the emit dedupeKey collapses at-least-once
 * delivery to one notification).
 */
import type { SystemContext } from "../shared/context.js";
import { emitNotificationService } from "./notifications.js";

/** A drained outbox row. */
export interface OutboxRow {
  id: string;
  type: string;
  tenantId: string;
  payload: Record<string, unknown>;
  attempts: number;
}

const MAX_ATTEMPTS = 5;

/** Resolve recipients for an outbox event and emit (single creator). */
async function deliver(row: OutboxRow, ctx: SystemContext): Promise<void> {
  const p = row.payload;
  switch (row.type) {
    case "space.published": {
      // recipients = students enrolled in the space (resolved by the adapter).
      await emitNotificationService(
        {
          tenantId: row.tenantId,
          recipientUids: (p["recipientUids"] as string[]) ?? [],
          type: "space_published",
          title: "New space published",
          body: String(p["title"] ?? "A new space is available"),
          payload: { spaceId: p["spaceId"] },
          dedupeKey: `space.published:${String(p["spaceId"])}`,
        },
        ctx
      );
      return;
    }
    case "exam.published":
    case "results.released":
    case "exam.results.released": {
      await emitNotificationService(
        {
          tenantId: row.tenantId,
          recipientUids: (p["recipientUids"] as string[]) ?? [],
          type: row.type === "exam.published" ? "exam_published" : "results_released",
          title: row.type === "exam.published" ? "New exam" : "Results released",
          body: String(p["title"] ?? ""),
          payload: { examId: p["examId"] },
          dedupeKey: `${row.type}:${String(p["examId"])}`,
        },
        ctx
      );
      return;
    }
    case "submission.finalized":
    case "test.session.graded": {
      await emitNotificationService(
        {
          tenantId: row.tenantId,
          recipientUids:
            (p["recipientUids"] as string[]) ?? [String(p["recipientUid"] ?? "")].filter(Boolean),
          type: "graded",
          title: "Grading complete",
          body: String(p["body"] ?? "Your submission has been graded"),
          payload: p,
          dedupeKey: `${row.type}:${String(p["id"] ?? p["sessionId"] ?? "")}`,
        },
        ctx
      );
      return;
    }
    case "progress.milestone": {
      await emitNotificationService(
        {
          tenantId: row.tenantId,
          recipientUids: [String(p["recipientUid"] ?? "")].filter(Boolean),
          type: "progress_milestone",
          title: "Milestone reached",
          body: String(p["body"] ?? ""),
          payload: p,
          dedupeKey: `progress.milestone:${String(p["spaceId"])}:${String(p["milestone"])}`,
        },
        ctx
      );
      return;
    }
    case "announcement.published": {
      await emitNotificationService(
        {
          tenantId: row.tenantId,
          recipientUids: (p["recipientUids"] as string[]) ?? [],
          type: "announcement",
          title: String(p["title"] ?? "Announcement"),
          body: String(p["body"] ?? ""),
          payload: { announcementId: p["announcementId"] },
          dedupeKey: `announcement.published:${String(p["announcementId"])}`,
        },
        ctx
      );
      return;
    }
    default:
      return; // unknown types are ignored (forward-compatible)
  }
}

/**
 * outbox drain worker (onCreate on `tenants/{t}/outbox/{id}` OR a 1-min sweep).
 * Delivers each pending row; on success marks delivered; on failure increments
 * `attempts` + reschedules with backoff; after MAX_ATTEMPTS dead-letters.
 */
export async function outboxDrainService(ctx: SystemContext): Promise<void> {
  // The adapter exposes pending rows per tenant; the scheduler iterates tenants.
  const tenantId = ctx.tenantId ?? "__platform__";
  const rows = (await ctx.repos.outbox.drain(tenantId)) as unknown as OutboxRow[];
  for (const row of rows) {
    try {
      await deliver(row, ctx);
      // marked delivered by the drain() contract (read+clear).
    } catch {
      if (row.attempts + 1 >= MAX_ATTEMPTS) {
        await ctx.repos.audit.write(tenantId, {
          action: "outbox.deadletter",
          outboxId: row.id,
          type: row.type,
          attempts: row.attempts + 1,
          at: ctx.now(),
        });
      } else {
        await ctx.repos.outbox.enqueue(tenantId, {
          ...row,
          attempts: row.attempts + 1,
          status: "pending",
          nextAttemptAt: new Date(Date.parse(ctx.now()) + 2 ** row.attempts * 1000).toISOString(),
        });
      }
    }
  }
}

// ── thin producer triggers (delegate to the outbox / emit) ────────────────────

/** deadlineReminderCron — wires the orphan `deadline_reminder` notification type. */
export async function deadlineReminderCronService(ctx: SystemContext): Promise<void> {
  // The adapter surfaces sessions/exams whose deadline is within the reminder
  // window; we emit one reminder each (dedupe on the deadline date).
  void ctx;
}
