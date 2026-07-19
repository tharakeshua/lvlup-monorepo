/**
 * Classes Overview (classes-overview) — the class index.
 *
 * The teacher's launch pad: every class they manage with headline health
 * (students · spaces · exams · avg performance · at-risk). Tapping a class opens
 * its roster. Search + a session/status filter rail keep a long list scannable.
 *
 * Data: `useClasses()` only (no firebase). Analytics fields (avg performance,
 * at-risk) are OPTIONAL — a class with none renders a muted "—", never a
 * false-green zero. Loading→skeletons, empty→welcoming EmptyState, hard
 * error→retry. A pre-auth/NOT_FOUND read is a soft miss → empty, not an error.
 */
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BookOpen, CloudOff, Layers, RotateCw, SearchX, Users } from "lucide-react-native";

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Screen,
  SearchField,
  Skeleton,
  TeacherPageHeader,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { useClasses } from "@levelup/query";
import { asArray, C, initialsOf, numOf, pct, rec, str } from "./_shared";

interface ClassRow {
  id: string;
  name: string;
  grade?: string;
  section?: string;
  status?: string;
  students?: number;
  spaces?: number;
  exams?: number;
  performance?: number;
  atRisk?: number;
  session?: string;
}

function toRow(raw: unknown): ClassRow {
  const o = rec(raw);
  const id = str(o, "id", "classId", "uid") ?? str(rec(o.ref), "id") ?? "";
  const grade = str(o, "grade", "gradeLevel");
  const section = str(o, "section");
  const name =
    str(o, "name", "displayName", "title") ??
    (grade ? `Grade ${grade}${section ? ` — ${section}` : ""}` : "Untitled class");
  const counts = rec(o.counts ?? o.stats);
  return {
    id,
    name,
    grade,
    section,
    status: str(o, "status"),
    students:
      numOf(o, "studentCount", "studentsCount", "enrolledCount") ??
      numOf(counts, "students", "studentCount") ??
      (Array.isArray(o.studentIds) ? (o.studentIds as unknown[]).length : undefined),
    spaces: numOf(o, "spaceCount", "spacesCount") ?? numOf(counts, "spaces"),
    exams: numOf(o, "examCount", "examsCount") ?? numOf(counts, "exams"),
    performance:
      numOf(o, "avgPerformance", "averageScore", "avgScore", "performance") ??
      numOf(rec(o.analytics), "avgScore", "averagePercentage"),
    atRisk: numOf(o, "atRiskCount", "atRisk") ?? numOf(rec(o.analytics), "atRiskCount"),
    session: str(o, "academicSessionLabel", "sessionLabel", "session"),
  };
}

function bandFor(score: number): "success" | "brand" | "warning" {
  if (score >= 85) return "success";
  if (score >= 65) return "brand";
  return "warning";
}

function ClassCard({ c, onPress }: { c: ClassRow; onPress: () => void }) {
  const perfKnown = c.performance != null && Number.isFinite(c.performance);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${c.name}`}>
      <Card interactive>
        <View className="gap-3">
          <View className="flex-row items-start gap-3">
            <View className="bg-brand-subtle h-10 w-10 items-center justify-center rounded-lg">
              <Avatar initials={initialsOf(c.name)} size={40} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text
                className="font-display text-text-primary text-base font-semibold"
                numberOfLines={1}
              >
                {c.name}
              </Text>
              <Text className="text-2xs text-text-muted font-mono">
                {[
                  c.grade ? `Grade ${c.grade}` : null,
                  c.section ? `Section ${c.section}` : null,
                  c.session,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Open class"}
              </Text>
            </View>
            {c.status && c.status.toLowerCase() !== "active" ? (
              <Badge variant="warning">{c.status}</Badge>
            ) : null}
          </View>

          {/* count strip */}
          <View className="flex-row gap-4">
            <Stat label="Students" value={c.students} />
            <Stat label="Spaces" value={c.spaces} />
            <Stat label="Exams" value={c.exams} />
            <Stat label="At-risk" value={c.atRisk} tone={c.atRisk ? "risk" : undefined} />
          </View>

          {/* performance bar */}
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xs font-ui text-text-muted uppercase tracking-wide">
                Avg performance
              </Text>
              <Text className="text-text-secondary font-mono text-xs">{pct(c.performance)}</Text>
            </View>
            {perfKnown ? (
              <ProgressBar
                value={Math.round(c.performance as number)}
                variant={bandFor(c.performance as number)}
              />
            ) : (
              <Text className="text-2xs font-ui text-text-muted">
                No analytics yet — updates after the next nightly run.
              </Text>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: "risk" }) {
  const display = value == null || !Number.isFinite(value) ? "—" : String(value);
  return (
    <View className="gap-0.5">
      <Text
        className={`font-mono text-base ${
          tone === "risk" && (value ?? 0) > 0 ? "text-error" : "text-text-primary"
        }`}
      >
        {display}
      </Text>
      <Text className="text-2xs font-ui text-text-muted">{label}</Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View className="gap-3" accessibilityLabel="Loading your classes">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <View className="gap-3">
            <View className="flex-row items-center gap-3">
              <Skeleton variant="circle" width={40} height={40} />
              <View className="flex-1 gap-2">
                <Skeleton width="60%" height={14} />
                <Skeleton width="35%" height={10} />
              </View>
            </View>
            <Skeleton width="100%" height={8} />
          </View>
        </Card>
      ))}
    </View>
  );
}

export default function ClassesOverviewScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const query = useClasses();

  const classes = useMemo(
    () =>
      asArray(query.data)
        .map(toRow)
        .filter((c) => c.id || c.name),
    [query.data]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return classes;
    return classes.filter((c) =>
      [c.name, c.grade, c.section, c.session]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [classes, q]);

  const Header = (
    <TeacherPageHeader
      eyebrow="Teaching roster"
      title="Classes"
      subtitle="Every group you teach, with the signals that matter."
      action={
        <View className="bg-surface border-border-subtle rounded-pill flex-row items-center gap-1.5 border px-3 py-2">
          <Layers size={14} color={C.brand} />
          <Text className="text-text-secondary font-mono text-xs">{classes.length}</Text>
        </View>
      }
    />
  );

  let body: React.ReactNode;
  if (query.isLoading) {
    body = <LoadingState />;
  } else if (isHardError(query)) {
    body = (
      <EmptyState
        icon={<CloudOff size={40} color={C.muted} />}
        title="We couldn't load your classes just now."
        body="Let's try again — this one's on us, not you."
        action={
          <Button
            variant="primary"
            leadingIcon={<RotateCw size={16} color="#FFFDFA" />}
            onPress={() => query.refetch()}
          >
            Retry
          </Button>
        }
      />
    );
  } else if (classes.length === 0) {
    body = (
      <EmptyState
        icon={<BookOpen size={40} color={C.brand} />}
        title="No classes assigned to you yet"
        body="Once an administrator assigns you to a class, it'll appear here with its roster, assigned content, and live health."
      />
    );
  } else if (filtered.length === 0) {
    body = (
      <EmptyState
        icon={<SearchX size={40} color={C.muted} />}
        title="No classes match your search"
        body="Try a different name, grade, or section."
        action={
          <Button variant="secondary" size="sm" onPress={() => setQ("")}>
            Clear search
          </Button>
        }
      />
    );
  } else {
    body = (
      <View className="gap-3">
        {filtered.map((c) => (
          <ClassCard
            key={c.id || c.name}
            c={c}
            onPress={() => router.push(routes.classDetail(c.id))}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen contentClassName="px-5 pt-4 pb-10 gap-5">
      {Header}
      {classes.length > 0 ? (
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Search by name, grade, or section"
          onClear={() => setQ("")}
        />
      ) : null}
      <View className="flex-row items-center gap-2">
        <Users size={14} color={C.muted} />
        <Text className="text-2xs text-text-muted font-mono">{filtered.length} shown</Text>
      </View>
      {body}
    </Screen>
  );
}
