import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { DailyCostSummary } from "@levelup/shared-types";

export function useDailyCostSummaries(
  tenantId: string | null,
  dateRange?: { start: string; end: string }
) {
  return useQuery<DailyCostSummary[]>({
    queryKey: ["tenants", tenantId, "dailyCostSummaries", dateRange],
    queryFn: async () => {
      if (!tenantId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/dailyCostSummaries`);
      const constraints = [];
      if (dateRange?.start) {
        constraints.push(where("date", ">=", dateRange.start));
      }
      if (dateRange?.end) {
        constraints.push(where("date", "<=", dateRange.end));
      }
      constraints.push(orderBy("date", "desc"));
      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailyCostSummary);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMonthlyCostSummary(
  tenantId: string | null,
  month: string | null // YYYY-MM
) {
  const dateRange = month ? { start: `${month}-01`, end: `${month}-31` } : undefined;

  const result = useDailyCostSummaries(tenantId, dateRange);

  const monthlySummary = result.data
    ? {
        totalCost: result.data.reduce((sum, d) => sum + d.totalCostUsd, 0),
        totalCalls: result.data.reduce((sum, d) => sum + d.totalCalls, 0),
        totalInputTokens: result.data.reduce((sum, d) => sum + d.totalInputTokens, 0),
        totalOutputTokens: result.data.reduce((sum, d) => sum + d.totalOutputTokens, 0),
        days: result.data,
      }
    : null;

  return { ...result, data: monthlySummary };
}
