/**
 * ParentLinkingScreen — parents ↔ children guardian links.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/parent-linking.card.html
 * Route:  /admin/people/parents
 * Data:   useParents (roster + their studentIds) · useStudents (resolve child
 *         names + the link picker) · useSaveParent (⚷ write the link set) ·
 *         useLinkedChildren (the signed-in user's own children — surfaced only
 *         if present; harmless for an admin). All reads soft-miss to empty until
 *         the identity callables deploy (see lib/query-status).
 *
 * Self-contained: navigates via expo-router + ../../lib/routes.
 */
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useLinkedChildren, useParents, useSaveParent, useStudents } from "@levelup/query";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  ListRow,
  SearchField,
  SectionHeader,
  Sheet,
  TopBar,
} from "../../components";
import { isHardError } from "../../lib/query-status";
import {
  countOf,
  fullName,
  initialsOf,
  listOf,
  LoadError,
  PendingNote,
  PeopleScreen,
  statusMeta,
  StatPill,
  RosterSkeleton,
  type PersonLike,
} from "./_shared/people";

type FilterKey = "all" | "linked" | "unlinked";

/** studentIds carried by a parent doc (canonical `studentIds`, defensive). */
function childIdsOf(p: PersonLike): string[] {
  const ids = p.studentIds ?? (p as { childStudentIds?: string[] }).childStudentIds;
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
}

export default function ParentLinkingScreen() {
  const router = useRouter();
  const parentsQ = useParents({});
  const studentsQ = useStudents({});
  const saveParent = useSaveParent();
  const linkedChildrenQ = useLinkedChildren({});

  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  // link sheet state
  const [editing, setEditing] = useState<PersonLike | null>(null);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [sheetError, setSheetError] = useState<string | null>(null);

  const parents = useMemo<PersonLike[]>(() => listOf(parentsQ.data), [parentsQ.data]);
  const students = useMemo<PersonLike[]>(() => listOf(studentsQ.data), [studentsQ.data]);

  const studentById = useMemo(() => {
    const m = new Map<string, PersonLike>();
    students.forEach((s) => s.id && m.set(s.id, s));
    return m;
  }, [students]);

  const childNames = (p: PersonLike): string[] =>
    childIdsOf(p).map((id) => {
      const s = studentById.get(id);
      return s ? fullName(s) : id;
    });

  const linkedCount = parents.filter((p) => childIdsOf(p).length > 0).length;
  const unlinkedCount = parents.length - linkedCount;

  const filtered = useMemo<PersonLike[]>(() => {
    let list = parents;
    if (filter === "linked") list = list.filter((p) => childIdsOf(p).length > 0);
    else if (filter === "unlinked") list = list.filter((p) => childIdsOf(p).length === 0);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        [fullName(p), p.email, ...childNames(p)].filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parents, filter, query, studentById]);

  // open the link sheet seeded with the parent's current links
  const openLink = (p: PersonLike) => {
    setEditing(p);
    setDraftIds(childIdsOf(p));
    setPickerQuery("");
    setSheetError(null);
  };

  const toggleChild = (id: string) =>
    setDraftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pickerResults = useMemo<PersonLike[]>(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 25);
    return students.filter((s) =>
      [fullName(s), s.email, s.rollNumber].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [students, pickerQuery]);

  const saveLinks = () => {
    if (!editing) return;
    setSheetError(null);
    saveParent.mutate(
      { id: editing.id, studentIds: draftIds },
      {
        onSuccess: () => setEditing(null),
        onError: (e: unknown) =>
          setSheetError(e instanceof Error ? e.message : "Could not update links."),
      }
    );
  };

  const myChildren = useMemo(() => listOf(linkedChildrenQ.data), [linkedChildrenQ.data]);

  return (
    <PeopleScreen>
      <TopBar
        title="Parent linking"
        subtitle="Connect guardians to their children"
        onBack={() => router.back()}
      />

      {/* stat pills */}
      <View className="flex-row gap-3">
        <StatPill label="Parents" value={countOf(parentsQ.data) ?? 0} />
        <StatPill label="Linked" value={linkedCount} />
        <StatPill label="Not linked" value={unlinkedCount} />
      </View>

      {/* the signed-in user's own children (parent-portal context) — usually
          empty for an admin; shown only when the read returns rows. */}
      {myChildren.length > 0 ? (
        <Card className="gap-2">
          <SectionHeader title="Your linked children" />
          {myChildren.map((c, i) => {
            const name = fullName(c as PersonLike);
            return (
              <ListRow
                key={(c as PersonLike).id ?? `mychild-${i}`}
                title={name}
                leading={<Avatar initials={initialsOf(name)} size="md" />}
              />
            );
          })}
        </Card>
      ) : null}

      {/* filter + search */}
      <View className="flex-row gap-2">
        {(
          [
            { key: "all", label: "All" },
            { key: "linked", label: `Linked ${linkedCount}` },
            { key: "unlinked", label: `Not linked ${unlinkedCount}` },
          ] as { key: FilterKey; label: string }[]
        ).map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)}>
            <Chip active={filter === f.key}>{f.label}</Chip>
          </Pressable>
        ))}
      </View>

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search parents or children"
        onClear={() => setQuery("")}
      />

      <Card className="gap-2">
        <SectionHeader title="Parents" subtitle={`${filtered.length} shown`} />
        {parentsQ.isLoading ? (
          <RosterSkeleton rows={5} />
        ) : isHardError(parentsQ) ? (
          <LoadError onRetry={() => parentsQ.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="link"
            title={parents.length === 0 ? "No parents yet" : "No matches"}
            body={
              parents.length === 0
                ? "Parents appear here once the identity service is live or you invite guardians."
                : "Try a different filter or search."
            }
          />
        ) : (
          filtered.map((p, i) => {
            const ids = childIdsOf(p);
            const names = childNames(p);
            const st = statusMeta(p.status);
            const name = fullName(p);
            const sub =
              ids.length === 0
                ? "Not linked"
                : `${ids.length} child${ids.length === 1 ? "" : "ren"} · ${names.slice(0, 2).join(", ")}${
                    names.length > 2 ? "…" : ""
                  }`;
            return (
              <ListRow
                key={p.id ?? `parent-${i}`}
                title={name}
                subtitle={sub}
                leading={<Avatar initials={initialsOf(name)} size="md" />}
                trailing={
                  <View className="flex-row items-center gap-2">
                    <Badge variant={ids.length > 0 ? "success" : "neutral"}>
                      {ids.length > 0 ? "Linked" : st.label}
                    </Badge>
                  </View>
                }
                onPress={() => openLink(p)}
              />
            );
          })
        )}
      </Card>

      <PendingNote>
        Links grant parent-portal access as soon as claims re-sync (up to 1 hour). Saving is enabled
        now; the roster fills once the identity service is live.
      </PendingNote>

      {/* link-children sheet */}
      <Sheet
        open={editing != null}
        onClose={() => setEditing(null)}
        title={editing ? `Link children · ${fullName(editing)}` : "Link children"}
      >
        <View className="gap-3">
          {sheetError ? (
            <Alert
              variant="error"
              title="Couldn’t save"
              icon={<Icon name="alert-triangle" size={18} />}
            >
              {sheetError}
            </Alert>
          ) : null}

          <Alert variant="info" icon={<Icon name="info" size={16} />}>
            Linked guardians can view these children’s progress, results, and attendance — and
            nothing about other students.
          </Alert>

          {/* currently staged links */}
          <View className="gap-1">
            <Text className="text-2xs text-text-muted font-semibold uppercase tracking-wide">
              Linked ({draftIds.length})
            </Text>
            {draftIds.length === 0 ? (
              <Text className="text-text-muted text-sm">
                No children linked. Search below to add one.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {draftIds.map((id) => {
                  const s = studentById.get(id);
                  return (
                    <Chip key={id} removable onRemove={() => toggleChild(id)}>
                      {s ? fullName(s) : id}
                    </Chip>
                  );
                })}
              </View>
            )}
          </View>

          {/* student picker */}
          <View className="gap-2">
            <Text className="text-2xs text-text-muted font-semibold uppercase tracking-wide">
              Add a child
            </Text>
            <SearchField
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Search students"
              onClear={() => setPickerQuery("")}
            />
            {students.length === 0 ? (
              <Text className="text-text-muted text-sm">
                No students available yet. They appear once the Students roster is live.
              </Text>
            ) : pickerResults.length === 0 ? (
              <Text className="text-text-muted text-sm">No students match that search.</Text>
            ) : (
              <View className="max-h-64 gap-1">
                {pickerResults.map((s) => {
                  const linked = s.id ? draftIds.includes(s.id) : false;
                  const sName = fullName(s);
                  return (
                    <ListRow
                      key={s.id ?? sName}
                      title={sName}
                      subtitle={
                        [s.rollNumber && `Roll ${s.rollNumber}`, s.grade]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                      leading={<Avatar initials={initialsOf(sName)} size="sm" />}
                      trailing={
                        <Button
                          variant={linked ? "ghost" : "secondary"}
                          size="sm"
                          leadingIcon={<Icon name={linked ? "check" : "plus"} size={14} />}
                          onPress={() => s.id && toggleChild(s.id)}
                        >
                          {linked ? "Linked" : "Add"}
                        </Button>
                      }
                    />
                  );
                })}
              </View>
            )}
          </View>

          <View className="mt-1 flex-row justify-end gap-2">
            <Button
              variant="ghost"
              onPress={() => setEditing(null)}
              disabled={saveParent.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saveParent.isPending}
              disabled={saveParent.isPending || editing?.id == null}
              leadingIcon={<Icon name="check" size={15} />}
              onPress={saveLinks}
            >
              Save links
            </Button>
          </View>
        </View>
      </Sheet>
    </PeopleScreen>
  );
}
