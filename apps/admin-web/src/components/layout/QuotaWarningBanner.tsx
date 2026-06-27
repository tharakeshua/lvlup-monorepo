import { useState, useMemo } from "react";
import { useCurrentTenant } from "@/sdk/identity";
import type { Tenant } from "@levelup/shared-types";
import { X, AlertTriangle, AlertCircle, Clock } from "lucide-react";

interface QuotaWarning {
  level: "none" | "amber" | "red" | "expired";
  resource: string;
  current: number;
  max: number;
  message: string;
}

/**
 * Computes quota-warning state from the tenant's usage + subscription. This is a
 * pure projection over the tenant doc (no backend quota endpoint exists in the
 * @levelup/query SDK), sourced from `useCurrentTenant()` instead of the legacy
 * zustand tenant store.
 */
function useQuotaStatus(): QuotaWarning {
  const tenant = useCurrentTenant().data as Tenant | undefined;

  return useMemo(() => {
    const none: QuotaWarning = { level: "none", resource: "", current: 0, max: 0, message: "" };
    if (!tenant) return none;

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
    if (!usage || !sub) return none;

    const checks: Array<{ resource: string; current: number; max: number | undefined }> = [
      { resource: "student seats", current: usage.currentStudents, max: sub.maxStudents },
      { resource: "teacher seats", current: usage.currentTeachers, max: sub.maxTeachers },
      { resource: "spaces", current: usage.currentSpaces, max: sub.maxSpaces },
      { resource: "exams this month", current: usage.examsThisMonth, max: sub.maxExamsPerMonth },
    ];

    let worstLevel: "none" | "amber" | "red" = "none";
    let worstWarning: QuotaWarning = none;

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

export default function QuotaWarningBanner() {
  const warning = useQuotaStatus();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || warning.level === "none") return null;

  const config = {
    amber: {
      bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
      text: "text-amber-800 dark:text-amber-200",
      subText: "text-amber-700 dark:text-amber-300",
      icon: AlertTriangle,
    },
    red: {
      bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
      text: "text-red-800 dark:text-red-200",
      subText: "text-red-700 dark:text-red-300",
      icon: AlertCircle,
    },
    expired: {
      bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
      text: "text-red-800 dark:text-red-200",
      subText: "text-red-700 dark:text-red-300",
      icon: Clock,
    },
  }[warning.level];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className={`mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 ${config.bg}`}>
      <Icon className={`h-5 w-5 shrink-0 ${config.text}`} />
      <p className={`flex-1 text-sm ${config.subText}`}>{warning.message}</p>
      <button
        onClick={() => setDismissed(true)}
        className={`shrink-0 rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5 ${config.text}`}
        aria-label="Dismiss warning"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
