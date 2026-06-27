/**
 * ClassManagementScreen — the Academics tab landing (class roster).
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/class-management.card.html
 * Route:  /admin/academics
 * Data:   useClasses() (admin identity callable — soft-misses to empty until
 *         SDK-coord deploys the identity group, per lib/query-status) +
 *         useSaveClass() to create a class.
 *
 * Desktop table → stacked ListRow cards; "New class" opens a Modal form.
 */
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useClasses, useSaveClass } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  ListRow,
  Modal,
  Screen,
  SearchField,
  SectionHeader,
  Skeleton,
  StatTile,
  TextField,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { listOf, num, statusBadge, str } from "./_shared";

interface ClassRow {
  id?: string;
  name?: string;
  grade?: string;
  section?: string;
  status?: string;
  studentCount?: number;
  studentIds?: unknown[];
  teacherIds?: unknown[];
}

export default function ClassManagementScreen() {
  const router = useRouter();
  const classesQ = useClasses({});
  const saveClass = useSaveClass();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");

  const classes = useMemo(() => listOf<ClassRow>(classesQ.data), [classesQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (c) => str(c.name).toLowerCase().includes(q) || str(c.grade).toLowerCase().includes(q)
    );
  }, [classes, search]);

  const studentsOf = (c: ClassRow) => num(c.studentCount, NaN) || listOf(c.studentIds).length;

  const active = classes.filter((c) => str(c.status, "active") !== "archived").length;
  const archived = classes.filter((c) => str(c.status) === "archived").length;
  const totalStudents = classes.reduce((sum, c) => sum + studentsOf(c), 0);

  const resetForm = () => {
    setName("");
    setGrade("");
    setSection("");
  };

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      await saveClass.mutateAsync({
        name: name.trim(),
        grade: grade.trim() || undefined,
        section: section.trim() || undefined,
        status: "active",
      } as never);
      setShowCreate(false);
      resetForm();
    } catch {
      // mutation surfaces its own error state; keep the form open to retry.
    }
  };

  return (
    <Screen scroll>
      <TopBar
        title="Classes"
        subtitle="Manage class groups & rosters"
        right={
          <Button size="sm" leadingIcon="plus" onPress={() => setShowCreate(true)}>
            New class
          </Button>
        }
      />

      {/* KPI tiles */}
      <View className="flex-row flex-wrap gap-3">
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Classes"
            value={classesQ.isLoading ? "…" : String(classes.length)}
            icon="school"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Active"
            value={classesQ.isLoading ? "…" : String(active)}
            icon="check-circle"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Students"
            value={classesQ.isLoading ? "…" : String(totalStudents)}
            icon="users"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Archived"
            value={classesQ.isLoading ? "…" : String(archived)}
            icon="archive"
          />
        </View>
      </View>

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Search classes…"
        onClear={() => setSearch("")}
      />

      <Card className="gap-1">
        <SectionHeader
          title="All classes"
          subtitle={filtered.length ? `${filtered.length} shown` : undefined}
        />

        {classesQ.isLoading ? (
          <View className="gap-2 py-2">
            <Skeleton variant="rect" />
            <Skeleton variant="rect" />
            <Skeleton variant="rect" />
          </View>
        ) : isHardError(classesQ) ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load classes"
            body="Something went wrong reading the class roster."
            action={
              <Button size="sm" variant="secondary" onPress={() => classesQ.refetch()}>
                Retry
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="school"
            title={classes.length === 0 ? "No classes yet" : "No matches"}
            body={
              classes.length === 0
                ? "Create your first class to start grouping students and teachers."
                : "Try a different search."
            }
            action={
              classes.length === 0 ? (
                <Button size="sm" onPress={() => setShowCreate(true)}>
                  Create a class
                </Button>
              ) : undefined
            }
          />
        ) : (
          filtered.map((c, i) => {
            const sb = statusBadge(c.status ?? "active");
            const gradeSection = [c.grade && `Grade ${c.grade}`, c.section && `Sec ${c.section}`]
              .filter(Boolean)
              .join(" · ");
            return (
              <ListRow
                key={str(c.id) || String(i)}
                title={str(c.name, "Untitled class")}
                subtitle={[gradeSection, `${studentsOf(c)} students`].filter(Boolean).join("  ·  ")}
                leading={<Icon name="school" size={18} />}
                trailing={<Badge variant={sb.variant}>{sb.label}</Badge>}
                onPress={() => c.id && router.push(routes.classDetail(str(c.id)))}
              />
            );
          })
        )}
      </Card>

      {/* Create-class modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New class"
        footer={
          <>
            <Button variant="ghost" size="sm" onPress={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={saveClass.isPending}
              disabled={!name.trim()}
              onPress={onCreate}
            >
              Create
            </Button>
          </>
        }
      >
        <View className="gap-3">
          <TextField
            label="Class name"
            placeholder="e.g. Mathematics 10A"
            value={name}
            onChangeText={setName}
            required
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField label="Grade" placeholder="10" value={grade} onChangeText={setGrade} />
            </View>
            <View className="flex-1">
              <TextField
                label="Section"
                placeholder="A"
                value={section}
                onChangeText={setSection}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
