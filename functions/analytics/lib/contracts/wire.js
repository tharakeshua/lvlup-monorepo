"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateReportRequestSchema =
  exports.GetSummaryRequestSchema =
  exports.firestoreId =
    void 0;
/**
 * WIRE-PRESERVING request schemas + response types for the legacy analytics
 * callables. Ported verbatim from @levelup/shared-types (U3.3, DATA-MODEL-FIX-PLAN
 * §3/§6) so that package can be deleted (U3.5).
 *
 * These deliberately do NOT adopt the @levelup/api-contract v1 request shapes:
 * this package serves the DEPLOYED legacy wire; the v1 successors live in
 * `functions/sdk-v1` + `packages/api-contract` (v1.analytics.getSummary /
 * v1.analytics.generateReport). This file dies with the legacy stack.
 *
 * B8 note: timestamps in RESPONSES from migrated handlers are canonical ISO
 * strings (domain `Timestamp`), never Firestore Timestamp objects.
 */
const zod_1 = require("zod");
/** Firestore document ID pattern (no slashes, non-empty). Ported verbatim. */
exports.firestoreId = zod_1.z
  .string()
  .min(1, "ID cannot be empty")
  .max(1500)
  .regex(/^[^/]+$/, "ID cannot contain slashes");
// ── getSummary ─────────────────────────────────────────────────────────────
/** v1 successor: api-contract analytics `GetSummaryRequestSchema`. */
exports.GetSummaryRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId.optional(),
  scope: zod_1.z.enum(["student", "class", "platform", "health"]),
  studentId: exports.firestoreId.optional(),
  classId: exports.firestoreId.optional(),
});
// ── generateReport ─────────────────────────────────────────────────────────
/** v1 successor: api-contract analytics `GenerateReportRequestSchema`. */
exports.GenerateReportRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  type: zod_1.z.enum(["exam-result", "progress", "class"]),
  examId: exports.firestoreId.optional(),
  studentId: exports.firestoreId.optional(),
  classId: exports.firestoreId.optional(),
  academicSessionId: exports.firestoreId.optional(),
});
//# sourceMappingURL=wire.js.map
