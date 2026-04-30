"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRequest = parseRequest;
const https_1 = require("firebase-functions/v2/https");
/**
 * Parse and validate callable request data using a Zod schema.
 * Converts Zod validation errors into Firebase HttpsError('invalid-argument').
 */
function parseRequest(data, schema) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const message = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new https_1.HttpsError("invalid-argument", `Invalid request: ${message}`, {
    validationErrors: result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
      code: i.code,
    })),
  });
}
//# sourceMappingURL=parse-request.js.map
