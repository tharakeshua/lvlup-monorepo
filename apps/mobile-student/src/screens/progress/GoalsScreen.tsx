/**
 * Goals — Progress lane (apps/mobile-student).
 *
 * Study-goal planner: list of goal cards (ProgressBar over currentCount/targetCount,
 * completed badge, target-type label), a "New goal" Sheet form (title, targetType
 * pills, targetCount, ISO start/end dates), and per-goal archive. All data flows
 * through `@levelup/query` hooks — no firebase imports.
 */
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import {
  CircleCheckBig,
  CalendarClock,
  FileCheck,
  GitBranch,
  LayoutGrid,
  ListChecks,
  Plus,
  Target,
  Timer,
  Trash2,
} from "lucide-react-native";

import { useStudyGoals, useSaveStudyGoal, useArchiveStudyGoal } from "@levelup/query";
import {
  STUDY_GOAL_TARGET_TYPES,
  asIsoDate,
  type IsoDate,
  type StudyGoal,
  type StudyGoalId,
  type StudyGoalTargetType,
} from "@levelup/domain";

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ProgressBar,
  Screen,
  SectionHeader,
  Sheet,
  Skeleton,
  StatTile,
  TextField,
} from "../../components";
import { isHardError } from "../../lib/query-status";

// ---------------------------------------------------------------------------
// target-type metadata (label + lucide icon)
// ---------------------------------------------------------------------------
type TargetMeta = {
  label: string;
  unit: string;
  Icon: typeof LayoutGrid;
};

const TYPE_META: Record<StudyGoalTargetType, TargetMeta> = {
  spaces: { label: "Spaces", unit: "spaces", Icon: LayoutGrid },
  story_points: { label: "Sections", unit: "sections", Icon: GitBranch },
  items: { label: "Items", unit: "items", Icon: ListChecks },
  exams: { label: "Exams", unit: "exams", Icon: FileCheck },
  minutes: { label: "Minutes", unit: "min", Icon: Timer },
};

function pct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Goal card
// ---------------------------------------------------------------------------
function GoalCard({
  goal,
  onArchive,
  archiving,
}: {
  goal: StudyGoal;
  onArchive: (g: StudyGoal) => void;
  archiving: boolean;
}) {
  const meta = TYPE_META[goal.targetType] ?? TYPE_META.items;
  const percent = pct(goal.currentCount, goal.targetCount);
  const done = goal.completed || goal.currentCount >= goal.targetCount;
  const MetaIcon = meta.Icon;

  return (
    <Card className="mb-4 p-5">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 pr-1">
          <Text className="font-display text-text-primary text-lg font-semibold" numberOfLines={2}>
            {goal.title}
          </Text>
          {goal.description ? (
            <Text className="text-text-secondary mt-1 text-sm" numberOfLines={2}>
              {goal.description}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Archive goal ${goal.title}`}
          disabled={archiving}
          onPress={() => onArchive(goal)}
          hitSlop={8}
          className="bg-surface-sunken active:bg-inset h-9 w-9 items-center justify-center rounded-md"
        >
          <Trash2 size={16} color="#B23A36" />
        </Pressable>
      </View>

      {/* meta row */}
      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        <Chip leadingIcon={<MetaIcon size={12} color="#565046" />}>{meta.label}</Chip>
        {done ? (
          <Badge variant="success" icon={<CircleCheckBig size={12} color="#2F7D5B" />}>
            Completed
          </Badge>
        ) : (
          <Badge variant="info" icon={<CalendarClock size={12} color="#2D6E8E" />}>
            By {goal.endDate}
          </Badge>
        )}
        {archiving ? (
          <Badge variant="neutral" icon={<Timer size={12} color="#756E61" />}>
            Archiving…
          </Badge>
        ) : null}
      </View>

      {/* progress */}
      <View className="mt-4">
        <ProgressBar value={done ? 100 : percent} variant={done ? "success" : "spark"} />
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-text-secondary font-mono text-sm">
            <Text className="text-text-primary font-semibold">{goal.currentCount}</Text>
            {" of "}
            <Text className="text-text-primary font-semibold">{goal.targetCount}</Text>
            {` ${meta.unit} done`}
          </Text>
          <Text className="text-text-muted font-mono text-sm">{done ? 100 : percent}%</Text>
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// New-goal sheet form
// ---------------------------------------------------------------------------
type FormErrors = { title?: string; targetCount?: string; endDate?: string };

function NewGoalSheet({
  open,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    targetType: StudyGoalTargetType;
    targetCount: number;
    startDate: IsoDate;
    endDate: IsoDate;
  }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [targetType, setTargetType] = useState<StudyGoalTargetType>("spaces");
  const [targetCount, setTargetCount] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const reset = () => {
    setTitle("");
    setTargetType("spaces");
    setTargetCount("");
    setStartDate(todayIso());
    setEndDate("");
    setErrors({});
  };

  const submit = () => {
    const next: FormErrors = {};
    const count = Number(targetCount);
    if (!title.trim()) next.title = "Give your goal a name.";
    if (!targetCount || Number.isNaN(count) || count < 1) next.targetCount = "Aim for at least 1.";
    if (!endDate.trim()) next.endDate = "Pick a target date (YYYY-MM-DD).";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim()))
      next.endDate = "Use the format YYYY-MM-DD.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSave({
      title: title.trim(),
      targetType,
      targetCount: count,
      startDate: asIsoDate(startDate.trim() || todayIso()),
      endDate: asIsoDate(endDate.trim()),
    });
    reset();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Set a study goal">
      <View className="gap-4 pb-2">
        <TextField
          label="What are you aiming for?"
          required
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Finish the Recursion space"
          error={errors.title}
        />

        {/* target-type pills */}
        <View>
          <Text className="text-text-secondary mb-2 text-sm font-medium">Track by</Text>
          <View className="flex-row flex-wrap gap-2">
            {STUDY_GOAL_TARGET_TYPES.map((t) => {
              const meta = TYPE_META[t];
              const PillIcon = meta.Icon;
              const active = targetType === t;
              return (
                <Chip
                  key={t}
                  active={active}
                  onPress={() => setTargetType(t)}
                  leadingIcon={<PillIcon size={12} color={active ? "#423A82" : "#565046"} />}
                >
                  {meta.label}
                </Chip>
              );
            })}
          </View>
        </View>

        <TextField
          label="How many?"
          required
          value={targetCount}
          onChangeText={setTargetCount}
          keyboardType="number-pad"
          placeholder="e.g. 5"
          error={errors.targetCount}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <TextField
              label="Starts"
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              hint="Defaults to today."
            />
          </View>
          <View className="flex-1">
            <TextField
              label="By when?"
              required
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              error={errors.endDate}
            />
          </View>
        </View>

        <View className="mt-2 flex-row justify-end gap-3">
          <Button variant="ghost" onPress={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="spark"
            leadingIcon={<Target size={15} color="#1C1A16" />}
            onPress={submit}
            loading={saving}
            disabled={saving}
          >
            Set goal
          </Button>
        </View>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function GoalsScreen() {
  const goalsQuery = useStudyGoals({ includeCompleted: true });
  const saveGoal = useSaveStudyGoal();
  const archiveGoal = useArchiveStudyGoal();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<StudyGoalId | null>(null);

  // useStudyGoals is useInfiniteQuery at runtime (data = { pages: [{ items }] }) but the
  // SDK annotates the return as UseInfiniteQueryResult<StudyGoal> (first generic = final
  // data type), mis-typing `data` as a single goal. Cast to the real shape + flatten.
  const goals = useMemo<StudyGoal[]>(() => {
    const d = goalsQuery.data as unknown as { pages?: Array<{ items?: StudyGoal[] }> } | undefined;
    return d?.pages?.flatMap((p) => p.items ?? []) ?? [];
  }, [goalsQuery.data]);

  const activeCount = goals.filter((g) => !g.completed).length;
  const completedCount = goals.filter((g) => g.completed).length;

  const handleArchive = (goal: StudyGoal) => {
    setArchivingId(goal.id);
    archiveGoal.mutate(goal, {
      onSettled: () => setArchivingId(null),
    });
  };

  const handleSave = (data: {
    title: string;
    targetType: StudyGoalTargetType;
    targetCount: number;
    startDate: IsoDate;
    endDate: IsoDate;
  }) => {
    saveGoal.mutate(
      { data },
      {
        onSuccess: () => setSheetOpen(false),
      }
    );
  };

  // -- header (shared across states) ----------------------------------------
  const header = (
    <View className="mb-5">
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text className="font-display text-text-primary text-3xl font-semibold">Your goals</Text>
          <Text className="text-text-secondary mt-1 text-base">You set the pace.</Text>
        </View>
        <Button
          variant="spark"
          leadingIcon={<Plus size={16} color="#1C1A16" />}
          onPress={() => setSheetOpen(true)}
        >
          New goal
        </Button>
      </View>

      {goals.length > 0 ? (
        <View className="mt-5 flex-row gap-3">
          <View className="flex-1">
            <StatTile
              label="Active"
              value={activeCount}
              icon={<Target size={18} color="#423A82" />}
            />
          </View>
          <View className="flex-1">
            <StatTile
              label="Completed"
              value={completedCount}
              icon={<CircleCheckBig size={18} color="#2F7D5B" />}
            />
          </View>
        </View>
      ) : null}
    </View>
  );

  // -- loading --------------------------------------------------------------
  if (goalsQuery.isLoading) {
    return (
      <Screen>
        {header}
        <View className="gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton width="70%" height={20} />
              <View className="mt-3 flex-row gap-2">
                <Skeleton width={88} height={24} radius={12} />
                <Skeleton width={108} height={24} radius={12} />
              </View>
              <Skeleton width="100%" height={8} radius={4} className="mt-4" />
              <Skeleton width="45%" height={14} className="mt-2" />
            </Card>
          ))}
        </View>
      </Screen>
    );
  }

  // -- error ----------------------------------------------------------------
  // No goals doc yet (fresh account → NOT_FOUND) is a soft miss → fall through
  // to the empty "set your first goal" state. Only a real failure errors out.
  if (isHardError(goalsQuery)) {
    return (
      <Screen>
        {header}
        <Card className="p-6">
          <EmptyState
            icon="alert-triangle"
            title="Couldn’t load your goals"
            body="Something hiccuped on our end — your goals are safe. Give it another try."
            action={
              <Button variant="primary" onPress={() => goalsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
        <NewGoalSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onSave={handleSave}
          saving={saveGoal.isPending}
        />
      </Screen>
    );
  }

  // -- empty ----------------------------------------------------------------
  if (goals.length === 0) {
    return (
      <Screen>
        {header}
        <Card className="p-6">
          <EmptyState
            icon="target"
            title="Set your first goal"
            body="Goals are yours to choose. Pick a target and a date — we'll track the rest while you learn."
            action={
              <Button
                variant="spark"
                leadingIcon={<Plus size={15} color="#1C1A16" />}
                onPress={() => setSheetOpen(true)}
              >
                Create a goal
              </Button>
            }
          />
        </Card>
        <NewGoalSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onSave={handleSave}
          saving={saveGoal.isPending}
        />
      </Screen>
    );
  }

  // -- happy path -----------------------------------------------------------
  return (
    <Screen scroll={false}>
      <FlatList
        data={goals}
        keyExtractor={(g) => String(g.id)}
        ListHeaderComponent={
          <View>
            {header}
            <SectionHeader title="Active goals" className="mb-3" />
          </View>
        }
        renderItem={({ item }) => (
          <GoalCard goal={item} onArchive={handleArchive} archiving={archivingId === item.id} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (goalsQuery.hasNextPage && !goalsQuery.isFetchingNextPage) {
            void goalsQuery.fetchNextPage();
          }
        }}
        ListFooterComponent={
          goalsQuery.isFetchingNextPage ? (
            <Skeleton width="100%" height={88} radius={12} className="mb-4" />
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-12 pt-2"
      />
      <NewGoalSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
        saving={saveGoal.isPending}
      />
    </Screen>
  );
}
