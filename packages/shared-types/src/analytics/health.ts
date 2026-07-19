import type { FirestoreTimestamp } from "../identity/user";

export type DayHealthStatus = "healthy" | "degraded" | "down";

export interface HealthSnapshot {
  id: string;
  date: string; // YYYY-MM-DD
  status: DayHealthStatus;
  services: Record<string, { status: string; latencyMs?: number }>;
  checkedAt: FirestoreTimestamp;
}

export interface HealthHistoryResponse {
  snapshots: HealthSnapshot[];
  errorCount24h: number;
  totalFunctionCalls24h: number;
}
