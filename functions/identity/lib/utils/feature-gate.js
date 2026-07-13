"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertFeatureEnabled = assertFeatureEnabled;
const https_1 = require("firebase-functions/v2/https");
const firestore_helpers_1 = require("./firestore-helpers");
/**
 * Assert a tenant has the given feature enabled.
 * Throws `permission-denied` if the feature is disabled.
 */
async function assertFeatureEnabled(tenantId, feature) {
  const tenant = await (0, firestore_helpers_1.getTenant)(tenantId);
  if (!tenant) {
    throw new https_1.HttpsError("not-found", "Tenant not found");
  }
  if (!tenant.features[feature]) {
    throw new https_1.HttpsError(
      "permission-denied",
      `Feature "${feature}" is not enabled for your plan. Contact your administrator.`
    );
  }
}
//# sourceMappingURL=feature-gate.js.map
