import { HttpsError } from "firebase-functions/v2/https";

/**
 * Parse and validate callable request data using a Zod schema.
 * Converts Zod validation errors into Firebase HttpsError('invalid-argument').
 */
export function parseRequest<T>(
  data: unknown,
  schema: {
    safeParse(data: unknown):
      | { success: true; data: T }
      | {
          success: false;
          error: { issues: Array<{ path: PropertyKey[]; message: string; code: string }> };
        };
  }
): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const message = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new HttpsError("invalid-argument", `Invalid request: ${message}`, {
    validationErrors: result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
      code: i.code,
    })),
  });
}
