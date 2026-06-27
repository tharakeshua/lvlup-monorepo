/**
 * Timed-test landing ("gate") — the assessment contract + Start/Resume.
 *
 * Keyed by `storyPointId` (route param). Reads `useTestSessions({ storyPointId })`
 * for prior attempts + config, and — when an attempt is in progress —
 * `useTestSession` + `useTestSessionDeadline` for the live resume state. Starting
 * is server-authoritative (the clock starts when `startTestSession` confirms),
 * so we navigate to the runner only on a successful mutation.
 */
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { asSpaceId, asStoryPointId, asTestSessionId } from "@levelup/domain";
import {
  useStartTestSession,
  useTestSession,
  useTestSessionDeadline,
  useTestSessions,
} from "@levelup/query";

import {
  Accordion,
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Chip,
  ContentRenderer,
  GradePill,
  Icon,
  Screen,
  Skeleton,
} from "../../components";
import {
  AnswerKeyLock,
  Panel,
  type SessionVM,
  gradeFromPct,
  gradeTone,
  latestSession,
  readSession,
  readSessions,
  useStoryPointParams,
  useTestNav,
} from "./_components";

const LEAD_LINES = [
  { icon: "timer", text: "The clock starts on the server the moment you press Start." },
  { icon: "pause-circle", text: "It can't be paused — give yourself one uninterrupted sitting." },
  {
    icon: "lock",
    text: "Answers stay sealed during the test; you'll get feedback right after you submit.",
  },
];

function GlanceCell({
  icon,
  label,
  value,
  unit,
}: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View className="border-border-subtle bg-surface min-w-[30%] flex-1 gap-1 rounded-md border p-3">
      <View className="flex-row items-center gap-1.5">
        <Icon name={icon} size={13} color="#756E61" />
        <Text className="text-2xs text-text-muted">{label}</Text>
      </View>
      <Text className="font-display text-text-primary text-lg font-semibold">
        {value}
        {unit ? <Text className="text-text-muted text-xs font-normal"> {unit}</Text> : null}
      </Text>
    </View>
  );
}

/** Tiny live-deadline indicator shown only when an attempt is resumable. */
function ResumeDeadline({ sessionId }: { sessionId: string }) {
  const detail = useTestSession(asTestSessionId(sessionId));
  const sub = useTestSessionDeadline(asTestSessionId(sessionId));
  const session = useMemo(() => readSession(detail.data), [detail.data]);
  if (!session.serverDeadline) return null;
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon name="server" size={12} color="#2F7D5B" />
      <Text className="text-text-muted text-xs">
        Clock {sub.status === "live" ? "live" : "syncing"} on the server
      </Text>
    </View>
  );
}

function AttemptsAccordion({ attempts }: { attempts: SessionVM[] }) {
  if (attempts.length === 0) return null;
  return (
    <Accordion
      items={[
        {
          title: `Previous attempts (${attempts.length})`,
          content: (
            <View className="gap-3">
              {attempts.map((a) => {
                const passed = a.passed ?? false;
                return (
                  <View key={a.id} className="flex-row items-center justify-between gap-3">
                    <Text className="text-text-primary text-sm font-medium">
                      Attempt #{a.attemptNumber}
                    </Text>
                    {a.percentage != null ? (
                      <GradePill
                        grade={gradeFromPct(a.percentage)}
                        tone={gradeTone(a.percentage, a.passMark ?? 70)}
                      />
                    ) : null}
                    {passed ? (
                      <Badge variant="success" icon={<Icon name="check" size={12} />}>
                        Passed
                      </Badge>
                    ) : (
                      <Badge variant="info" icon={<Icon name="trending-up" size={12} />}>
                        Keep going
                      </Badge>
                    )}
                  </View>
                );
              })}
            </View>
          ),
        },
      ]}
    />
  );
}

export default function TimedTestLandingScreen() {
  const nav = useTestNav();
  const { storyPointId, spaceId: paramSpaceId } = useStoryPointParams();
  const query = useTestSessions({ storyPointId: asStoryPointId(storyPointId) });
  const start = useStartTestSession();
  const [startError, setStartError] = useState(false);

  const sessions = useMemo(() => readSessions(query.data), [query.data]);
  const latest = useMemo(() => latestSession(sessions), [sessions]);
  const inProgress = sessions.find((s) => s.status === "in_progress");
  const completedAttempts = sessions.filter((s) => s.status !== "in_progress");
  const spaceId = paramSpaceId ?? latest?.spaceId ?? inProgress?.spaceId ?? "";

  const cfg = latest ?? inProgress;
  const title = cfg?.title ?? "Timed assessment";
  const spaceTitle = cfg?.spaceTitle ?? "Your space";

  const onStart = async () => {
    setStartError(false);
    if (inProgress) {
      nav.toRun(storyPointId);
      return;
    }
    try {
      await start.mutateAsync({
        spaceId: asSpaceId(spaceId),
        storyPointId: asStoryPointId(storyPointId),
      });
      nav.toRun(storyPointId);
    } catch {
      setStartError(true);
    }
  };

  if (query.isLoading) {
    return (
      <Screen>
        <View className="gap-4 px-4 py-4">
          <Skeleton width="50%" height={16} />
          <Skeleton width="80%" height={28} />
          <View className="flex-row flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width="30%" height={64} radius={10} />
            ))}
          </View>
          <Skeleton width="100%" height={120} radius={12} />
          <Skeleton width="100%" height={52} radius={10} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-5 px-4 py-4">
        <Pressable
          className="flex-row items-center gap-1"
          onPress={nav.back}
          accessibilityRole="button"
        >
          <Icon name="chevron-left" size={16} color="#423A82" />
          <Text className="text-brand text-sm">Back to {spaceTitle}</Text>
        </Pressable>

        <Breadcrumb
          items={[
            { label: "Tests", onPress: nav.toTests },
            { label: spaceTitle },
            { label: title },
          ]}
        />

        {/* Header */}
        <View className="flex-row items-center gap-3">
          <View className="bg-brand-subtle h-12 w-12 items-center justify-center rounded-lg">
            <Icon name="timer" size={24} color="#423A82" />
          </View>
          <View className="flex-1">
            <Text className="font-display text-text-primary text-xl font-bold">{title}</Text>
            <View className="mt-1 flex-row items-center gap-2">
              <Text className="text-text-muted text-sm">{spaceTitle} · Timed assessment</Text>
              <Chip>Timed</Chip>
            </View>
          </View>
        </View>

        {/* At a glance */}
        <View className="flex-row flex-wrap gap-2">
          <GlanceCell
            icon="timer"
            label="Duration"
            value={String(cfg?.durationMinutes ?? "—")}
            unit="min"
          />
          <GlanceCell
            icon="list-checks"
            label="Questions"
            value={String(cfg?.totalQuestions ?? "—")}
          />
          <GlanceCell icon="award" label="Max marks" value={String(cfg?.totalMarks ?? "—")} />
          <GlanceCell
            icon="check-circle"
            label="Passing"
            value={cfg?.passMark != null ? String(cfg.passMark) : "—"}
            unit={cfg?.passMark != null ? "%" : undefined}
          />
          <GlanceCell
            icon="rotate-ccw"
            label="Attempts"
            value={`${completedAttempts.length}`}
            unit="used"
          />
          <GlanceCell icon="calendar-clock" label="Window" value={cfg?.windowLabel ?? "Open"} />
        </View>

        {/* Before you begin */}
        <Panel title="Before you begin">
          <View className="gap-3">
            {LEAD_LINES.map((l, i) => (
              <View key={i} className="flex-row items-start gap-3">
                <Icon name={l.icon} size={18} color="#423A82" />
                <Text className="text-text-secondary flex-1 text-sm">{l.text}</Text>
              </View>
            ))}
          </View>
        </Panel>

        <AnswerKeyLock title="Answers are sealed during the test.">
          You'll see your results and feedback as soon as you submit.
        </AnswerKeyLock>

        {inProgress ? <ResumeDeadline sessionId={inProgress.id} /> : null}

        {startError ? (
          <Alert variant="error" title="We couldn't start the test">
            Something hiccuped on our end — your attempts and clock are untouched. Let's try that
            again.
          </Alert>
        ) : null}

        {/* Hero CTA */}
        <View className="gap-2">
          <Button
            variant="spark"
            size="lg"
            block
            loading={start.isPending}
            disabled={start.isPending}
            leadingIcon={!start.isPending ? <Icon name="play" size={18} /> : undefined}
            onPress={onStart}
          >
            {start.isPending ? "Starting…" : inProgress ? "Resume test" : "Start test"}
          </Button>
          <View className="flex-row items-center justify-center gap-1.5">
            <Icon name="shield-check" size={14} color="#756E61" />
            <Text className="text-text-muted text-xs">
              The clock only starts once the server confirms — never before.
            </Text>
          </View>
        </View>

        <AttemptsAccordion attempts={completedAttempts} />

        {/* Unused-but-mapped contract demonstration: math content render */}
        <Panel title="What to expect">
          <ContentRenderer math>
            {
              "Work through every question. You can move freely between them and change answers until you submit."
            }
          </ContentRenderer>
        </Panel>
      </View>
    </Screen>
  );
}
