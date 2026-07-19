import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";

export interface TrendDataPoint {
  date: string;
  score: number;
  subject: string;
}

export function usePerformanceTrends(
  tenantId: string | null,
  studentId: string | null,
  range: "7d" | "30d" | "90d" | "all" = "30d"
) {
  return useQuery<TrendDataPoint[]>({
    queryKey: ["tenants", tenantId, "performanceTrends", studentId, range],
    queryFn: async () => {
      if (!tenantId || !studentId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/submissions`);

      const now = new Date();
      const rangeMs: Record<string, number> = {
        "7d": 7 * 86400000,
        "30d": 30 * 86400000,
        "90d": 90 * 86400000,
      };

      const constraints = [
        where("studentId", "==", studentId),
        orderBy("createdAt", "desc"),
        limit(100),
      ];

      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);

      const cutoff = range === "all" ? 0 : now.getTime() - (rangeMs[range] ?? 0);

      const points: TrendDataPoint[] = [];
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Record<string, unknown>;
        const createdAtRaw = data["createdAt"] as
          | { toMillis?: () => number; seconds?: number }
          | number
          | undefined;
        const createdAt =
          typeof createdAtRaw === "number"
            ? createdAtRaw
            : (createdAtRaw?.toMillis?.() ??
              (typeof createdAtRaw?.seconds === "number" ? createdAtRaw.seconds * 1000 : 0));
        if (createdAt < cutoff) continue;

        const maxScore = Number(data["totalMarks"] ?? data["maxScore"] ?? 1) || 1;
        const score = maxScore > 0 ? (Number(data["totalScore"] ?? 0) / maxScore) * 100 : 0;
        const date = new Date(createdAt).toISOString().split("T")[0] ?? "";

        points.push({
          date,
          score: Math.round(score),
          subject: String(data["subject"] ?? "General"),
        });
      }

      return points.sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!tenantId && !!studentId,
    staleTime: 5 * 60 * 1000,
  });
}
