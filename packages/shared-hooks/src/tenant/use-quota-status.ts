import { useMemo } from "react";
import { useTenantStore } from "@levelup/shared-stores";

export interface QuotaWarning {
  level: "none" | "amber" | "red" | "expired";
  resource: string;
  current: number;
  max: number;
  message: string;
}

/**
 * Hook that computes quota warning state from tenant usage and subscription.
 * Returns the highest-priority warning if multiple exist.
 */
export function useQuotaStatus(): QuotaWarning {
  const tenant = useTenantStore((s) => s.tenant);

  return useMemo(() => {
    if (!tenant) {
      return { level: "none", resource: "", current: 0, max: 0, message: "" };
    }

    // Check expired status first
    if (tenant.status === "expired") {
      return {
        level: "expired",
        resource: "subscription",
        current: 0,
        max: 0,
        message: "Your trial has expired. Contact support to continue.",
      };
    }

    const usage = tenant.usage;
    const sub = tenant.subscription;
    if (!usage || !sub) {
      return { level: "none", resource: "", current: 0, max: 0, message: "" };
    }

    // Check each quota - track the worst
    const checks: Array<{ resource: string; current: number; max: number | undefined }> = [
      { resource: "student seats", current: usage.currentStudents, max: sub.maxStudents },
      { resource: "teacher seats", current: usage.currentTeachers, max: sub.maxTeachers },
      { resource: "spaces", current: usage.currentSpaces, max: sub.maxSpaces },
      { resource: "exams this month", current: usage.examsThisMonth, max: sub.maxExamsPerMonth },
    ];

    let worstLevel: "none" | "amber" | "red" = "none";
    let worstWarning: QuotaWarning = {
      level: "none",
      resource: "",
      current: 0,
      max: 0,
      message: "",
    };

    for (const check of checks) {
      if (check.max === undefined || check.max === null || check.max === 0) continue;

      const ratio = check.current / check.max;

      if (ratio > 0.95 && worstLevel !== "red") {
        worstLevel = "red";
        worstWarning = {
          level: "red",
          resource: check.resource,
          current: check.current,
          max: check.max,
          message: `You've reached ${check.current}/${check.max} ${check.resource}. New ${check.resource.split(" ")[0]}s cannot be added.`,
        };
      } else if (ratio > 0.8 && worstLevel === "none") {
        worstLevel = "amber";
        worstWarning = {
          level: "amber",
          resource: check.resource,
          current: check.current,
          max: check.max,
          message: `You've used ${check.current}/${check.max} ${check.resource}. Consider upgrading your plan.`,
        };
      }
    }

    return worstWarning;
  }, [tenant]);
}
