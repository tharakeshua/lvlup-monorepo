/**
 * Server-side state-machine enforcement. Reads `ALLOWED_TRANSITIONS` from
 * `@levelup/api-contract` (the SAME table the client PRE-checks). Wraps the
 * contract's `assertTransition`/`canTransition` so callers throw the
 * transport-neutral `AccessError('INVALID_TRANSITION')` (server-shared.md §1.5).
 */
import { ALLOWED_TRANSITIONS, canTransition as contractCanTransition } from "@levelup/api-contract";
import { invalidTransition } from "./errors.js";

export type TransitionEntityKey = keyof typeof ALLOWED_TRANSITIONS;

/** True iff `to` is reachable from `from` for `entity` per the contract table. */
export function canTransition(entity: TransitionEntityKey, from: string, to: string): boolean {
  return contractCanTransition(entity, from as never, to as never);
}

/** Throws `AccessError('INVALID_TRANSITION')` if `to ∉ ALLOWED_TRANSITIONS[entity][from]`. */
export function assertTransition(entity: TransitionEntityKey, from: string, to: string): void {
  if (!canTransition(entity, from, to)) {
    invalidTransition(`invalid ${String(entity)} transition: ${from} → ${to}`, {
      entity: String(entity),
      from,
      to,
    });
  }
}

export { ALLOWED_TRANSITIONS };
