/**
 * UserManagementScreen — the People tab landing (tenant roster).
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/user-management.card.html
 * Route:  /admin/people
 * Data:   useStudents / useTeachers / useParents (per-tab rosters) +
 *         useSearchUsers (cross-roster search when a query is typed). All are
 *         admin identity callables — they soft-miss to empty until SDK-coord
 *         deploys the identity group, never an error (see lib/query-status).
 *
 * Self-contained: navigates via expo-router + ../../lib/routes; the shell mounts
 * this default export under the People tab.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useParents, useSearchUsers, useStudents, useTeachers } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  SearchField,
  SectionHeader,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import {
  countOf,
  fullName,
  listOf,
  LoadError,
  PendingNote,
  PeopleScreen,
  PersonRow,
  RosterSkeleton,
  Segmented,
  type PersonLike,
} from "./_shared/people";

type TabKey = "students" | "teachers" | "parents";

/** Subtitle line per roster kind (defensive — every field optional). */
function subtitleFor(kind: TabKey, p: PersonLike): string | undefined {
  if (kind === "students") {
    const bits = [p.rollNumber && `Roll ${p.rollNumber}`, p.grade, p.section]
      .filter(Boolean)
      .join(" · ");
    return bits || p.email || undefined;
  }
  if (kind === "teachers") {
    const subjects = Array.isArray(p.subjects) ? p.subjects.filter(Boolean) : [];
    const bits = [p.department, subjects.slice(0, 2).join(", ")].filter(Boolean).join(" · ");
    return bits || p.email || undefined;
  }
  // parents
  const n = Array.isArray(p.studentIds) ? p.studentIds.length : 0;
  const childBit = n > 0 ? `${n} child${n === 1 ? "" : "ren"}` : undefined;
  return [childBit, p.email].filter(Boolean).join(" · ") || undefined;
}

export default function UserManagementScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("students");
  const [query, setQuery] = useState("");

  const studentsQ = useStudents({});
  const teachersQ = useTeachers({});
  const parentsQ = useParents({});

  const q = query.trim();
  const searchQ = useSearchUsers(q);
  const searching = q.length > 0;

  const activeQ = tab === "students" ? studentsQ : tab === "teachers" ? teachersQ : parentsQ;

  const roster = useMemo<PersonLike[]>(() => listOf(activeQ.data), [activeQ.data]);

  // Cross-roster search results (server-side), normalized to PersonLike rows.
  const searchResults = useMemo<PersonLike[]>(() => listOf(searchQ.data), [searchQ.data]);

  // Local fallback filter over the active roster (kicks in if search soft-misses).
  const localFiltered = useMemo<PersonLike[]>(() => {
    if (!searching) return roster;
    const needle = q.toLowerCase();
    return roster.filter((p) => {
      const hay = [fullName(p), p.email, p.rollNumber, p.employeeId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [roster, searching, q]);

  const rows = searching ? (searchResults.length > 0 ? searchResults : localFiltered) : roster;

  const tabs: { key: TabKey; label: string; count: number | null }[] = [
    { key: "students", label: "Students", count: countOf(studentsQ.data) },
    { key: "teachers", label: "Teachers", count: countOf(teachersQ.data) },
    { key: "parents", label: "Parents", count: countOf(parentsQ.data) },
  ];

  const loading = searching ? searchQ.isLoading && rows.length === 0 : activeQ.isLoading;
  const hardError = searching ? isHardError(searchQ) && rows.length === 0 : isHardError(activeQ);

  return (
    <PeopleScreen>
      <TopBar
        title="People"
        subtitle="Manage your tenant roster"
        right={
          <Badge variant="brand" icon={<Icon name="users" size={12} />}>
            Roster
          </Badge>
        }
      />

      {/* shortcuts to the sibling people screens */}
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Icon name="briefcase" size={15} />}
          onPress={() => router.push(routes.staff())}
        >
          Staff
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Icon name="shield-check" size={15} />}
          onPress={() => router.push(routes.roles())}
        >
          Roles
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Icon name="link" size={15} />}
          onPress={() => router.push(routes.parents())}
        >
          Parent links
        </Button>
      </View>

      <Segmented options={tabs} value={tab} onChange={setTab} />

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search users by name or email"
        onClear={() => setQuery("")}
      />

      <Card className="gap-2">
        <SectionHeader
          title={searching ? "Search results" : tabs.find((t) => t.key === tab)?.label}
          subtitle={
            searching
              ? `${rows.length} match${rows.length === 1 ? "" : "es"}`
              : `${roster.length} in this tenant`
          }
        />

        {loading ? (
          <RosterSkeleton rows={6} />
        ) : hardError ? (
          <LoadError onRetry={() => activeQ.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={searching ? "search-x" : "users"}
            title={searching ? "No matches" : "No users yet"}
            body={
              searching
                ? "Try a different name or email."
                : "Members appear here once the admin identity service is live or you invite users."
            }
          />
        ) : (
          rows.map((p, i) => {
            const kind = (p.role as TabKey | undefined) ?? (searching ? inferKind(p) : tab);
            return (
              <PersonRow
                key={p.id ?? `${kind}-${i}`}
                person={p}
                subtitle={subtitleFor(tab, p)}
                onPress={() => (p.id ? router.push(routes.userDetail(p.id, kind)) : undefined)}
              />
            );
          })
        )}
      </Card>

      <PendingNote>
        Rosters populate once the admin identity callables deploy to lvlup-ff6fa. Until then this
        reads empty — not an error.
      </PendingNote>
    </PeopleScreen>
  );
}

/** Best-effort kind inference for a search row (shape varies by server). */
function inferKind(p: PersonLike): TabKey {
  const r = (p.role as string | undefined)?.toLowerCase();
  if (r?.includes("teacher")) return "teachers";
  if (r?.includes("parent")) return "parents";
  if (Array.isArray(p.subjects) && p.subjects.length > 0) return "teachers";
  if (Array.isArray(p.studentIds) && p.studentIds.length > 0) return "parents";
  return "students";
}
