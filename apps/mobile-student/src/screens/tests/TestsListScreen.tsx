/**
 * Tests tab — list of the learner's tests across every space.
 *
 * Data: `useTestSessions({ latestOnly })` (infinite) — one row per test (its
 * latest attempt). Status is RENDERED from the server projection, never
 * recomputed from the device clock. Reads are defensive (types lie — GATE-0).
 */
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useTestSessions } from "@levelup/query";

import {
  Badge,
  Button,
  Chip,
  EmptyState,
  GradePill,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
} from "../../components";
import {
  AnswerKeyLock,
  LIST_FILTERS,
  type ListFilter,
  type SessionVM,
  STATUS_ORDER,
  gradeFromPct,
  gradeTone,
  readSessions,
  statusMeta,
  useTestNav,
} from "./_components";

/* Status badge: icon + label, never colour alone. */
function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <Badge variant={m.badge ?? "neutral"} icon={<Icon name={m.icon} size={12} />}>
      {m.label}
    </Badge>
  );
}

function TestCard({ t, onPress }: { t: SessionVM; onPress: () => void }) {
  const m = statusMeta(t.status);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t.title}, ${t.spaceTitle}, ${m.label}, ${
        t.percentage != null ? `best ${t.percentage} percent` : "no attempt yet"
      }`}
      className="border-border-subtle bg-surface gap-3 rounded-lg border p-4 active:opacity-80"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-display text-text-primary text-base font-semibold">{t.title}</Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="text-text-muted text-xs">{t.spaceTitle}</Text>
            {t.totalQuestions != null ? (
              <Text className="text-text-muted text-xs">· {t.totalQuestions} questions</Text>
            ) : null}
            {t.durationMinutes != null ? (
              <Text className="text-text-muted text-xs">· {t.durationMinutes} min</Text>
            ) : null}
          </View>
        </View>
        <StatusBadge status={t.status} />
      </View>

      {t.windowLabel ? (
        <View className="flex-row items-center gap-1.5">
          <Icon name="calendar-clock" size={13} color="#756E61" />
          <Text className="text-text-muted text-xs">{t.windowLabel}</Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between">
        <Text className="text-text-muted text-xs">Attempts {t.attemptNumber}</Text>
        {t.percentage != null ? (
          <View className="flex-row items-center gap-2">
            <Text className="text-text-secondary font-mono text-sm">{t.percentage}%</Text>
            <GradePill grade={gradeFromPct(t.percentage)} tone={gradeTone(t.percentage)} />
          </View>
        ) : (
          <Text className="text-text-muted text-sm">—</Text>
        )}
      </View>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <View className="gap-3">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="border-border-subtle bg-surface gap-3 rounded-lg border p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-2">
              <Skeleton width="60%" height={14} />
              <Skeleton width="80%" height={12} />
            </View>
            <Skeleton width={80} height={20} />
          </View>
          <Skeleton width="50%" height={12} />
          <View className="flex-row items-center justify-between">
            <Skeleton width={80} height={14} />
            <Skeleton width={34} height={34} variant="circle" />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function TestsListScreen() {
  const nav = useTestNav();
  const [filter, setFilter] = useState<ListFilter>("All");
  const query = useTestSessions({ latestOnly: true });

  const sessions = useMemo(() => readSessions(query.data), [query.data]);

  const rows = useMemo(() => {
    const list =
      filter === "All" ? sessions : sessions.filter((s) => statusMeta(s.status).group === filter);
    return [...list].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status as never) - STATUS_ORDER.indexOf(b.status as never)
    );
  }, [sessions, filter]);

  const resumable = sessions.find((s) => s.status === "in_progress");

  return (
    <Screen>
      <View className="gap-5 px-4 py-4">
        {/* Header */}
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-display text-text-primary text-2xl font-bold">Tests</Text>
            {sessions.length > 0 ? <Badge variant="brand">{sessions.length} tests</Badge> : null}
          </View>
          <Text className="text-text-muted text-sm">Your scheduled tests across every space.</Text>
        </View>

        {/* Filter chips */}
        <View className="flex-row flex-wrap gap-2">
          {LIST_FILTERS.map((f) => (
            <Chip key={f} active={filter === f} onPress={() => setFilter(f)}>
              {f}
            </Chip>
          ))}
        </View>

        {/* Body */}
        {query.isLoading ? (
          <ListSkeleton />
        ) : query.isError ? (
          <EmptyState
            icon="cloud-off"
            title="We couldn't load your tests"
            body="Check your connection and try again."
            action={
              <Button
                variant="ghost"
                leadingIcon={<Icon name="refresh-cw" size={16} />}
                onPress={() => query.refetch()}
              >
                Retry
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          filter === "All" ? (
            <EmptyState
              icon="clipboard-list"
              title="No tests scheduled"
              body="When your teacher schedules a test, it'll appear here with its dates and details — you'll have plenty of notice."
            />
          ) : (
            <EmptyState
              icon="filter"
              title="No tests match this filter."
              body="Try ‘All’ to see everything."
              action={
                <Button
                  variant="ghost"
                  leadingIcon={<Icon name="x" size={16} />}
                  onPress={() => setFilter("All")}
                >
                  Clear filter
                </Button>
              }
            />
          )
        ) : (
          <View className="gap-3">
            {rows.map((t) => (
              <TestCard
                key={t.id || t.storyPointId}
                t={t}
                onPress={() => nav.toGate(t.storyPointId)}
              />
            ))}
          </View>
        )}

        {/* Resume affordance */}
        {resumable ? (
          <View className="border-spark/40 bg-marigold-50 gap-3 rounded-lg border p-4">
            <View className="flex-row items-center gap-2">
              <Icon name="play" size={16} color="#C97A14" />
              <Text className="text-text-primary font-semibold">You have a test in progress</Text>
            </View>
            <Text className="text-text-secondary text-sm">
              {resumable.title} is still open — pick up right where you left off.
            </Text>
            <View className="flex-row">
              <Button
                variant="spark"
                size="sm"
                leadingIcon={<Icon name="play" size={16} />}
                onPress={() => nav.toRun(resumable.storyPointId)}
              >
                Resume test
              </Button>
            </View>
          </View>
        ) : null}

        {rows.length > 0 ? (
          <>
            <SectionHeader title="Good to know" />
            <AnswerKeyLock title="Answer key never shown">
              This list shows status, attempts and best score only — item correctness lives on the
              released results surface.
            </AnswerKeyLock>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
