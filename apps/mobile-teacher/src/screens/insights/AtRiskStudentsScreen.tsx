/**
 * At-risk students (at-risk-students).
 *
 * The triage list: every student the analytics pipeline has flagged, ordered by
 * severity, each with humanized reasons, a latest score and a last-active hint.
 * Filter by severity; dismiss a flag once you've acted on it. Tapping a row opens
 * the student's detail.
 *
 * Data:
 *  - useLearningInsights({ type: 'at_risk' }) → the at-risk insight feed (infinite).
 *  - useDismissInsight()                      → dismiss a flag (optimistic + server).
 *
 * Every payload is `unknown` → defensive readers. Dismissed ids are also tracked
 * locally so the row disappears immediately even before the cache settles.
 */
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useDismissInsight, useLearningInsights } from "@levelup/query";
import { asInsightId } from "@levelup/domain";

import {
  AtRiskRow,
  Button,
  EmptyState,
  FilterChips,
  Icon,
  IconButton,
  Screen,
  Skeleton,
  type RiskSeverity,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { asList, bool, flattenPages, num, obj, pick, relTime, str } from "./_shared/readers";

/* ---------- model ---------- */
interface RiskItem {
  insightId: string;
  studentId: string;
  name: string;
  className: string;
  reasons: string[];
  severity: RiskSeverity;
  score: number | null;
  lastActive: string;
}

function toSeverity(raw: Record<string, unknown>): RiskSeverity {
  const p = str(pick(raw, ["severity", "priority", "risk", "riskLevel"])).toLowerCase();
  if (p === "high" || p === "critical" || p === "urgent") return "high";
  if (p === "low" || p === "minor") return "low";
  return "medium";
}

function toReasons(raw: Record<string, unknown>): string[] {
  const arr = pick(raw, ["reasons", "atRiskReasons", "factors"]);
  if (Array.isArray(arr)) {
    return arr
      .map((r) =>
        typeof r === "string" ? r : str(pick(obj(r), ["label", "reason", "text", "description"]))
      )
      .filter(Boolean);
  }
  const single = str(pick(raw, ["reason", "description", "body", "summary"]));
  return single ? [single] : [];
}

function isAtRiskInsight(raw: Record<string, unknown>): boolean {
  const type = str(pick(raw, ["type", "insightType", "category"])).toLowerCase();
  return (
    bool(pick(raw, ["isAtRisk", "atRisk"])) ||
    type.includes("risk") ||
    type.includes("struggl") ||
    type.includes("declin")
  );
}

function readRisk(raw: Record<string, unknown>): RiskItem {
  const scoreRaw = pick(raw, ["score", "latestScore", "averageScore", "percentage"]);
  return {
    insightId: str(pick(raw, ["id", "insightId", "_id"])),
    studentId: str(pick(raw, ["studentId", "actionEntityId", "subjectId", "userId"])),
    name: str(
      pick(raw, ["studentName", "actionEntityTitle", "name", "title", "displayName"]),
      "Student"
    ),
    className: str(pick(raw, ["className", "classLabel", "grade"])),
    reasons: toReasons(raw),
    severity: toSeverity(raw),
    score: scoreRaw == null ? null : num(scoreRaw),
    lastActive: relTime(pick(raw, ["lastActiveAt", "lastSeenAt", "updatedAt"])),
  };
}

const SEVERITY_ORDER: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

/* ---------- loading ---------- */
function LoadingState() {
  return (
    <View className="gap-4">
      <Skeleton width="55%" height={26} />
      <Skeleton width="100%" height={40} />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} width="100%" height={72} />
      ))}
    </View>
  );
}

/* ---------- screen ---------- */
export default function AtRiskStudentsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const insightsQuery = useLearningInsights({ type: "at_risk" } as never);
  const dismissMutation = useDismissInsight();

  const items = useMemo(() => {
    const raw = flattenPages(insightsQuery.data);
    // If the server didn't honor the type filter, narrow client-side too.
    const filtered = (raw.some(isAtRiskInsight) ? raw.filter(isAtRiskInsight) : raw).filter(
      (item) => pick(item, ["dismissedAt"]) == null // server may already exclude dismissed
    );
    return filtered
      .map(readRisk)
      .filter((r) => r.insightId || r.studentId)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [insightsQuery.data]);

  const visible = items
    .filter((r) => !dismissed.has(r.insightId))
    .filter((r) => filter === "all" || r.severity === filter);

  const highCount = items.filter(
    (r) => !dismissed.has(r.insightId) && r.severity === "high"
  ).length;

  const onDismiss = (insightId: string): void => {
    if (!insightId) return;
    setDismissed((prev) => new Set(prev).add(insightId));
    dismissMutation.mutate(
      { insightId: asInsightId(insightId) },
      {
        onError: () =>
          setDismissed((prev) => {
            const next = new Set(prev);
            next.delete(insightId);
            return next;
          }),
      }
    );
  };

  const isLoading = insightsQuery.isLoading && !insightsQuery.data;
  const isError = isHardError(insightsQuery);

  if (isError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-off"
          title="We couldn't load at-risk students"
          body="Let's try that again — this one's on us, not you."
          action={
            <Button
              variant="primary"
              leadingIcon="rotate-cw"
              onPress={() => insightsQuery.refetch()}
            >
              Try again
            </Button>
          }
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-5">
        {/* HEADER */}
        <View className="gap-1">
          <Text className="font-display text-text-primary text-2xl font-semibold">
            At-risk students
          </Text>
          <Text className="font-ui text-text-muted text-sm">
            {highCount > 0
              ? `${highCount} student${highCount === 1 ? "" : "s"} need urgent attention`
              : "Students the analytics pipeline has flagged."}
          </Text>
        </View>

        {/* FILTERS */}
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

        {/* LIST */}
        {visible.length === 0 ? (
          <EmptyState
            icon="shield-check"
            title={items.length === 0 ? "No students at risk" : "Nothing in this band"}
            body={
              items.length === 0
                ? "Everyone is on track right now. Flags appear here as the nightly analysis spots students who need support."
                : "No students match this severity. Try a different filter."
            }
          />
        ) : (
          <View className="gap-2.5">
            {visible.map((r) => (
              <View key={r.insightId || r.studentId} className="flex-row items-center gap-2">
                <View className="flex-1">
                  <AtRiskRow
                    name={r.name}
                    className_={r.className || undefined}
                    reasons={r.reasons}
                    severity={r.severity}
                    score={r.score}
                    lastActive={r.lastActive || undefined}
                    onPress={() =>
                      r.studentId ? router.push(routes.studentDetail(r.studentId)) : undefined
                    }
                  />
                </View>
                {r.insightId ? (
                  <IconButton
                    icon="x"
                    variant="ghost"
                    label="Dismiss flag"
                    onPress={() => onDismiss(r.insightId)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* DISMISS HINT */}
        {visible.length > 0 ? (
          <View className="flex-row items-center justify-center gap-1.5 pt-1">
            <Icon name="info" size={13} color="#756E61" />
            <Text className="text-2xs text-text-muted font-mono">
              Tap a student to act · dismiss (✕) once you've followed up.
            </Text>
          </View>
        ) : null}

        <View className="h-6" />
      </View>
    </Screen>
  );
}
