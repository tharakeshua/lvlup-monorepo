/**
 * A minimal inert `SubscriptionHandle` for the future-stub subscribe builders.
 * Tracks `active` so `unsubscribe()` is idempotent and observable in shape tests.
 */
import type { SubscriptionHandle } from "../seam.js";

let counter = 0;

export function makeStubHandle(tag: string): SubscriptionHandle {
  let active = true;
  const id = `${tag}#${++counter}`;
  return {
    id,
    get active() {
      return active;
    },
    unsubscribe() {
      active = false;
    },
  };
}
