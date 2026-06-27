/**
 * Students Directory (students-directory) — every student in the tenant.
 *
 * A searchable, filterable index across all classes. Filter chips narrow by
 * status / risk; tapping a row opens the student's progress detail.
 *
 * Data: `useStudents()` only. Scores/risk are OPTIONAL analytics — absent ones
 * render "—" (never a false-green). Loading→skeleton rows, empty→welcoming,
 * hard error→retry. Soft miss (pre-auth / not-yet-live callable) → empty.
 */
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { CloudOff, RotateCw, SearchX, Users } from "lucide-react-native";

import { useStudents } from "@levelup/query";

import { Button, EmptyState, Screen, SearchField, Skeleton } from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import {
  asArray,
  C,
  normStatus,
  numOf,
  rec,
  relTime,
  str,
  StudentRow,
  type StudentStatus,
} from "./_shared";

interface DirStudent {
  id: string;
  name: string;
  roll?: string;
  className?: string;
  score?: number | null;
  status: StudentStatus;
  atRisk: boolean;
  lastActive: string;
}

function toStudent(raw: unknown): DirStudent {
  const o = rec(raw);
  const id = str(o, "id", "studentId", "uid") ?? "";
  const name =
    str(o, "name", "displayName", "fullName") ??
    ([str(o, "firstName"), str(o, "lastName")].filter(Boolean).join(" ") || "Student");
  const classes = Array.isArray(o.classNames)
    ? (o.classNames as unknown[]).map(String)
    : Array.isArray(o.classes)
      ? (o.classes as unknown[]).map((c) => str(c, "name", "displayName") ?? String(c))
      : [];
  return {
    id,
    name,
    roll: str(o, "rollNumber", "roll", "enrollmentCode", "admissionNumber"),
    className: str(o, "className", "primaryClass") ?? (classes[0] || undefined),
    score: numOf(o, "overallScore", "score", "averageScore") ?? null,
    status: normStatus(str(o, "status")),
    atRisk: Boolean(o.atRisk ?? o.isAtRisk ?? rec(o.analytics).atRisk),
    lastActive: relTime(o.lastActiveAt ?? o.lastSeenAt ?? o.updatedAt),
  };
}

type FilterKey = "all" | "active" | "risk";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "risk", label: "At risk" },
];

function FilterRow({
  value,
  onChange,
  counts,
}: {
  value: FilterKey;
  onChange: (k: FilterKey) => void;
  counts: Record<FilterKey, number>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 12 }}
    >
      {FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`rounded-pill flex-row items-center gap-1.5 border px-3 py-1.5 ${
              active ? "border-brand-subtle bg-brand-subtle" : "border-border-subtle bg-surface"
            }`}
          >
            <Text
              className={`font-ui text-sm ${active ? "text-text-primary font-semibold" : "text-text-secondary"}`}
            >
              {f.label}
            </Text>
            <Text className="text-2xs text-text-muted font-mono">{counts[f.key]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function StudentsDirectoryScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const query = useStudents();

  const students = useMemo(
    () =>
      asArray(query.data)
        .map(toStudent)
        .filter((s) => s.id || s.name !== "Student"),
    [query.data]
  );

  const counts = useMemo<Record<FilterKey, number>>(
    () => ({
      all: students.length,
      active: students.filter((s) => s.status === "active").length,
      risk: students.filter((s) => s.atRisk).length,
    }),
    [students]
  );

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return students.filter((s) => {
      if (filter === "active" && s.status !== "active") return false;
      if (filter === "risk" && !s.atRisk) return false;
      if (!n) return true;
      return (
        s.name.toLowerCase().includes(n) ||
        (s.roll ?? "").toLowerCase().includes(n) ||
        (s.className ?? "").toLowerCase().includes(n)
      );
    });
  }, [students, q, filter]);

  const Header = (
    <View className="gap-2">
      <Text className="font-display text-text-primary text-3xl font-medium">Students</Text>
      <Text className="font-ui text-text-secondary text-base">
        Everyone across your classes, in one place.
      </Text>
    </View>
  );

  let body: React.ReactNode;
  if (query.isLoading) {
    body = (
      <View className="gap-3" accessibilityLabel="Loading students">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            className="border-border-subtle bg-surface flex-row items-center gap-3 rounded-lg border px-4 py-3"
          >
            <Skeleton variant="circle" width={40} height={40} />
            <View className="flex-1 gap-2">
              <Skeleton width="55%" height={12} />
              <Skeleton width="30%" height={9} />
            </View>
            <Skeleton width={52} height={20} />
          </View>
        ))}
      </View>
    );
  } else if (isHardError(query)) {
    body = (
      <EmptyState
        icon={<CloudOff size={40} color={C.muted} />}
        title="We couldn't load your students just now."
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
  } else if (students.length === 0) {
    body = (
      <EmptyState
        icon={<Users size={40} color={C.brand} />}
        title="No students yet"
        body="As students are enrolled into your classes, they'll show up here with their progress and risk signals."
      />
    );
  } else if (filtered.length === 0) {
    body = (
      <EmptyState
        icon={<SearchX size={40} color={C.muted} />}
        title="No students match"
        body="Try a different search term or clear the filter."
        action={
          <Button
            variant="secondary"
            size="sm"
            onPress={() => {
              setQ("");
              setFilter("all");
            }}
          >
            Clear filters
          </Button>
        }
      />
    );
  } else {
    body = (
      <View className="gap-3">
        {filtered.map((s) => (
          <StudentRow
            key={s.id || s.name}
            name={s.name}
            sub={
              [s.roll ? `Roll ${s.roll}` : null, s.className].filter(Boolean).join(" · ") ||
              undefined
            }
            score={s.score}
            status={s.status}
            atRisk={s.atRisk}
            lastActive={s.lastActive || undefined}
            onPress={() => router.push(routes.studentDetail(s.id))}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen contentClassName="px-5 pt-4 pb-10 gap-5">
      {Header}
      {students.length > 0 ? (
        <>
          <SearchField
            value={q}
            onChangeText={setQ}
            placeholder="Search by name, roll, or class"
            onClear={() => setQ("")}
          />
          <FilterRow value={filter} onChange={setFilter} counts={counts} />
        </>
      ) : null}
      {body}
    </Screen>
  );
}
