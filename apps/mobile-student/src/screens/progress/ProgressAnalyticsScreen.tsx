/**
 * Progress · Analytics — the learner's full progress picture.
 *
 * Overall / Exams / Spaces tabs driven by `useStudentSummary(studentId)`
 * (`StudentProgressSummary`). Overall shows a ring for `overallScore`, KPI
 * tiles, strength/growth chips and an at-risk / on-track next-step card. Exams
 * and Spaces surface their respective KPI strips, per-subject rings and a recent
 * list. Loading (Skeleton), error and empty states are all warm + encouraging —
 * "never blame the learner", never a bare zero.
 *
 * Data only via @levelup/query hooks (no firebase). UI from the shared Lyceum RN
 * library. Adapted from the mobile-family `progress-analytics` design to a phone
 * column.
 */
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Award,
  BookOpen,
  Calculator,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  CloudOff,
  Compass,
  FileCheck2,
  Flame,
  Gift,
  LayoutGrid,
  RotateCcw,
  RotateCw,
  Sprout,
  Target,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react-native";

import type {
  AtRiskReason,
  RecentActivityEntry,
  RecentExamEntry,
  StudentProgressSummary,
  Timestamp,
  UserId,
} from "@levelup/domain";
import { useStudentSummary } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ProgressBar,
  Ring,
  Screen,
  SectionHeader,
  Skeleton,
} from "../../components";
import { routes } from "../../lib/routes";
import { useSession } from "../../sdk/session";
import { isHardError } from "../../lib/query-status";

// ── theme hex (for icon strokes + ring colour overrides only) ────────────────
const C = {
  brand: "#423A82",
  spark: "#E8972B",
  success: "#2F7D5B",
  warning: "#B7791F",
  error: "#B23A36",
  muted: "#756E61",
  secondary: "#565046",
} as const;

const TABS = ["Overall", "Exams", "Spaces"] as const;
type TabKey = (typeof TABS)[number];

// ── small formatters ─────────────────────────────────────────────────────────
const pct = (n: number | undefined) => `${Math.round(n ?? 0)}%`;
const num = (n: number | undefined) => Math.round(n ?? 0).toLocaleString("en-US");

// Coerce any deployed/canonical timestamp shape (Firestore Timestamp,
// {seconds}, ISO string, epoch ms) → Date|null. Never throws. (Migration §2.4)
function toDateSafe(t: unknown): Date | null {
  if (t == null) return null;
  const maybe = t as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === "function") {
    try {
      const d = maybe.toDate();
      return Number.isNaN(d?.getTime?.()) ? null : d;
    } catch {
      return null;
    }
  }
  if (typeof maybe.seconds === "number") return new Date(maybe.seconds * 1000);
  const d = new Date(t as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(ts: Timestamp | string | undefined): string {
  const d = toDateSafe(ts);
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
}

function prettySubject(key: string): string {
  const map: Record<string, string> = {
    dsa: "Data Structures & Algorithms",
    sd: "System Design",
    lld: "Low-Level Design",
    behavioral: "Behavioral Interview",
  };
  return map[key.toLowerCase()] ?? key;
}

const REASON_COPY: Record<AtRiskReason, { title: string; body: string; Icon: typeof Target }> = {
  low_exam_score: {
    title: "A few exams dipped recently",
    body: "A short, focused practice set is the fastest way to turn the next one around.",
    Icon: Calculator,
  },
  declining_performance: {
    title: "Your trajectory cooled off a little",
    body: "A quick win this week is the best way to get the momentum back.",
    Icon: TrendingUp,
  },
  low_space_completion: {
    title: "A couple of spaces are waiting for you",
    body: "Finishing the next story point would push your completion over the line.",
    Icon: BookOpen,
  },
  zero_streak: {
    title: "Your streak is resting",
    body: "One small session today restarts it — future-you will be glad.",
    Icon: Flame,
  },
  no_recent_activity: {
    title: "It's been quiet for a few days",
    body: "Pick up right where you left off — a quick win is the best way back in.",
    Icon: CalendarClock,
  },
};

// ── composed bits (tokens-only, RN primitives) ───────────────────────────────
function KpiTile({
  Icon,
  label,
  value,
  sub,
  spark,
}: {
  Icon: typeof Target;
  label: string;
  value: string;
  sub?: string;
  spark?: boolean;
}) {
  return (
    <View className="border-border-subtle bg-surface min-w-[46%] flex-1 gap-2 rounded-lg border px-4 py-3">
      <View className="flex-row items-center gap-2">
        <View
          className={`h-7 w-7 items-center justify-center rounded-md ${
            spark ? "bg-marigold-50" : "bg-brand-subtle"
          }`}
        >
          <Icon size={15} color={spark ? C.spark : C.brand} strokeWidth={2} />
        </View>
        <Text className="font-ui text-text-secondary text-sm" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text className="text-text-primary font-mono text-3xl leading-none">{value}</Text>
      {sub ? <Text className="text-2xs font-ui text-text-muted">{sub}</Text> : null}
    </View>
  );
}

function RingTile({
  name,
  value,
  meta,
  spark,
  done,
}: {
  name: string;
  value: number;
  meta: string;
  spark?: boolean;
  done?: boolean;
}) {
  const color = done ? C.success : spark ? C.spark : C.brand;
  return (
    <View className="border-border-subtle bg-surface min-w-[46%] flex-1 items-center gap-2 rounded-lg border p-4">
      <Ring value={Math.round(value)} size={74} color={color} label={done ? "✓" : pct(value)} />
      <Text
        className="font-ui text-text-primary text-center text-sm font-semibold"
        numberOfLines={2}
      >
        {name}
      </Text>
      <Text className="font-ui text-text-muted text-center text-xs">{meta}</Text>
    </View>
  );
}

function SubjectBar({ name, value, spark }: { name: string; value: number; spark?: boolean }) {
  const done = value >= 100;
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-ui text-text-primary text-sm font-semibold" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-text-secondary font-mono text-xs">
          {done ? "done ✓" : pct(value)}
        </Text>
      </View>
      <ProgressBar
        value={Math.round(value)}
        variant={done ? "success" : spark ? "spark" : "brand"}
      />
    </View>
  );
}

function Segmented({ value, onChange }: { value: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <View className="rounded-pill bg-surface-sunken flex-row p-1">
      {TABS.map((t) => {
        const active = t === value;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`rounded-pill flex-1 items-center py-2 ${active ? "bg-surface" : ""}`}
          >
            <Text
              className={`font-ui text-sm ${
                active ? "text-text-primary font-semibold" : "text-text-secondary"
              }`}
            >
              {t}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── tabs ─────────────────────────────────────────────────────────────────────
function OverallTab({ s }: { s: StudentProgressSummary }) {
  const { autograde: ag, levelup: lu } = s;
  return (
    <View className="gap-6">
      {/* HERO */}
      <Card>
        <View className="items-center gap-3 py-2">
          <Ring
            value={Math.round(s.overallScore)}
            size={140}
            label={pct(s.overallScore)}
            color={C.brand}
          />
          <Text className="font-display text-text-primary text-lg font-semibold">
            Overall score
          </Text>
          <Text className="font-ui text-text-muted max-w-[22ch] text-center text-xs">
            across your spaces and exams
          </Text>
        </View>
      </Card>

      {/* KPI GRID */}
      <View className="flex-row flex-wrap gap-3">
        <KpiTile
          Icon={FileCheck2}
          label="Avg exam score"
          value={pct(ag.averagePercentage)}
          sub={`${num(ag.completedExams)} / ${num(ag.totalExams)} exams`}
        />
        <KpiTile
          Icon={BookOpen}
          label="Space completion"
          value={pct(lu.averageCompletion)}
          sub={`${num(lu.completedSpaces)} / ${num(lu.totalSpaces)} spaces done`}
        />
        <KpiTile
          Icon={Target}
          label="Accuracy"
          value={pct(lu.averageAccuracy)}
          sub="across your work"
        />
        <KpiTile
          Icon={Flame}
          spark
          label="Current streak"
          value={`${num(lu.streakDays)}d`}
          sub={lu.streakDays > 0 ? "keep it glowing" : "start one today"}
        />
        <KpiTile
          Icon={Trophy}
          label="Points earned"
          value={num(lu.totalPointsEarned)}
          sub={`of ${num(lu.totalPointsAvailable)} available`}
        />
        <KpiTile
          Icon={Award}
          label="Marks obtained"
          value={num(ag.totalMarksObtained)}
          sub={`of ${num(ag.totalMarksAvailable)} available`}
        />
      </View>

      {/* STRENGTHS / GROWTH */}
      <Card>
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <ThumbsUp size={15} color={C.secondary} />
            <Text className="font-ui text-text-secondary text-sm font-semibold">
              You're strong in
            </Text>
          </View>
          {s.strengthAreas.length ? (
            <View className="flex-row flex-wrap gap-2">
              {s.strengthAreas.map((a) => (
                <Chip key={a} active leadingIcon={<Check size={12} color={C.brand} />}>
                  {prettySubject(a)}
                </Chip>
              ))}
            </View>
          ) : (
            <Text className="font-ui text-text-muted text-xs">
              Your strengths will show up here as you practice — you're just getting started.
            </Text>
          )}

          <View className="bg-border-subtle my-1 h-px" />

          <View className="flex-row items-center gap-2">
            <Sprout size={15} color={C.secondary} />
            <Text className="font-ui text-text-secondary text-sm font-semibold">Let's revisit</Text>
          </View>
          {s.weaknessAreas.length ? (
            <View className="flex-row flex-wrap gap-2">
              {s.weaknessAreas.map((a) => (
                <Badge key={a} variant="warning" icon={<RotateCcw size={12} color={C.warning} />}>
                  {prettySubject(a)}
                </Badge>
              ))}
            </View>
          ) : (
            <Text className="font-ui text-text-muted text-xs">
              Nothing flagged for review right now — lovely work.
            </Text>
          )}
        </View>
      </Card>

      {/* NEXT-STEP CARD */}
      <Card>
        {s.isAtRisk ? (
          <View className="gap-3">
            <View className="flex-row items-center">
              <Badge variant="warning" icon={<Sprout size={13} color={C.warning} />}>
                Let's get you some support 🌱
              </Badge>
            </View>
            <Text className="font-ui text-text-secondary text-xs">
              A couple of small things would lift your trajectory. Here's your next move:
            </Text>
            {(s.atRiskReasons.length
              ? s.atRiskReasons
              : (["no_recent_activity"] as AtRiskReason[])
            ).map((r) => {
              const copy = REASON_COPY[r];
              const RIcon = copy.Icon;
              return (
                <View
                  key={r}
                  className="border-border-subtle bg-surface-sunken gap-2 rounded-md border p-3"
                >
                  <View className="flex-row items-center gap-2">
                    <RIcon size={15} color={C.brand} />
                    <Text className="font-ui text-text-primary flex-1 text-sm font-semibold">
                      {copy.title}
                    </Text>
                  </View>
                  <Text className="font-ui text-text-secondary text-xs">{copy.body}</Text>
                  <View className="flex-row">
                    <Button
                      variant="spark"
                      size="sm"
                      trailingIcon={<ChevronRight size={14} color="#FFFDFA" />}
                    >
                      Practice now
                    </Button>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="gap-2">
            <View className="flex-row items-center">
              <Badge variant="success" icon={<Target size={13} color={C.success} />}>
                You're on track 🎯
              </Badge>
            </View>
            <Text className="font-ui text-text-secondary text-xs">
              Keep doing what you're doing — your trajectory looks great.
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
}

function ExamsTab({ s }: { s: StudentProgressSummary }) {
  const ag = s.autograde;
  const subjects = useMemo(() => Object.entries(ag.subjectBreakdown ?? {}), [ag.subjectBreakdown]);
  return (
    <View className="gap-6">
      <View className="flex-row flex-wrap gap-3">
        <KpiTile
          Icon={FileCheck2}
          label="Exams done"
          value={num(ag.completedExams)}
          sub={`of ${num(ag.totalExams)} assigned`}
        />
        <KpiTile
          Icon={Target}
          label="Avg exam %"
          value={pct(ag.averagePercentage)}
          sub="across all subjects"
        />
        <KpiTile
          Icon={Award}
          label="Marks obtained"
          value={num(ag.totalMarksObtained)}
          sub={`of ${num(ag.totalMarksAvailable)} available`}
        />
      </View>

      {subjects.length ? (
        <View className="gap-3">
          <SectionHeader title="By subject" />
          <View className="flex-row flex-wrap gap-3">
            {subjects.map(([name, b]) => (
              <RingTile
                key={name}
                name={prettySubject(name)}
                value={b.avgScore}
                meta={`${num(b.examCount)} ${b.examCount === 1 ? "exam" : "exams"}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View className="gap-3">
        <SectionHeader title="Your recent exams" />
        {ag.recentExams.length ? (
          ag.recentExams.map((e: RecentExamEntry) => (
            <Card key={e.examId}>
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text
                    className="font-ui text-text-primary text-sm font-semibold"
                    numberOfLines={1}
                  >
                    {e.examTitle}
                  </Text>
                  <Text className="text-text-muted font-mono text-xs">{fmtDate(e.date)}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-text-primary font-mono text-sm">{num(e.score)} pts</Text>
                  <Badge
                    variant={
                      e.percentage >= 75 ? "success" : e.percentage >= 50 ? "warning" : "error"
                    }
                  >
                    {pct(e.percentage)}
                  </Badge>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <Card>
            <Text className="font-ui text-text-secondary text-sm">
              No exams logged yet. Your scores will land here the moment you complete your first
              one. 🎯
            </Text>
          </Card>
        )}
      </View>
    </View>
  );
}

function SpacesTab({ s }: { s: StudentProgressSummary }) {
  const lu = s.levelup;
  const subjects = useMemo(() => Object.entries(lu.subjectBreakdown ?? {}), [lu.subjectBreakdown]);
  return (
    <View className="gap-6">
      <View className="flex-row flex-wrap gap-3">
        <KpiTile
          Icon={LayoutGrid}
          label="Spaces done"
          value={num(lu.completedSpaces)}
          sub={`of ${num(lu.totalSpaces)} assigned`}
        />
        <KpiTile
          Icon={BookOpen}
          label="Avg completion"
          value={pct(lu.averageCompletion)}
          sub="across your spaces"
        />
        <KpiTile
          Icon={Trophy}
          label="Points earned"
          value={num(lu.totalPointsEarned)}
          sub={`of ${num(lu.totalPointsAvailable)} available`}
        />
      </View>

      {subjects.length ? (
        <View className="gap-3">
          <SectionHeader title="By subject" />
          <View className="flex-row flex-wrap gap-3">
            {subjects.map(([name, v]) => (
              <RingTile
                key={name}
                name={prettySubject(name)}
                value={v}
                done={v >= 100}
                meta={v <= 0 ? "not started" : v >= 100 ? "completed" : "in progress"}
              />
            ))}
          </View>
          <Card>
            <View className="gap-4">
              {subjects.map(([name, v]) => (
                <SubjectBar key={name} name={prettySubject(name)} value={v} />
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      <View className="gap-3">
        <SectionHeader title="Recent activity" />
        {lu.recentActivity.length ? (
          lu.recentActivity.map((a: RecentActivityEntry) => (
            <Card key={`${a.spaceId}-${String(a.date)}`}>
              <View className="flex-row items-center gap-3">
                <View className="bg-brand-subtle h-8 w-8 items-center justify-center rounded-md">
                  <Zap size={15} color={C.brand} />
                </View>
                <View className="flex-1">
                  <Text
                    className="font-ui text-text-primary text-sm font-semibold"
                    numberOfLines={1}
                  >
                    {a.spaceTitle}
                  </Text>
                  <Text className="text-text-muted font-mono text-xs">{fmtDate(a.date)}</Text>
                </View>
                <Badge variant="spark">+{num(a.pointsEarned)} pts</Badge>
              </View>
            </Card>
          ))
        ) : (
          <Card>
            <Text className="font-ui text-text-secondary text-sm">
              No activity yet — pick a space and earn your first points. Small steps add up. 🌱
            </Text>
          </Card>
        )}
      </View>
    </View>
  );
}

// ── state blocks ─────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <View
      className="gap-6"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your progress"
    >
      <Card>
        <View className="items-center gap-3 py-2">
          <Skeleton variant="circle" width={120} height={120} />
          <Skeleton width="55%" height={14} />
        </View>
      </Card>
      <View className="flex-row flex-wrap gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            className="border-border-subtle bg-surface min-w-[46%] flex-1 gap-2 rounded-lg border px-4 py-3"
          >
            <Skeleton width="60%" height={10} />
            <Skeleton width="40%" height={26} />
          </View>
        ))}
      </View>
      <Card>
        <View className="gap-3">
          <Skeleton width="45%" height={16} />
          <Skeleton width="100%" height={120} />
        </View>
      </Card>
    </View>
  );
}

// ── quick links to the other Progress-tab screens (this screen is the hub) ───
function QuickLinks() {
  const router = useRouter();
  // routes.*() return expo-router's Href (string | { pathname, params }), not a bare string.
  const links: { label: string; icon: React.ReactNode; href: ReturnType<typeof routes.rewards> }[] =
    [
      { label: "Rewards", icon: <Gift size={14} color={C.brand} />, href: routes.rewards() },
      {
        label: "Achievements",
        icon: <Award size={14} color={C.brand} />,
        href: routes.achievements(),
      },
      {
        label: "Leaderboard",
        icon: <Trophy size={14} color={C.brand} />,
        href: routes.leaderboard(),
      },
      { label: "Goals", icon: <Target size={14} color={C.brand} />, href: routes.goals() },
    ];
  return (
    <View className="flex-row flex-wrap gap-2">
      {links.map((l) => (
        <Button
          key={l.label}
          variant="secondary"
          size="sm"
          leadingIcon={l.icon}
          onPress={() => router.push(l.href)}
        >
          {l.label}
        </Button>
      ))}
    </View>
  );
}

// ── screen ───────────────────────────────────────────────────────────────────
export default function ProgressAnalyticsScreen() {
  const { user } = useSession();
  const studentId = user?.uid as unknown as UserId;
  const [tab, setTab] = useState<TabKey>("Overall");

  const query = useStudentSummary(studentId);
  const summary = query.data as StudentProgressSummary | undefined;

  const isEmpty =
    !!summary &&
    summary.autograde.totalExams === 0 &&
    summary.levelup.totalSpaces === 0 &&
    (summary.overallScore ?? 0) === 0;

  const Header = (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-baseline gap-3">
        <Text className="font-display text-text-primary text-3xl font-medium">Your progress</Text>
        <View className="flex-row items-center gap-1">
          <Clock size={13} color={C.muted} />
          <Text className="text-text-muted font-mono text-xs">
            {summary?.lastUpdatedAt ? `Updated ${fmtDate(summary.lastUpdatedAt)}` : "Up to date"}
          </Text>
        </View>
      </View>
      <Text className="font-ui text-text-secondary text-base">
        You've grown a lot — here's the full picture. 🎯
      </Text>
    </View>
  );

  // body resolves the active state
  let body: React.ReactNode;
  if (query.isLoading) {
    body = <LoadingState />;
  } else if (isHardError(query)) {
    body = (
      <EmptyState
        icon={<CloudOff size={40} color={C.muted} />}
        title="We couldn't load your progress just now."
        body="Let's try again — this one's on us, not you."
        action={
          <Button
            variant="primary"
            leadingIcon={<RotateCw size={16} color="#FFFDFA" />}
            onPress={() => query.refetch()}
          >
            Retry
          </Button>
        }
      />
    );
  } else if (!summary || isEmpty) {
    // No summary doc yet (fresh-account NOT_FOUND → soft miss) OR a zeroed
    // summary → the welcoming "your progress starts here" state, never an error.
    body = (
      <EmptyState
        icon={<Sprout size={40} color={C.success} />}
        title="Your progress story starts here."
        body="As you complete spaces and take exams, this page fills with your trends, strengths, and milestones. Let's get the first one on the board."
        action={
          <Button variant="primary" leadingIcon={<Compass size={16} color="#FFFDFA" />}>
            Explore your spaces
          </Button>
        }
      />
    );
  } else {
    body = (
      <View className="gap-6">
        <Segmented value={tab} onChange={setTab} />
        {tab === "Overall" && <OverallTab s={summary} />}
        {tab === "Exams" && <ExamsTab s={summary} />}
        {tab === "Spaces" && <SpacesTab s={summary} />}
      </View>
    );
  }

  return (
    <Screen contentClassName="px-5 pt-4 pb-10 gap-6">
      {Header}
      <QuickLinks />
      {body}
    </Screen>
  );
}
