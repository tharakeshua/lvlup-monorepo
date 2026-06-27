/**
 * Cross-class assignment tracker (assignment-tracker).
 *
 * One scrollable board of every class the teacher owns, each showing the content
 * assigned to it with a live completion bar and a status chip
 * (assigned · in-progress · overdue · done). A filter row narrows by status.
 *
 * There is no dedicated assignment callable yet, so assignments are read
 * DEFENSIVELY off each class doc (`assignments` / `assignedSpaces`). Heavy
 * authoring lives on the web app — each class links out to assign content.
 *
 * Data: useClasses() (the classes + embedded assignment rows) · useSpaces()
 * (assignable content fallback for titles). All payloads `unknown` → defensive.
 */
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useClasses, useSpaces } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  FilterChips,
  Icon,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { asList, num, obj, pct, pick, relTime, str, toMillis } from "../insights/_shared/readers";

/* ---------- status model ---------- */
type AssignmentStatus = "assigned" | "in-progress" | "overdue" | "done";

const STATUS_META: Record<
  AssignmentStatus,
  { label: string; variant: "neutral" | "info" | "error" | "success" }
> = {
  assigned: { label: "Assigned", variant: "neutral" },
  "in-progress": { label: "In progress", variant: "info" },
  overdue: { label: "Overdue", variant: "error" },
  done: { label: "Done", variant: "success" },
};

interface AssignmentRow {
  id: string;
  title: string;
  progress: number;
  status: AssignmentStatus;
  due: number | null;
}
interface ClassBoard {
  id: string;
  name: string;
  students: number;
  assignments: AssignmentRow[];
}

function deriveStatus(progress: number, due: number | null): AssignmentStatus {
  if (progress >= 100) return "done";
  if (due != null && due < Date.now()) return "overdue";
  if (progress > 0) return "in-progress";
  return "assigned";
}

function readAssignment(raw: Record<string, unknown>): AssignmentRow {
  const progress = pct(pick(raw, ["progress", "completion", "averageCompletion", "completionPct"]));
  const due = toMillis(pick(raw, ["dueDate", "dueAt", "deadline", "endDate"]));
  const explicit = str(pick(raw, ["status", "state"])).toLowerCase();
  const status: AssignmentStatus =
    explicit === "overdue" ||
    explicit === "done" ||
    explicit === "assigned" ||
    explicit === "in-progress"
      ? (explicit as AssignmentStatus)
      : deriveStatus(progress, due);
  return {
    id: str(pick(raw, ["id", "assignmentId", "spaceId", "contentId", "_id"])),
    title: str(pick(raw, ["title", "name", "spaceTitle", "contentTitle"]), "Untitled assignment"),
    progress,
    status,
    due,
  };
}

function readClassBoard(raw: Record<string, unknown>): ClassBoard {
  const assignmentsRaw =
    pick(raw, ["assignments", "assignedSpaces", "assignedContent", "tasks"]) ?? [];
  return {
    id: str(pick(raw, ["id", "classId", "uid", "_id"])),
    name: str(pick(raw, ["name", "className", "title"]), "Untitled class"),
    students: num(pick(raw, ["studentCount", "studentsCount", "enrolledCount"])),
    assignments: asList(assignmentsRaw)
      .map(readAssignment)
      .filter((a) => a.id || a.title),
  };
}

/* ---------- loading ---------- */
function LoadingState() {
  return (
    <View className="gap-6">
      <Skeleton width="55%" height={26} />
      <Skeleton width="100%" height={40} />
      {[0, 1].map((i) => (
        <Skeleton key={i} width="100%" height={150} />
      ))}
    </View>
  );
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "in-progress", label: "In progress" },
  { key: "overdue", label: "Overdue" },
  { key: "assigned", label: "Assigned" },
  { key: "done", label: "Done" },
];

/* ---------- screen ---------- */
export default function AssignmentTrackerScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");

  const classesQuery = useClasses();
  useSpaces(); // warm the content cache (titles); reads are defensive

  const boards = useMemo(
    () =>
      asList(classesQuery.data)
        .map(readClassBoard)
        .filter((b) => b.id),
    [classesQuery.data]
  );

  const overdueTotal = boards.reduce(
    (acc, b) => acc + b.assignments.filter((a) => a.status === "overdue").length,
    0
  );

  const filtered = boards
    .map((b) => ({
      ...b,
      assignments:
        filter === "all" ? b.assignments : b.assignments.filter((a) => a.status === filter),
    }))
    .filter((b) => b.assignments.length > 0 || filter === "all");

  const isLoading = classesQuery.isLoading && !classesQuery.data;
  const isError = isHardError(classesQuery);
  const hasAnyAssignment = boards.some((b) => b.assignments.length > 0);

  if (isError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-off"
          title="We couldn't load assignments"
          body="Let's try that again — this one's on us, not you."
          action={
            <Button
              variant="primary"
              leadingIcon="rotate-cw"
              onPress={() => classesQuery.refetch()}
            >
              Try again
            </Button>
          }
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-5">
        {/* HEADER */}
        <View className="gap-1">
          <Text className="font-display text-text-primary text-2xl font-semibold">Assignments</Text>
          <Text className="font-ui text-text-muted text-sm">
            {overdueTotal > 0
              ? `${overdueTotal} assignment${overdueTotal === 1 ? "" : "s"} overdue across your classes`
              : "Track what every class is working on."}
          </Text>
        </View>

        {/* FILTERS */}
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

        {/* BOARDS */}
        {boards.length === 0 ? (
          <EmptyState
            icon="list-todo"
            title="No classes to track yet"
            body="Once classes are assigned to you, the content you give them will appear here with live progress."
          />
        ) : !hasAnyAssignment ? (
          <EmptyState
            icon="clipboard-plus"
            title="Nothing assigned yet"
            body="Assign a space to a class to start tracking completion. Heavy authoring is best on the web app."
            action={
              <Button
                variant="primary"
                leadingIcon="plus"
                onPress={() => router.push(routes.classes())}
              >
                Go to classes
              </Button>
            }
          />
        ) : (
          filtered.map((board) => (
            <Card key={board.id} className="gap-3">
              <SectionHeader
                title={board.name}
                subtitle={`${board.students} students`}
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    trailingIcon="arrow-right"
                    onPress={() => router.push(routes.classDetail(board.id))}
                  >
                    Open
                  </Button>
                }
              />
              {board.assignments.length === 0 ? (
                <Text className="font-ui text-text-muted text-xs">No matching assignments.</Text>
              ) : (
                board.assignments.map((a) => {
                  const meta = STATUS_META[a.status];
                  return (
                    <View key={a.id || a.title} className="gap-1.5">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text
                          className="font-ui text-text-primary flex-1 text-sm"
                          numberOfLines={1}
                        >
                          {a.title}
                        </Text>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </View>
                      <ProgressBar
                        value={a.progress}
                        variant={a.status === "overdue" ? "error" : "brand"}
                      />
                      <View className="flex-row items-center justify-between">
                        <Text className="text-2xs text-text-muted font-mono">
                          {a.progress}% complete
                        </Text>
                        {a.due != null ? (
                          <View className="flex-row items-center gap-1">
                            <Icon
                              name="clock"
                              size={11}
                              color={a.status === "overdue" ? "#B23A36" : "#756E61"}
                            />
                            <Text
                              className="text-2xs font-mono"
                              style={{ color: a.status === "overdue" ? "#B23A36" : "#756E61" }}
                            >
                              {a.status === "overdue" ? "Due " : "Due "}
                              {relTime(a.due)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
              <Chip leadingIcon="plus" onPress={() => router.push(routes.assignContent(board.id))}>
                Assign content
              </Chip>
            </Card>
          ))
        )}

        <View className="h-6" />
      </View>
    </Screen>
  );
}
