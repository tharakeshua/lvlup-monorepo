/**
 * StaffManagementScreen — non-teaching staff roster + invite/edit.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/staff-management.card.html
 * Route:  /admin/people/staff
 * Data:   useStaff (roster) + useSaveStaff (⚷ invite/edit — claims-affecting,
 *         NOT optimistic). Reads soft-miss to empty until the identity callables
 *         deploy (see lib/query-status).
 *
 * Self-contained: navigates via expo-router + ../../lib/routes.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSaveStaff, useStaff } from "@levelup/query";

import {
  Alert,
  Button,
  Card,
  EmptyState,
  Icon,
  SearchField,
  SectionHeader,
  Sheet,
  TextField,
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
  type PersonLike,
} from "./_shared/people";

interface StaffForm {
  firstName: string;
  lastName: string;
  email: string;
  department: string;
}

const EMPTY_FORM: StaffForm = { firstName: "", lastName: "", email: "", department: "" };

export default function StaffManagementScreen() {
  const router = useRouter();
  const staffQ = useStaff({});
  const saveStaff = useSaveStaff();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const staff = useMemo<PersonLike[]>(() => listOf(staffQ.data), [staffQ.data]);

  const filtered = useMemo<PersonLike[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((p) =>
      [fullName(p), p.email, p.department].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [staff, query]);

  const set = (k: keyof StaffForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.firstName.trim().length > 0 && !saveStaff.isPending;

  const submit = () => {
    setSubmitError(null);
    saveStaff.mutate(
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        department: form.department.trim() || undefined,
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setOpen(false);
        },
        onError: (e: unknown) =>
          setSubmitError(e instanceof Error ? e.message : "Could not save staff member."),
      }
    );
  };

  return (
    <PeopleScreen>
      <TopBar
        title="Staff"
        subtitle="Non-teaching team members"
        onBack={() => router.back()}
        right={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Icon name="plus" size={15} />}
            onPress={() => {
              setForm(EMPTY_FORM);
              setSubmitError(null);
              setOpen(true);
            }}
          >
            Add
          </Button>
        }
      />

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search staff"
        onClear={() => setQuery("")}
      />

      <Card className="gap-2">
        <SectionHeader title="Staff members" subtitle={`${countOf(staffQ.data) ?? 0} total`} />
        {staffQ.isLoading ? (
          <RosterSkeleton rows={5} />
        ) : isHardError(staffQ) ? (
          <LoadError onRetry={() => staffQ.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="briefcase"
            title={query ? "No matches" : "No staff yet"}
            body={
              query
                ? "Try a different search."
                : "Add front-desk, operations, or admin staff to give them scoped access."
            }
            action={
              !query ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Icon name="plus" size={15} />}
                  onPress={() => setOpen(true)}
                >
                  Add staff
                </Button>
              ) : undefined
            }
          />
        ) : (
          filtered.map((p, i) => (
            <PersonRow
              key={p.id ?? `staff-${i}`}
              person={p}
              subtitle={[p.department, p.email].filter(Boolean).join(" · ") || undefined}
              onPress={() => (p.id ? router.push(routes.userDetail(p.id, "staff")) : undefined)}
            />
          ))
        )}
      </Card>

      <PendingNote>
        Staff invites write via the admin identity service. Saving is enabled now; the roster fills
        once that service is live for this tenant.
      </PendingNote>

      {/* Add / invite staff sheet */}
      <Sheet open={open} onClose={() => setOpen(false)} title="Add staff member">
        <View className="gap-3">
          {submitError ? (
            <Alert
              variant="error"
              title="Couldn’t save"
              icon={<Icon name="alert-triangle" size={18} />}
            >
              {submitError}
            </Alert>
          ) : null}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label="First name"
                required
                value={form.firstName}
                onChangeText={set("firstName")}
                placeholder="Jordan"
                autoCapitalize="words"
              />
            </View>
            <View className="flex-1">
              <TextField
                label="Last name"
                value={form.lastName}
                onChangeText={set("lastName")}
                placeholder="Lee"
                autoCapitalize="words"
              />
            </View>
          </View>
          <TextField
            label="Email"
            value={form.email}
            onChangeText={set("email")}
            placeholder="jordan@school.edu"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label="Department"
            value={form.department}
            onChangeText={set("department")}
            placeholder="Operations"
          />
          <View className="mt-1 flex-row justify-end gap-2">
            <Button variant="ghost" onPress={() => setOpen(false)} disabled={saveStaff.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saveStaff.isPending}
              disabled={!canSubmit}
              leadingIcon={<Icon name="check" size={15} />}
              onPress={submit}
            >
              Save
            </Button>
          </View>
          <Text className="text-2xs text-text-muted">
            Saving sends an invite and provisions a scoped membership. ⚷
          </Text>
        </View>
      </Sheet>
    </PeopleScreen>
  );
}
