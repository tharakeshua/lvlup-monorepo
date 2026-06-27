/**
 * Student Detail / Progress (student-detail-progress) — one student's picture.
 *
 * Identity header + a server-authoritative progress aggregate: overall score,
 * KPI tiles, per-subject space completion, and recent exams/activity. A teacher
 * lens on the same `StudentProgressSummary` the learner sees.
 *
 * Data: `useStudent(studentId)` (identity) + `useStudentSummary(studentId)`
 * (the aggregate). `studentId` arrives as a flat QUERY PARAM. Everything is
 * defensive: no summary doc yet (fresh student → NOT_FOUND soft miss) renders a
 * welcoming "progress starts here", not an error. No score is invented.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";
import {
  ArrowLeft,
  BookOpen,
  CloudOff,
  FileCheck2,
  RotateCw,
  Sprout,
  Target,
  Trophy,
} from "lucide-react-native";

import type { UserId } from "@levelup/domain";
import { useStudent, useStudentSummary } from "@levelup/query";

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Ring,
  Screen,
  SectionHeader,
  Skeleton,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import {
  asArray,
  C,
  initialsOf,
  MetricTile,
  numFmt,
  numOf,
  pct,
  rec,
  relTime,
  str,
} from "./_shared";

function prettySubject(key: string): string {
  const map: Record<string, string> = {
    dsa: "Data Structures & Algorithms",
    sd: "System Design",
    lld: "Low-Level Design",
    behavioral: "Behavioral Interview",
  };
  return map[key.toLowerCase()] ?? key;
}

interface RecentExam {
  id: string;
  title: string;
  date: string;
  score?: number;
  percentage?: number;
}

export default function StudentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string }>();
  const studentId = String(params.studentId ?? "");

  const studentQ = useStudent(studentId);
  const summaryQ = useStudentSummary(studentId as unknown as UserId);

  const student = rec(studentQ.data);
  const name =
    str(student, "name", "displayName", "fullName") ??
    ([str(student, "firstName"), str(student, "lastName")].filter(Boolean).join(" ") || "Student");
  const roll = str(student, "rollNumber", "roll", "enrollmentCode");
  const email = str(student, "email");
  const statusRaw = (str(student, "status") ?? "").toLowerCase();

  const summary = rec(summaryQ.data);
  const hasSummary = Object.keys(summary).length > 0;
  const ag = rec(summary.autograde);
  const lu = rec(summary.levelup);

  const overall = numOf(summary, "overallScore");
  const isAtRisk = Boolean(summary.isAtRisk);

  const subjectBars = useMemo(() => {
    const sb = rec(lu.subjectBreakdown);
    return Object.entries(sb)
      .map(([k, v]) => ({
        name: prettySubject(k),
        value: typeof v === "number" ? v : (numOf(v, "value", "completion") ?? 0),
      }))
      .filter((x) => Number.isFinite(x.value));
  }, [lu.subjectBreakdown]);

  const recentExams = useMemo<RecentExam[]>(() => {
    return asArray(ag.recentExams).map((e) => {
      const o = rec(e);
      return {
        id: str(o, "examId", "id") ?? Math.random().toString(36).slice(2),
        title: str(o, "examTitle", "title") ?? "Exam",
        date: relTime(o.date ?? o.completedAt ?? o.takenAt),
        score: numOf(o, "score", "marksObtained"),
        percentage: numOf(o, "percentage", "percent"),
      };
    });
  }, [ag.recentExams]);

  // ── identity gate (student itself missing/out of scope) ─────────────────────
  if (!studentQ.isLoading && isHardError(studentQ) && Object.keys(student).length === 0) {
    return (
      <Screen contentClassName="px-5 pt-4 pb-10 gap-5">
        <EmptyState
          icon={<CloudOff size={40} color={C.muted} />}
          title="Student unavailable"
          body="They may not exist, or they aren't in one of the classes you manage."
          action={
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft size={16} color={C.brand} />}
              onPress={() => router.push(routes.students())}
            >
              Back to Students
            </Button>
          }
        />
      </Screen>
    );
  }

  const Header = (
    <View className="gap-3">
      <Button
        variant="ghost"
        size="sm"
        leadingIcon={<ArrowLeft size={15} color={C.muted} />}
        onPress={() => router.push(routes.students())}
      >
        Students
      </Button>
      {studentQ.isLoading && Object.keys(student).length === 0 ? (
        <View className="flex-row items-center gap-3">
          <Skeleton variant="circle" width={56} height={56} />
          <View className="flex-1 gap-2">
            <Skeleton width="55%" height={18} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      ) : (
        <View className="flex-row items-center gap-3">
          <Avatar initials={initialsOf(name)} size="xl" />
          <View className="flex-1 gap-1">
            <Text
              className="font-display text-text-primary text-xl font-semibold"
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text className="text-text-muted font-mono text-xs" numberOfLines={1}>
              {[roll ? `Roll ${roll}` : null, email].filter(Boolean).join(" · ") || "Student"}
            </Text>
          </View>
          {statusRaw && statusRaw !== "active" ? (
            <Badge variant="warning">{statusRaw}</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          )}
        </View>
      )}
    </View>
  );

  let body: React.ReactNode;
  if (summaryQ.isLoading) {
    body = (
      <View className="gap-5" accessibilityLabel="Loading progress">
        <Card>
          <View className="items-center gap-3 py-2">
            <Skeleton variant="circle" width={120} height={120} />
            <Skeleton width="45%" height={14} />
          </View>
        </Card>
        <View className="flex-row flex-wrap gap-3">
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              className="border-border-subtle bg-surface min-w-[46%] flex-1 gap-2 rounded-lg border px-4 py-3"
            >
              <Skeleton width="60%" height={10} />
              <Skeleton width="40%" height={24} />
            </View>
          ))}
        </View>
      </View>
    );
  } else if (isHardError(summaryQ)) {
    body = (
      <EmptyState
        icon={<CloudOff size={40} color={C.muted} />}
        title="Couldn't load progress"
        body="Let's try again — this one's on us."
        action={
          <Button
            variant="primary"
            leadingIcon={<RotateCw size={16} color="#FFFDFA" />}
            onPress={() => summaryQ.refetch()}
          >
            Retry
          </Button>
        }
      />
    );
  } else if (!hasSummary) {
    body = (
      <EmptyState
        icon={<Sprout size={40} color={C.success} />}
        title="Progress starts here"
        body="As this student completes spaces and takes exams, their trends, strengths, and milestones fill in here."
      />
    );
  } else {
    body = (
      <View className="gap-6">
        {/* HERO */}
        <Card>
          <View className="items-center gap-3 py-2">
            <Ring
              value={Math.round(overall ?? 0)}
              size={130}
              label={pct(overall)}
              color={isAtRisk ? C.warning : C.brand}
            />
            <Text className="font-display text-text-primary text-lg font-semibold">
              Overall score
            </Text>
            {isAtRisk ? (
              <Badge variant="warning" icon={<Sprout size={13} color={C.warning} />}>
                Flagged for support
              </Badge>
            ) : (
              <Text className="font-ui text-text-muted text-xs">across spaces and exams</Text>
            )}
          </View>
        </Card>

        {/* KPI GRID */}
        <View className="flex-row flex-wrap gap-3">
          <MetricTile
            label="Avg exam score"
            value={pct(numOf(ag, "averagePercentage"))}
            caption={`${numFmt(numOf(ag, "completedExams"))} / ${numFmt(numOf(ag, "totalExams"))} exams`}
            tone="brand"
          />
          <MetricTile
            label="Space completion"
            value={pct(numOf(lu, "averageCompletion"))}
            caption={`${numFmt(numOf(lu, "completedSpaces"))} / ${numFmt(numOf(lu, "totalSpaces"))} spaces`}
            tone="success"
          />
          <MetricTile
            label="Current streak"
            value={`${numFmt(numOf(lu, "streakDays") ?? 0)}d`}
            tone="spark"
          />
          <MetricTile
            label="Points earned"
            value={numFmt(numOf(lu, "totalPointsEarned"))}
            caption={`of ${numFmt(numOf(lu, "totalPointsAvailable"))}`}
          />
        </View>

        {/* SUBJECT COMPLETION */}
        {subjectBars.length > 0 ? (
          <View className="gap-3">
            <SectionHeader title="Space completion by subject" />
            <Card>
              <View className="gap-4">
                {subjectBars.map((s) => {
                  const done = s.value >= 100;
                  return (
                    <View key={s.name} className="gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <Text
                          className="font-ui text-text-primary flex-1 text-sm font-semibold"
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                        <Text className="text-text-secondary font-mono text-xs">
                          {done ? "done ✓" : pct(s.value)}
                        </Text>
                      </View>
                      <ProgressBar
                        value={Math.round(s.value)}
                        variant={done ? "success" : "brand"}
                      />
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>
        ) : null}

        {/* RECENT EXAMS */}
        <View className="gap-3">
          <SectionHeader title="Recent exams" />
          {recentExams.length > 0 ? (
            recentExams.map((e) => (
              <Card key={e.id}>
                <View className="flex-row items-center gap-3">
                  <View className="bg-brand-subtle h-9 w-9 items-center justify-center rounded-lg">
                    <FileCheck2 size={16} color={C.brand} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-ui text-text-primary text-sm font-semibold"
                      numberOfLines={1}
                    >
                      {e.title}
                    </Text>
                    {e.date ? (
                      <Text className="text-2xs text-text-muted font-mono">{e.date}</Text>
                    ) : null}
                  </View>
                  <View className="items-end gap-1">
                    {e.score != null ? (
                      <Text className="text-text-primary font-mono text-sm">
                        {numFmt(e.score)} pts
                      </Text>
                    ) : null}
                    {e.percentage != null ? (
                      <Badge
                        variant={
                          e.percentage >= 75 ? "success" : e.percentage >= 50 ? "warning" : "error"
                        }
                      >
                        {pct(e.percentage)}
                      </Badge>
                    ) : null}
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Card>
              <View className="flex-row items-center gap-3">
                <BookOpen size={18} color={C.muted} />
                <Text className="font-ui text-text-secondary flex-1 text-sm">
                  No exams logged yet. Scores land here as this student completes them.
                </Text>
              </View>
            </Card>
          )}
        </View>

        {/* strengths / growth */}
        <StrengthsCard summary={summary} />
      </View>
    );
  }

  return (
    <Screen contentClassName="px-5 pt-4 pb-10 gap-5">
      {Header}
      {body}
    </Screen>
  );
}

function StrengthsCard({ summary }: { summary: Record<string, unknown> }) {
  const strengths = (Array.isArray(summary.strengthAreas) ? summary.strengthAreas : []).map(String);
  const growth = (Array.isArray(summary.weaknessAreas) ? summary.weaknessAreas : []).map(String);
  if (strengths.length === 0 && growth.length === 0) return null;
  return (
    <Card>
      <View className="gap-3">
        {strengths.length > 0 ? (
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Trophy size={14} color={C.success} />
              <Text className="font-ui text-text-secondary text-sm font-semibold">Strong in</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {strengths.map((a) => (
                <Badge key={a} variant="success">
                  {prettySubject(a)}
                </Badge>
              ))}
            </View>
          </View>
        ) : null}
        {growth.length > 0 ? (
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Target size={14} color={C.warning} />
              <Text className="font-ui text-text-secondary text-sm font-semibold">
                Let's revisit
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {growth.map((a) => (
                <Badge key={a} variant="warning">
                  {prettySubject(a)}
                </Badge>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
