/**
 * `parseRequest` — the Zod boundary parse (server-shared.md §2.4).
 *
 * Supersedes the live `functions/shared/src/parse-request.ts` (which threw
 * `HttpsError` directly). Now throws the transport-neutral
 * `AccessError('VALIDATION_ERROR')`; only `mapError` produces `HttpsError`.
 *
 * Schemas are `.strict()` so a stray `tenantId` field is REJECTED at the boundary
 * (contract test §8: no tenant-scoped request schema declares a `tenantId`).
 *
 * The `ZodLike` shape keeps this decoupled from a specific zod major.
 */
import type { ValidationError } from "@levelup/api-contract";
import { fail } from "./fail.js";

interface ZodIssue {
  path: PropertyKey[];
  message: string;
  code?: string;
}
interface ZodLike<T> {
  safeParse(
    data: unknown
  ): { success: true; data: T } | { success: false; error: { issues: ZodIssue[] } };
}

export function parseRequest<T>(data: unknown, schema: ZodLike<T>): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const validationErrors: ValidationError[] = result.error.issues.map((i) => ({
    path: i.path.map(String).join("."),
    message: i.message,
  }));
  const message =
    "Invalid request: " + validationErrors.map((e) => `${e.path}: ${e.message}`).join("; ");

  return fail("VALIDATION_ERROR", message, { validationErrors });
}
