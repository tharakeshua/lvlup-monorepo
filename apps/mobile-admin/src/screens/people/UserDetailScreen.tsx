/**
 * UserDetailScreen — a single member's profile (student/teacher/parent/staff).
 *
 * Design: detail of the user-management card (admin tenant surface).
 * Route:  /admin/people/user?userId=&kind=
 * Data:   useStudent / useTeacher for the entity detail (enabled per `kind`);
 *         parent + staff have no detail callable, so they resolve from the
 *         useParents / useStaff rosters. All reads soft-miss to empty until the
 *         identity callables deploy (see lib/query-status) — the screen then
 *         shows a graceful "not available yet" state, never an error.
 *
 * Self-contained: reads params via expo-router; navigates via ../../lib/routes.
 */
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useParents, useStaff, useStudent, useTeacher } from "@levelup/query";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  ListRow,
  SectionHeader,
  Skeleton,
  TopBar,
  type BadgeProps,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import {
  fullName,
  initialsOf,
  listOf,
  LoadError,
  PeopleScreen,
  statusMeta,
  type PersonLike,
} from "./_shared/people";

type Kind = "student" | "teacher" | "parent" | "staff";

const KIND_META: Record<Kind, { label: string; icon: string; variant: BadgeProps["variant"] }> = {
  student: { label: "Student", icon: "graduation-cap", variant: "success" },
  teacher: { label: "Teacher", icon: "presentation", variant: "info" },
  parent: { label: "Parent", icon: "users", variant: "neutral" },
  staff: { label: "Staff", icon: "briefcase", variant: "warning" },
};

function normalizeKind(raw?: string): Kind {
  const k = (raw ?? "").toLowerCase();
  if (k === "teacher" || k === "teachers") return "teacher";
  if (k === "parent" || k === "parents") return "parent";
  if (k === "staff") return "staff";
  return "student";
}

/** A labelled field row; renders nothing when the value is empty. */
function Field({ icon, label, value }: { icon: string; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row items-center gap-3 py-2">
      <Icon name={icon} size={16} color="#756E61" />
      <Text className="text-text-muted w-28 text-xs uppercase tracking-wide">{label}</Text>
      <Text className="text-text-primary flex-1 text-sm">{value}</Text>
    </View>
  );
}

export default function UserDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; kind?: string }>();
  const userId = typeof params.userId === "string" ? params.userId : "";
  const kind = normalizeKind(typeof params.kind === "string" ? params.kind : undefined);

  // Only the matching detail hook fires (empty id ⇒ disabled). Parent/staff have
  // no detail callable → resolve from their roster lists.
  const studentQ = useStudent(kind === "student" ? userId : "");
  const teacherQ = useTeacher(kind === "teacher" ? userId : "");
  const parentsQ = useParents({});
  const staffQ = useStaff({});

  const fromList = (res: unknown): PersonLike | undefined =>
    listOf<PersonLike>(res).find((p) => p.id === userId);

  const detailQ = kind === "student" ? studentQ : kind === "teacher" ? teacherQ : null;

  const person = useMemo<PersonLike | null>(() => {
    if (kind === "student") return (studentQ.data as PersonLike | undefined) ?? null;
    if (kind === "teacher") return (teacherQ.data as PersonLike | undefined) ?? null;
    if (kind === "parent") return fromList(parentsQ.data) ?? null;
    return fromList(staffQ.data) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, studentQ.data, teacherQ.data, parentsQ.data, staffQ.data, userId]);

  const meta = KIND_META[kind];

  const loading =
    kind === "student"
      ? studentQ.isLoading
      : kind === "teacher"
        ? teacherQ.isLoading
        : kind === "parent"
          ? parentsQ.isLoading
          : staffQ.isLoading;

  const listForKind = kind === "parent" ? parentsQ : kind === "staff" ? staffQ : detailQ;
  const hardError = listForKind ? isHardError(listForKind) : false;

  if (!userId) {
    return (
      <PeopleScreen>
        <TopBar title="User" onBack={() => router.back()} />
        <EmptyState
          icon="user-x"
          title="No user selected"
          body="Open a member from the roster to see their profile."
        />
      </PeopleScreen>
    );
  }

  const name = person ? fullName(person) : meta.label;
  const st = statusMeta(person?.status);

  return (
    <PeopleScreen>
      <TopBar title={meta.label} subtitle="Member profile" onBack={() => router.back()} />

      {loading && !person ? (
        <Card className="gap-3">
          <View className="flex-row items-center gap-3">
            <Skeleton variant="circle" width={56} height={56} />
            <View className="flex-1 gap-2">
              <Skeleton width="60%" height={18} />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
          <Skeleton width="100%" height={12} />
          <Skeleton width="80%" height={12} />
        </Card>
      ) : hardError && !person ? (
        <LoadError onRetry={() => listForKind?.refetch?.()} />
      ) : !person ? (
        <Card className="items-center gap-3 py-8">
          <Icon name={meta.icon} size={28} color="#756E61" />
          <Text className="font-display text-text-primary text-base">
            Profile not available yet
          </Text>
          <Text className="text-text-muted px-6 text-center text-sm">
            This member’s details light up once the admin identity service is live for this tenant.
          </Text>
          <Text className="text-2xs text-text-muted font-mono">{userId}</Text>
        </Card>
      ) : (
        <>
          {/* identity header */}
          <Card className="gap-3">
            <View className="flex-row items-center gap-3">
              <Avatar initials={initialsOf(name)} size="xl" />
              <View className="flex-1 gap-1">
                <Text className="font-display text-text-primary text-xl">{name}</Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Badge variant={meta.variant} icon={<Icon name={meta.icon} size={12} />}>
                    {meta.label}
                  </Badge>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </View>
              </View>
            </View>
            {person.email || person.phone ? (
              <View className="flex-row flex-wrap gap-2">
                {person.email ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Icon name="mail" size={15} />}
                  >
                    {person.email}
                  </Button>
                ) : null}
                {person.phone ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Icon name="phone" size={15} />}
                  >
                    {person.phone}
                  </Button>
                ) : null}
              </View>
            ) : null}
          </Card>

          {/* details */}
          <Card className="gap-0">
            <SectionHeader title="Details" />
            <Divider />
            <Field icon="hash" label="ID" value={person.id} />
            <Field icon="mail" label="Email" value={person.email} />
            <Field icon="phone" label="Phone" value={person.phone} />
            {kind === "student" ? (
              <>
                <Field icon="hash" label="Roll no." value={person.rollNumber} />
                <Field icon="layers" label="Grade" value={person.grade} />
                <Field icon="rows" label="Section" value={person.section} />
              </>
            ) : null}
            {kind === "teacher" ? (
              <>
                <Field icon="id-card" label="Employee" value={person.employeeId} />
                <Field icon="building" label="Department" value={person.department} />
                <Field icon="briefcase" label="Designation" value={person.designation} />
                <Field
                  icon="book"
                  label="Subjects"
                  value={Array.isArray(person.subjects) ? person.subjects.join(", ") : undefined}
                />
              </>
            ) : null}
            {kind === "staff" ? (
              <Field icon="building" label="Department" value={person.department} />
            ) : null}
          </Card>

          {/* linked entities */}
          {kind === "parent" && Array.isArray(person.studentIds) && person.studentIds.length > 0 ? (
            <Card className="gap-2">
              <SectionHeader
                title="Linked children"
                subtitle={`${person.studentIds.length} linked`}
                action={
                  <Button variant="ghost" size="sm" onPress={() => router.push(routes.parents())}>
                    Manage
                  </Button>
                }
              />
              {(person.linkedStudentNames && person.linkedStudentNames.length > 0
                ? person.linkedStudentNames
                : person.studentIds
              ).map((c, i) => (
                <ListRow
                  key={`${c}-${i}`}
                  title={c}
                  leading={<Icon name="graduation-cap" size={18} />}
                />
              ))}
            </Card>
          ) : null}

          {(kind === "student" || kind === "teacher") &&
          Array.isArray(person.classIds) &&
          person.classIds.length > 0 ? (
            <Card className="gap-2">
              <SectionHeader title="Classes" subtitle={`${person.classIds.length} assigned`} />
              {person.classIds.map((c, i) => (
                <ListRow
                  key={`${c}-${i}`}
                  title={c}
                  leading={<Icon name="school" size={18} />}
                  onPress={() => router.push(routes.classDetail(c))}
                />
              ))}
            </Card>
          ) : null}
        </>
      )}
    </PeopleScreen>
  );
}
