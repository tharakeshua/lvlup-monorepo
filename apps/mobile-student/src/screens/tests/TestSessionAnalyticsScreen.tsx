/**
 * Test session analytics — cross-attempt progress for one story-point test.
 *
 * Keyed by `storyPointId`. Reads ALL attempts (`useTestSessions({ storyPointId })`,
 * not `latestOnly`) for the score/pace trends, and the latest attempt's
 * server-computed `analytics` breakdowns for difficulty/topic mastery. Every read
 * is defensive — charts simply omit when the projection doesn't carry the field.
 */
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { asStoryPointId } from "@levelup/domain";
import { useTestSessions } from "@levelup/query";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  EmptyState,
  Icon,
  Screen,
  Skeleton,
} from "../../components";
import {
  BreakdownRows,
  DeltaTag,
  InsightCard,
  KpiCard,
  Panel,
  VerticalBars,
  deltaOf,
  readAnalytics,
  readSessions,
  useStoryPointParams,
  useTestNav,
} from "./_components";

interface AttemptVM {
  n: number;
  pct: number;
  answered: number;
  total: number;
  secPerQ?: number;
}

export default function TestSessionAnalyticsScreen() {
  const nav = useTestNav();
  const { storyPointId } = useStoryPointParams();
  const query = useTestSessions({ storyPointId: asStoryPointId(storyPointId) });

  const sessions = useMemo(() => readSessions(query.data), [query.data]);
  const completed = useMemo(
    () =>
      sessions
        .filter((s) => s.status !== "in_progress")
        .sort((a, b) => a.attemptNumber - b.attemptNumber),
    [sessions]
  );

  const attempts: AttemptVM[] = useMemo(
    () =>
      completed.map((s) => ({
        n: s.attemptNumber,
        pct: s.percentage ?? 0,
        answered: s.answeredQuestions ?? 0,
        total: s.totalQuestions ?? 0,
        secPerQ: readAnalytics(s.raw).averageTimePerQuestion,
      })),
    [completed]
  );

  const latest = completed[completed.length - 1];
  const latestAnalytics = useMemo(() => (latest ? readAnalytics(latest.raw) : null), [latest]);
  const PASSING = latest?.passMark ?? 70;

  // ── states ────────────────────────────────────────────────────────────────
  if (query.isLoading) {
    return (
      <Screen>
        <View className="gap-4 px-4 py-4">
          <Skeleton width="60%" height={24} />
          <View className="flex-row flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width="44%" height={80} radius={10} />
            ))}
          </View>
          <Skeleton width="100%" height={160} radius={12} />
        </View>
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen>
        <View className="px-4 py-4">
          <Alert variant="error" title="We couldn't load your progress just now">
            Your attempts are safe — let's try again.
            <View className="mt-3 flex-row">
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Icon name="rotate-cw" size={14} />}
                onPress={() => query.refetch()}
              >
                Retry
              </Button>
            </View>
          </Alert>
        </View>
      </Screen>
    );
  }

  if (attempts.length === 0) {
    return (
      <Screen>
        <View className="px-4 py-8">
          <EmptyState
            icon="bar-chart-2"
            title="No attempts yet — your progress starts here"
            body="Take this test once and we'll show you exactly where you're improving and what to focus on next."
            action={
              <Button
                variant="spark"
                leadingIcon={<Icon name="play" size={16} />}
                onPress={() => nav.toGate(storyPointId)}
              >
                Take the test
              </Button>
            }
          />
        </View>
      </Screen>
    );
  }

  const best = attempts.reduce((a, b) => (b.pct > a.pct ? b : a));
  const last = attempts[attempts.length - 1];
  const prev = attempts[attempts.length - 2];
  const first = attempts[0];
  const singleAttempt = attempts.length === 1;

  const dLatest = prev ? deltaOf(last.pct, prev.pct, "%") : undefined;
  const paceAttempts = attempts.filter((a) => a.secPerQ != null);
  const dPace =
    last.secPerQ != null && first.secPerQ != null
      ? deltaOf(last.secPerQ, first.secPerQ, "s")
      : undefined;

  return (
    <Screen>
      <View className="gap-5 px-4 py-4">
        {/* Header */}
        <Breadcrumb
          items={[
            { label: "Tests", onPress: nav.toTests },
            { label: latest?.spaceTitle ?? "Space" },
            { label: "Progress" },
          ]}
        />
        <View className="flex-row items-center gap-3">
          <View className="bg-brand-subtle h-11 w-11 items-center justify-center rounded-lg">
            <Icon name="trending-up" size={22} color="#423A82" />
          </View>
          <View className="flex-1">
            <Text className="font-display text-text-primary text-xl font-bold">
              {latest?.title ?? "Your progress"}
            </Text>
            <Text className="text-text-muted font-mono text-xs">
              {attempts.length} attempt{attempts.length === 1 ? "" : "s"}
            </Text>
          </View>
          {!singleAttempt && last.pct >= best.pct ? (
            <Badge variant="success" icon={<Icon name="sparkles" size={12} />}>
              Nice climb.
            </Badge>
          ) : null}
        </View>

        {singleAttempt ? (
          <View className="border-border-subtle bg-surface-sunken flex-row items-center gap-2 rounded-md border p-3">
            <Icon name="sprout" size={15} color="#2F7D5B" />
            <Text className="text-text-secondary flex-1 text-sm">
              One attempt down. Take it again and we'll start charting your trend.
            </Text>
          </View>
        ) : null}

        {/* KPI strip */}
        <View className="flex-row flex-wrap gap-2">
          <KpiCard
            icon="award"
            label="Best Score"
            value={`${best.pct}%`}
            sub={`attempt ${best.n}`}
            best
          />
          <KpiCard
            icon="gauge"
            label="Latest Score"
            value={`${last.pct}%`}
            delta={dLatest}
            sub={prev ? `vs attempt ${prev.n}` : "first run"}
          />
          <KpiCard icon="repeat" label="Attempts" value={`${attempts.length}`} sub="completed" />
          {last.secPerQ != null ? (
            <KpiCard
              icon="timer"
              label="Avg Time / Q"
              value={`${last.secPerQ}s`}
              delta={dPace}
              sub={first.secPerQ != null ? "vs first attempt" : "per question"}
            />
          ) : null}
        </View>

        {/* Score progression */}
        {!singleAttempt ? (
          <Panel title="Score progression">
            <VerticalBars
              data={attempts.map((a) => ({ label: `#${a.n}`, value: a.pct }))}
              passLine={PASSING}
              bestValue={best.pct}
              ariaLabel={`Score progression across attempts: ${attempts.map((a) => `attempt ${a.n} ${a.pct} percent`).join(", ")}.`}
            />
          </Panel>
        ) : null}

        {/* Pace trend */}
        {!singleAttempt && paceAttempts.length > 1 ? (
          <Panel title="Pace trend">
            <VerticalBars
              data={paceAttempts.map((a) => ({ label: `#${a.n}`, value: a.secPerQ ?? 0 }))}
              unit="s"
              tone="spark"
              ariaLabel={`Average time per question by attempt: ${paceAttempts.map((a) => `attempt ${a.n} ${a.secPerQ} seconds`).join(", ")}.`}
            />
            <Text className="text-text-muted mt-2 text-xs">
              Time per question, attempt by attempt. Faster isn't always better — accuracy first.
            </Text>
          </Panel>
        ) : null}

        {/* Difficulty mastery */}
        {latestAnalytics && latestAnalytics.difficulty.length ? (
          <Panel title="Difficulty mastery">
            <BreakdownRows
              rows={latestAnalytics.difficulty}
              icon="bar-chart-3"
              passMark={PASSING}
            />
          </Panel>
        ) : null}

        {/* Topic mastery */}
        {latestAnalytics && latestAnalytics.topic.length ? (
          <Panel title="Topic mastery">
            <BreakdownRows rows={latestAnalytics.topic} icon="tag" passMark={PASSING} />
          </Panel>
        ) : null}

        {/* Next focus */}
        <View className="gap-3">
          <Text className="font-display text-text-primary text-base font-semibold">
            Your next focus
          </Text>
          {(latestAnalytics?.topic ?? [])
            .filter((t) => t.max > 0)
            .sort((a, b) => a.got / a.max - b.got / b.max)
            .slice(0, 2)
            .map((t, i) => (
              <View key={i} className="gap-2">
                <InsightCard icon="target" title={`Spend time on ${t.label}`}>
                  You're at {Math.round((t.got / t.max) * 100)}% here. A few targeted practice
                  problems will move this fast.
                </InsightCard>
                <View className="flex-row">
                  <Button
                    variant="spark"
                    size="sm"
                    trailingIcon={<Icon name="arrow-right" size={14} />}
                    onPress={() => nav.toGate(storyPointId)}
                  >
                    Practice this
                  </Button>
                </View>
              </View>
            ))}
          {dPace && dPace.dir === "down" ? (
            <InsightCard icon="trending-up" title="Your pacing is settling in">
              <View className="flex-row items-center gap-2">
                <Text className="text-text-secondary flex-1 text-sm">
                  You've trimmed time per question while accuracy held — that's confidence, not
                  rushing.
                </Text>
                <DeltaTag d={dPace} />
              </View>
            </InsightCard>
          ) : null}
        </View>

        {/* Footer CTA */}
        <View className="gap-3">
          <Button
            variant="secondary"
            size="lg"
            leadingIcon={<Icon name="rotate-cw" size={18} />}
            onPress={() => nav.toGate(storyPointId)}
          >
            Take this test again
          </Button>
          <Pressable
            className="flex-row items-center justify-center gap-1"
            onPress={nav.toTests}
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={16} color="#756E61" />
            <Text className="text-text-muted text-sm">Back to tests</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
