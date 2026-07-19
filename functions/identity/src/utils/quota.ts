import { HttpsError } from "firebase-functions/v2/https";
import { getTenant } from "./firestore-helpers";

type QuotaResource = "student" | "teacher" | "space" | "exam";

/**
 * Assert a tenant has not exceeded the subscription quota for the given resource.
 * Throws `resource-exhausted` if the quota is exceeded.
 *
 * @param tenantId  The tenant to check quotas for
 * @param resource  The resource type being created
 * @param batchSize Number of resources being created in this operation (default 1)
 */
export async function assertQuota(
  tenantId: string,
  resource: QuotaResource,
  batchSize = 1
): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    throw new HttpsError("not-found", "Tenant not found");
  }

  const { subscription, stats, usage } = tenant;

  const quotaMap: Record<
    QuotaResource,
    { max: number | undefined; current: number; label: string }
  > = {
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
    throw new HttpsError(
      "resource-exhausted",
      `Subscription limit reached: ${current}/${max} ${label} used. ` +
        `Cannot add ${batchSize} more. Please upgrade your plan.`
    );
  }
}
