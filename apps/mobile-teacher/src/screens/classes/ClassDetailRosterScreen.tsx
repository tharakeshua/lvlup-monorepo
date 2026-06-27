/**
 * Class Detail / Roster (class-detail-roster) — single-class operational hub.
 *
 * Three tabs: Roster (the students), Assigned content (spaces + a pointer to
 * the web authoring surface), and Snapshot (server-authoritative health KPIs).
 * `classId` arrives as a flat QUERY PARAM (see routes.ts flattening rule).
 *
 * Data: `useClass(classId)` (header + counts) + `useStudents({ classId })`
 * (roster). Both read-only, both defensive: a class out of scope / not-yet-live
 * callable degrades to a friendly "class unavailable" rather than throwing. No
 * score is invented — a pending student shows "—" (absence ≠ safe).
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Lock,
  Orbit,
  Pencil,
  Share2,
  Users,
} from "lucide-react-native";

import type { ClassId } from "@levelup/domain";
import { useClass, useStudents } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  SearchField,
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
  normStatus,
  numOf,
  pct,
  ProgressRow,
  rec,
  relTime,
  str,
  StudentRow,
} from "./_shared";

type Tab = "Roster" | "Content" | "Snapshot";
const TABS: Tab[] = ["Roster", "Content", "Snapshot"];

interface RosterStudent {
  id: string;
  name: string;
  roll?: string;
  score?: number | null;
  status: ReturnType<typeof normStatus>;
  atRisk: boolean;
  lastActive: string;
}

function toStudent(raw: unknown): RosterStudent {
  const o = rec(raw);
  const id = str(o, "id", "studentId", "uid") ?? "";
  const name =
    str(o, "name", "displayName", "fullName") ??
    ([str(o, "firstName"), str(o, "lastName")].filter(Boolean).join(" ") || "Student");
  return {
    id,
    name,
    roll: str(o, "rollNumber", "roll", "enrollmentCode", "admissionNumber"),
    score: numOf(o, "overallScore", "score", "averageScore") ?? null,
    status: normStatus(str(o, "status")),
    atRisk: Boolean(o.atRisk ?? o.isAtRisk ?? rec(o.analytics).atRisk),
    lastActive: relTime(o.lastActiveAt ?? o.lastSeenAt ?? o.updatedAt),
  };
}

function Segmented({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <View className="rounded-pill bg-surface-sunken flex-row p-1">
      {TABS.map((t) => {
        const active = t === value;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`rounded-pill flex-1 items-center py-2 ${active ? "bg-surface" : ""}`}
          >
            <Text
              className={`font-ui text-sm ${active ? "text-text-primary font-semibold" : "text-text-secondary"}`}
            >
              {t === "Content" ? "Content" : t}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RosterTab({
  students,
  loading,
  hardError,
  onRetry,
  onOpenStudent,
}: {
  students: RosterStudent[];
  loading: boolean;
  hardError: boolean;
  onRetry: () => void;
  onOpenStudent: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(n) || (s.roll ?? "").toLowerCase().includes(n)
    );
  }, [students, q]);

  if (loading) {
    return (
      <View className="gap-3">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            className="border-border-subtle bg-surface flex-row items-center gap-3 rounded-lg border px-4 py-3"
          >
            <Skeleton variant="circle" width={36} height={36} />
            <View className="flex-1 gap-2">
              <Skeleton width="50%" height={12} />
              <Skeleton width="25%" height={9} />
            </View>
            <Skeleton width={48} height={20} />
          </View>
        ))}
      </View>
    );
  }
  if (hardError) {
    return (
      <EmptyState
        icon={<Users size={36} color={C.muted} />}
        title="Couldn't load the roster"
        body="The rest of the page stays usable. Give it another go."
        action={
          <Button variant="secondary" size="sm" onPress={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }
  if (students.length === 0) {
    return (
      <EmptyState
        icon={<Users size={36} color={C.brand} />}
        title="No students enrolled yet"
        body="Enrolled students appear here as soon as they're added to this class from your tenant directory."
      />
    );
  }
  return (
    <View className="gap-3">
      <SearchField
        value={q}
        onChangeText={setQ}
        placeholder="Search by name or roll number"
        onClear={() => setQ("")}
      />
      {filtered.length === 0 ? (
        <Text className="font-ui text-text-muted px-1 py-6 text-center text-sm">
          No students match "{q}".
        </Text>
      ) : (
        filtered.map((s) => (
          <StudentRow
            key={s.id || s.name}
            name={s.name}
            sub={s.roll ? `Roll ${s.roll}` : undefined}
            score={s.score}
            status={s.status}
            atRisk={s.atRisk}
            lastActive={s.lastActive || undefined}
            onPress={() => onOpenStudent(s.id)}
          />
        ))
      )}
    </View>
  );
}

function ContentTab({ classId }: { classId: string }) {
  const router = useRouter();
  return (
    <View className="gap-5">
      <SectionHeader
        title="Assigned spaces"
        action={
          <Button
            variant="secondary"
            size="sm"
            trailingIcon={<Share2 size={14} color={C.brand} />}
            onPress={() => router.push(routes.assignContent(classId))}
          >
            Assign
          </Button>
        }
      />
      <EmptyState
        icon={<Orbit size={36} color={C.brand} />}
        title="Assign content to this class"
        body="Pick a space to give this class story points to work through. Heavy authoring continues on the web app."
        action={
          <Button
            variant="primary"
            size="sm"
            trailingIcon={<ArrowUpRight size={14} color="#FFFDFA" />}
            onPress={() => router.push(routes.assignContent(classId))}
          >
            Assign content
          </Button>
        }
      />
      <Card>
        <View className="flex-row items-start gap-3">
          <Lock size={16} color={C.muted} />
          <View className="flex-1 gap-1">
            <Text className="font-ui text-text-primary text-sm font-semibold">
              Answer keys stay hidden
            </Text>
            <Text className="font-ui text-text-secondary text-xs">
              Keys and grading live in the Review area — never exposed on this screen.
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );
}

function SnapshotTab({ cls }: { cls: Record<string, unknown> }) {
  const counts = rec(cls.counts ?? cls.stats);
  const analytics = rec(cls.analytics);
  const students =
    numOf(cls, "studentCount", "enrolledCount") ??
    numOf(counts, "students") ??
    (Array.isArray(cls.studentIds) ? (cls.studentIds as unknown[]).length : undefined);
  const avgScore = numOf(cls, "avgScore", "averageScore") ?? numOf(analytics, "avgScore");
  const completion =
    numOf(cls, "avgCompletion", "spaceCompletion") ?? numOf(analytics, "avgCompletion");
  const atRisk = numOf(cls, "atRiskCount") ?? numOf(analytics, "atRiskCount");

  const hasAnalytics = [avgScore, completion, atRisk].some((v) => v != null);

  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap gap-3">
        <MetricTile label="Students" value={students == null ? "—" : String(students)} />
        <MetricTile label="Avg exam score" value={pct(avgScore)} tone="brand" />
        <MetricTile label="Space completion" value={pct(completion)} tone="success" />
        <MetricTile
          label="At-risk"
          value={atRisk == null ? "—" : String(atRisk)}
          tone={atRisk ? "warning" : undefined}
        />
      </View>
      {!hasAnalytics ? (
        <EmptyState
          icon={<BarChart3 size={36} color={C.muted} />}
          title="No analytics yet"
          body="Figures appear after exams are graded and spaces are used. Updated after the next nightly run."
        />
      ) : (
        completion != null && (
          <ProgressRow label="Space completion" value={completion} meta="server-authoritative" />
        )
      )}
    </View>
  );
}

export default function ClassDetailRosterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ classId?: string }>();
  const classId = String(params.classId ?? "");
  const [tab, setTab] = useState<Tab>("Roster");

  const classQ = useClass(classId);
  const studentsQ = useStudents(classId ? { classId: classId as ClassId } : undefined);

  const cls = rec(classQ.data);
  const grade = str(cls, "grade", "gradeLevel");
  const section = str(cls, "section");
  const className =
    str(cls, "name", "displayName", "title") ??
    (grade ? `Grade ${grade}${section ? ` — ${section}` : ""}` : "Class");
  const status = str(cls, "status");

  const students = useMemo(
    () =>
      asArray(studentsQ.data)
        .map(toStudent)
        .filter((s) => s.id || s.name !== "Student"),
    [studentsQ.data]
  );
  const studentCount =
    numOf(cls, "studentCount", "enrolledCount") ??
    (students.length > 0 ? students.length : undefined);

  // Class itself failed hard (out of scope / missing) → friendly gate.
  if (!classQ.isLoading && isHardError(classQ) && Object.keys(cls).length === 0) {
    return (
      <Screen contentClassName="px-5 pt-4 pb-10 gap-5">
        <EmptyState
          icon={<Lock size={40} color={C.muted} />}
          title="Class unavailable"
          body="It may not exist, or it isn't one of the classes you manage."
          action={
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft size={16} color={C.brand} />}
              onPress={() => router.push(routes.classes())}
            >
              Back to Classes
            </Button>
          }
        />
      </Screen>
    );
  }

  const Header = (
    <View className="gap-3">
      <Pressable
        onPress={() => router.push(routes.classes())}
        accessibilityRole="button"
        className="flex-row items-center gap-1 self-start"
      >
        <ArrowLeft size={15} color={C.muted} />
        <Text className="font-ui text-text-muted text-xs">Classes</Text>
      </Pressable>

      {classQ.isLoading && Object.keys(cls).length === 0 ? (
        <View className="gap-2">
          <Skeleton width="60%" height={26} />
          <Skeleton width="40%" height={12} />
        </View>
      ) : (
        <View className="gap-2">
          <Text className="font-display text-text-primary text-2xl font-semibold">{className}</Text>
          <View className="flex-row flex-wrap items-center gap-2">
            {grade ? (
              <Text className="font-ui text-text-secondary text-sm">
                Grade <Text className="font-mono">{grade}</Text>
              </Text>
            ) : null}
            {section ? (
              <Text className="font-ui text-text-secondary text-sm">· Section {section}</Text>
            ) : null}
            {status && status.toLowerCase() !== "active" ? (
              <Badge variant="warning">{status}</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </View>
          <View className="flex-row items-center gap-3 pt-1">
            <View className="flex-row items-center gap-1.5">
              <Users size={14} color={C.muted} />
              <Text className="text-text-secondary font-mono text-xs">
                {studentCount == null ? "—" : studentCount} students
              </Text>
            </View>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Pencil size={13} color={C.brand} />}
              onPress={() => router.push(routes.assignContent(classId))}
            >
              Manage
            </Button>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <Screen contentClassName="px-5 pt-4 pb-10 gap-5">
      {Header}
      <Segmented value={tab} onChange={setTab} />
      {tab === "Roster" && (
        <RosterTab
          students={students}
          loading={studentsQ.isLoading}
          hardError={isHardError(studentsQ)}
          onRetry={() => studentsQ.refetch()}
          onOpenStudent={(id) => router.push(routes.studentDetail(id))}
        />
      )}
      {tab === "Content" && <ContentTab classId={classId} />}
      {tab === "Snapshot" && <SnapshotTab cls={cls} />}
    </Screen>
  );
}
