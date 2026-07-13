"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertQuota = assertQuota;
const https_1 = require("firebase-functions/v2/https");
const firestore_helpers_1 = require("./firestore-helpers");
/**
 * Assert a tenant has not exceeded the subscription quota for the given resource.
 * Throws `resource-exhausted` if the quota is exceeded.
 *
 * @param tenantId  The tenant to check quotas for
 * @param resource  The resource type being created
 * @param batchSize Number of resources being created in this operation (default 1)
 */
async function assertQuota(tenantId, resource, batchSize = 1) {
  const tenant = await (0, firestore_helpers_1.getTenant)(tenantId);
  if (!tenant) {
    throw new https_1.HttpsError("not-found", "Tenant not found");
  }
  const { subscription, stats, usage } = tenant;
  const quotaMap = {
    student: {
      max: subscription.maxStudents,
      current: stats.totalStudents,
      label: "students",
    },
    teacher: {
      max: subscription.maxTeachers,
      current: stats.totalTeachers,
      label: "teachers",
    },
    space: {
      max: subscription.maxSpaces,
      current: stats.totalSpaces,
      label: "spaces",
    },
    exam: {
      max: subscription.maxExamsPerMonth,
      current: usage?.examsThisMonth ?? stats.totalExams,
      label: "exams this month",
    },
  };
  const { max, current, label } = quotaMap[resource];
  // undefined max means unlimited
  if (max === undefined) return;
  if (current + batchSize > max) {
    throw new https_1.HttpsError(
      "resource-exhausted",
      `Subscription limit reached: ${current}/${max} ${label} used. ` +
        `Cannot add ${batchSize} more. Please upgrade your plan.`
    );
  }
}
//# sourceMappingURL=quota.js.map
