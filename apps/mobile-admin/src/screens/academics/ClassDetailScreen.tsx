/**
 * ClassDetailScreen — one class: roster size, progress summary, at-risk count.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/class-detail.card.html
 * Route:  /admin/academics/class?classId=
 * Data:   useClass(classId) (the Class doc) + useClassSummary(classId) (derived
 *         autograde/levelup aggregate — soft-misses to empty until computed).
 *
 * Heavy roster/teacher/exam management ⟶ "Continue on web". Defensive reads:
 * every field is guarded; branded ClassId cast at the hook boundary.
 */
import { useMemo } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { asClassId } from "@levelup/domain";
import { useClass, useClassSummary } from "@levelup/query";

import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
  StatTile,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { listOf, num, pct, statusBadge, str } from "./_shared";

interface ClassDoc {
  name?: string;
  grade?: string;
  section?: string;
  status?: string;
  studentCount?: number;
  studentIds?: unknown[];
  teacherIds?: unknown[];
}

interface ClassSummaryDoc {
  className?: string;
  studentCount?: number;
  autograde?: {
    averageScore?: number;
    averagePercentage?: number;
    examCount?: number;
    passRate?: number;
  };
  levelup?: { averageCompletion?: number; totalPointsEarned?: number; activeStudents?: number };
  atRiskStudentIds?: unknown[];
  atRiskCount?: number;
}

export default function ClassDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ classId?: string }>();
  const classId = str(params.classId);

  const classQ = useClass(classId);
  const summaryQ = useClassSummary(asClassId(classId));

  const cls = (classQ.data ?? {}) as ClassDoc;
  const summary = (summaryQ.data ?? {}) as ClassSummaryDoc;

  const name = str(cls.name) || str(summary.className) || "Class";
  const studentCount = useMemo(
    () =>
      num(cls.studentCount, NaN) || listOf(cls.studentIds).length || num(summary.studentCount, 0),
    [cls.studentCount, cls.studentIds, summary.studentCount]
  );
  const teacherCount = listOf(cls.teacherIds).length;
  const atRisk = num(summary.atRiskCount, NaN) || listOf(summary.atRiskStudentIds).length;
  const sb = statusBadge(cls.status ?? "active");
  const gradeSection = [cls.grade && `Grade ${cls.grade}`, cls.section && `Section ${cls.section}`]
    .filter(Boolean)
    .join(" · ");

  if (!classId) {
    return (
      <Screen scroll>
        <TopBar title="Class" />
        <EmptyState
          icon="alert-triangle"
          title="No class selected"
          body="This screen needs a classId parameter."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <TopBar
        title={name}
        subtitle={gradeSection || "Class detail"}
        left={<IconButton icon="arrow-left" label="Back" onPress={() => router.back()} />}
      />

      <Breadcrumb
        items={[
          { label: "Classes", onPress: () => router.push(routes.academics()) },
          { label: name },
        ]}
      />

      {classQ.isLoading ? (
        <View className="gap-3">
          <Skeleton variant="rect" />
          <Skeleton variant="rect" />
        </View>
      ) : isHardError(classQ) ? (
        <EmptyState
          icon="alert-triangle"
          title="Couldn't load class"
          body="Something went wrong reading this class."
          action={
            <Button size="sm" variant="secondary" onPress={() => classQ.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          {/* status + grade header */}
          <Card className="gap-2">
            <View className="flex-row items-center justify-between">
              <SectionHeader title={name} subtitle={gradeSection || undefined} />
              <Badge variant={sb.variant}>{sb.label}</Badge>
            </View>
          </Card>

          {/* KPI tiles (summary soft-misses to —) */}
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[46%] flex-1">
              <StatTile label="Students" value={String(studentCount)} icon="users" />
            </View>
            <View className="min-w-[46%] flex-1">
              <StatTile label="Teachers" value={String(teacherCount)} icon="user-cog" />
            </View>
            <View className="min-w-[46%] flex-1">
              <StatTile
                label="Avg score"
                value={pct(summary.autograde?.averagePercentage)}
                icon="target"
              />
            </View>
            <View className="min-w-[46%] flex-1">
              <StatTile
                label="At risk"
                value={Number.isFinite(atRisk) ? String(atRisk) : "—"}
                icon="alert-triangle"
              />
            </View>
          </View>

          {/* progress summary */}
          <Card className="gap-3">
            <SectionHeader title="Progress summary" />
            <View className="gap-2">
              <ListRow
                title="Avg completion"
                leading={<Icon name="trending-up" size={18} />}
                trailing={pct(summary.levelup?.averageCompletion)}
                chevron={false}
              />
              <ProgressBar value={num(summary.levelup?.averageCompletion, 0)} variant="brand" />
            </View>
            <ListRow
              title="Pass rate"
              trailing={pct(summary.autograde?.passRate)}
              chevron={false}
            />
            <ListRow
              title="Exams graded"
              trailing={String(num(summary.autograde?.examCount, 0))}
              chevron={false}
            />
            <ListRow
              title="Active students"
              trailing={String(num(summary.levelup?.activeStudents, 0))}
              chevron={false}
            />
            <ListRow
              title="Points earned"
              trailing={String(num(summary.levelup?.totalPointsEarned, 0))}
              chevron={false}
            />
          </Card>

          {/* manage on web */}
          <Card className="gap-2">
            <SectionHeader title="Manage class" subtitle="Roster, teachers & enrolment" />
            <ListRow
              title="Edit roster on web"
              subtitle="Add/remove students & assign teachers"
              leading={<Icon name="external-link" size={18} />}
              onPress={() => router.push(routes.academics())}
            />
            <ListRow
              title="View exams"
              subtitle="Exams scoped to this class"
              leading={<Icon name="file-check" size={18} />}
              onPress={() => router.push(routes.exams())}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}
