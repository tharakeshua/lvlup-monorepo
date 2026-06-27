/**
 * Trigger/scheduler event shapes services consume (server-shared.md §2.9).
 * Declared structurally — `@levelup/functions-shared`'s `makeTrigger`/
 * `makeScheduler`/`makeTaskHandler` adapt the firebase-functions event into these.
 * A trigger/scheduler service is `(event|payload, ctx: SystemContext) => Promise<void>`.
 */

/** A Firestore document trigger event, already normalized to plain JSON docs. */
export interface TriggerEvent<T = Record<string, unknown>> {
  /** Path params captured from the document pattern (e.g. `{ t, id }`). */
  params: Record<string, string>;
  /** Document state before the change (null on create). */
  before: T | null;
  /** Document state after the change (null on delete). */
  after: T | null;
  /** The tenant the change occurred in (resolved from `params.t`). */
  tenantId: string;
  /** Stable event id (idempotency key for the handler). */
  eventId: string;
}
