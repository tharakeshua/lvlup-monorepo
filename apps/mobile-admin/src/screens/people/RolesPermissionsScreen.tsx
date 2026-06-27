/**
 * RolesPermissionsScreen — memberships + roles + the permission reference.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/memberships-roles-permissions.card.html
 * Route:  /admin/people/roles
 * Data:   role distribution from the rosters (useStudents/useTeachers/useParents/
 *         useStaff) + a cross-tenant membership search (useSearchUsers). The
 *         permission MATRIX + per-role catalogs are static reference (verbatim
 *         from the design §7 / CreateStaffDialog). All reads soft-miss to empty
 *         until the identity callables deploy (see lib/query-status).
 *
 * Self-contained: navigates via expo-router + ../../lib/routes.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useParents, useSearchUsers, useStaff, useStudents, useTeachers } from "@levelup/query";

import {
  Accordion,
  Avatar,
  Badge,
  Card,
  Divider,
  EmptyState,
  Icon,
  ListRow,
  SearchField,
  SectionHeader,
  StatTile,
  TopBar,
  type BadgeProps,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import {
  countOf,
  fullName,
  initialsOf,
  listOf,
  LoadError,
  PendingNote,
  PeopleScreen,
  type PersonLike,
} from "./_shared/people";

// ── static permission reference (verbatim from the design) ───────────────────
const MATRIX_COLS = ["Admin", "Teacher", "Staff", "Other"] as const;
type Glyph = "always" | "grant" | "never";
const MATRIX: { perm: string; cells: Glyph[] }[] = [
  { perm: "Manage users", cells: ["always", "never", "grant", "never"] },
  { perm: "Create exams", cells: ["always", "grant", "never", "never"] },
  { perm: "Edit rubrics", cells: ["always", "grant", "never", "never"] },
  { perm: "Manually grade", cells: ["always", "grant", "never", "never"] },
  { perm: "View analytics", cells: ["always", "grant", "grant", "never"] },
  { perm: "Export data", cells: ["always", "never", "grant", "never"] },
  { perm: "Manage billing", cells: ["always", "never", "grant", "never"] },
  { perm: "Manage settings", cells: ["always", "never", "grant", "never"] },
];
const TEACHER_PERMS = [
  "Create exams",
  "Edit rubrics",
  "Manually grade",
  "View analytics",
  "Configure agents",
];
const STAFF_PERMS = [
  "Manage Users",
  "Manage Classes",
  "View Analytics",
  "Export Data",
  "Manage Settings",
  "Manage Billing",
];

function glyphMeta(g: Glyph): { icon: string; color: string; hint: string } {
  if (g === "always") return { icon: "check-circle", color: "#2E7D5B", hint: "Always" };
  if (g === "grant") return { icon: "circle-dashed", color: "#B07A1E", hint: "Grantable" };
  return { icon: "minus", color: "#9A9384", hint: "Never" };
}

/** Role → Badge variant + label. Free strings allowed. */
function roleMeta(role?: string): { variant: BadgeProps["variant"]; label: string } {
  const r = (role ?? "").toLowerCase();
  if (r.includes("admin") || r.includes("owner")) return { variant: "brand", label: "Admin" };
  if (r.includes("teacher")) return { variant: "info", label: "Teacher" };
  if (r.includes("staff")) return { variant: "warning", label: "Staff" };
  if (r.includes("parent")) return { variant: "neutral", label: "Parent" };
  if (r.includes("scanner")) return { variant: "neutral", label: "Scanner" };
  if (r.includes("student")) return { variant: "success", label: "Student" };
  return { variant: "neutral", label: role || "Member" };
}

export default function RolesPermissionsScreen() {
  const router = useRouter();
  const studentsQ = useStudents({});
  const teachersQ = useTeachers({});
  const parentsQ = useParents({});
  const staffQ = useStaff({});

  const [query, setQuery] = useState("");
  const q = query.trim();
  const searchQ = useSearchUsers(q);
  const searching = q.length > 0;

  const members = useMemo<PersonLike[]>(() => listOf(searchQ.data), [searchQ.data]);

  const distribution = [
    { label: "Teachers", n: countOf(teachersQ.data), icon: "presentation" },
    { label: "Staff", n: countOf(staffQ.data), icon: "briefcase" },
    { label: "Students", n: countOf(studentsQ.data), icon: "graduation-cap" },
    { label: "Parents", n: countOf(parentsQ.data), icon: "users" },
  ] as const;

  return (
    <PeopleScreen>
      <TopBar
        title="Roles & permissions"
        subtitle="Memberships across the tenant"
        onBack={() => router.back()}
      />

      {/* role distribution */}
      <View className="flex-row flex-wrap gap-3">
        {distribution.map((d) => (
          <View key={d.label} className="min-w-[46%] flex-1">
            <StatTile label={d.label} value={d.n == null ? "—" : String(d.n)} icon={d.icon} />
          </View>
        ))}
      </View>

      {/* membership search */}
      <Card className="gap-2">
        <SectionHeader title="Find a member" subtitle="Search to view or change a role" />
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or email"
          onClear={() => setQuery("")}
        />
        {!searching ? (
          <EmptyState
            icon="search"
            title="Search memberships"
            body="Type a name or email to find a member and review their role and permissions."
          />
        ) : searchQ.isLoading ? (
          <View className="gap-2 py-2">
            <Text className="text-text-muted text-center text-xs">Searching…</Text>
          </View>
        ) : isHardError(searchQ) ? (
          <LoadError onRetry={() => searchQ.refetch()} />
        ) : members.length === 0 ? (
          <EmptyState
            icon="search-x"
            title="No members found"
            body="Try a different name or email."
          />
        ) : (
          members.map((m, i) => {
            const name = fullName(m);
            const rm = roleMeta(m.role);
            return (
              <ListRow
                key={m.id ?? `member-${i}`}
                title={name}
                subtitle={m.email ?? undefined}
                leading={<Avatar initials={initialsOf(name)} size="md" />}
                trailing={<Badge variant={rm.variant}>{rm.label}</Badge>}
                onPress={() =>
                  m.id ? router.push(routes.userDetail(m.id, roleKind(m.role))) : undefined
                }
              />
            );
          })
        )}
      </Card>

      {/* permission matrix reference (read-only) */}
      <Card className="gap-2">
        <SectionHeader
          title="Permission matrix"
          subtitle="What each role can do"
          action={
            <View className="flex-row items-center gap-2">
              <LegendDot icon="check-circle" color="#2E7D5B" label="Always" />
              <LegendDot icon="circle-dashed" color="#B07A1E" label="Grant" />
              <LegendDot icon="minus" color="#9A9384" label="Never" />
            </View>
          }
        />
        {/* header row */}
        <View className="border-border-subtle flex-row items-center border-b pb-2">
          <Text className="text-2xs text-text-muted flex-1 font-semibold uppercase tracking-wide">
            Permission
          </Text>
          {MATRIX_COLS.map((c) => (
            <Text
              key={c}
              className="text-2xs text-text-muted w-12 text-center font-semibold uppercase tracking-wide"
            >
              {c}
            </Text>
          ))}
        </View>
        {MATRIX.map((row) => (
          <View key={row.perm} className="flex-row items-center py-1.5">
            <Text className="text-text-secondary flex-1 text-sm">{row.perm}</Text>
            {row.cells.map((cell, idx) => {
              const g = glyphMeta(cell);
              return (
                <View key={idx} className="w-12 items-center">
                  <Icon name={g.icon} size={15} color={g.color} />
                </View>
              );
            })}
          </View>
        ))}
      </Card>

      {/* grantable permission catalogs */}
      <Accordion
        items={[
          {
            key: "teacher",
            title: "Teacher permissions",
            content: <PermList perms={TEACHER_PERMS} />,
          },
          {
            key: "staff",
            title: "Staff permissions",
            content: <PermList perms={STAFF_PERMS} />,
          },
        ]}
      />

      <PendingNote>
        Live memberships and role changes light up once the admin identity callables deploy to
        lvlup-ff6fa. The matrix above is the fixed policy.
      </PendingNote>
    </PeopleScreen>
  );
}

function LegendDot({ icon, color, label }: { icon: string; color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Icon name={icon} size={12} color={color} />
      <Text className="text-2xs text-text-muted">{label}</Text>
    </View>
  );
}

function PermList({ perms }: { perms: string[] }) {
  return (
    <View className="gap-1 py-1">
      {perms.map((p, i) => (
        <View key={p}>
          {i > 0 ? <Divider /> : null}
          <View className="flex-row items-center gap-2 py-2">
            <Icon name="key" size={14} color="#756E61" />
            <Text className="text-text-secondary text-sm">{p}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Map a free role string to a UserDetail `kind`. */
function roleKind(role?: string): string {
  const r = (role ?? "").toLowerCase();
  if (r.includes("teacher")) return "teacher";
  if (r.includes("parent")) return "parent";
  if (r.includes("staff")) return "staff";
  return "student";
}
