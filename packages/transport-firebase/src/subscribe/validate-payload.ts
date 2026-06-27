/**
 * `validatePayload` (transport-realtime.md §2.2 subscribe/validate-payload.ts).
 *
 * The single payload-shape gate at the wire edge. Parses a raw Firestore/RTDB
 * snapshot value against `SUBSCRIPTIONS[name].payload` (api-contract slim
 * projection schema).
 *   • dev  : throws on parse failure — surfaces realtime drift the same way the
 *            api-client response-validate surfaces callable drift.
 *   • prod : best-effort. On failure it THROWS a typed marker the caller routes
 *            through `cb.error` (a malformed emission must not crash the UI / kill
 *            the stream — REVIEW §6: the RATE of the stream must keep flowing).
 *
 * The transport stays thin: this is the ONLY shaping it does, and it is pure
 * shape-validation (no derived fields — those live in repositories).
 */
import { SUBSCRIPTIONS, type SubscriptionName, type PayloadOf } from "@levelup/api-contract";

export type ValidateMode = "dev" | "prod";

/** Thrown by `validatePayload` in prod when a snapshot fails its payload schema. */
export class PayloadValidationError extends Error {
  constructor(
    readonly subscription: SubscriptionName,
    readonly issues: unknown
  ) {
    super(`[transport-firebase] payload for "${subscription}" failed schema validation`);
    this.name = "PayloadValidationError";
  }
}

export function validatePayload<S extends SubscriptionName>(
  name: S,
  raw: unknown,
  mode: ValidateMode
): PayloadOf<S> {
  const schema = SUBSCRIPTIONS[name].payload;
  if (mode === "dev") {
    // Throw the raw ZodError (rich path/issue info) so drift is loud in dev.
    return schema.parse(raw) as PayloadOf<S>;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new PayloadValidationError(name, result.error.issues);
  }
  return result.data as PayloadOf<S>;
}
