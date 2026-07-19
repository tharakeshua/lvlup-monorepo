/**
 * SpaceDetailScreen — one space, presented as its own little world.
 *
 * The main app tab bar hides on this route (see app/learner/_layout.tsx); this
 * screen renders its own space-scoped bottom nav (SpaceTabbar) with a back
 * affordance plus three sections:
 *   Overview — the hero page: duotone cover, title, "Your journey" bar, points
 *              chip, resume CTA, and the headline stats below.
 *   Content  — the full learning track from the very top: the vertical mastery
 *              spine of story-point nodes, nothing above it.
 *   Progress — how you're doing: per-type completion + per-module scores.
 *
 * Data: useSpace + useStoryPoints + useSpaceProgress (the granular GATE-0-proven
 * primitives). Navigates into the item viewer / practice / timed-test gate per
 * node type.
 */
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSpace, useSpaceProgress, useStoryPoints } from "@levelup/query";
import { asSpaceId } from "@levelup/domain";

import {
  Button,
  Card,
  Chip,
  Icon,
  PointsChip,
  ProgressBar,
  SpaceCover,
  SpaceTabbar,
  StatTile,
  colors,
  type SpaceNavItem,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { DetailSkeleton, ErrorState } from "./_shared/states";
import {
  asArray,
  byOrder,
  pct,
  thumbnailOf,
  toTrackNode,
  type NodeState,
  type TrackNodeModel,
} from "./_shared/normalize";
import type { SpaceProgressView, SpaceView, StoryPointView } from "./_shared/types";

const SPACE_SECTIONS: SpaceNavItem[] = [
  { key: "overview", icon: "compass", label: "Overview" },
  { key: "content", icon: "book-open", label: "Content" },
  { key: "progress", icon: "bar-chart-3", label: "Progress" },
];

function MasteryLabel({ state, percentage }: { state: NodeState; percentage: number }) {
  if (state === "mastered")
    return (
      <View className="flex-row items-center gap-1">
        <Icon name="check-circle" size={14} color={colors.masteryMastered} />
        <Text className="font-ui text-mastery-mastered text-xs font-medium">Mastered</Text>
      </View>
    );
  if (state === "in-progress")
    return (
      <View className="flex-row items-center gap-1">
        <Icon name="circle-dot" size={14} color={colors.masteryInProgress} />
        <Text className="font-ui text-mastery-in-progress text-xs font-medium">
          In progress · {percentage}%
        </Text>
      </View>
    );
  return (
    <View className="flex-row items-center gap-1">
      <Icon name="circle" size={14} color={colors.textMuted} />
      <Text className="font-ui text-text-muted text-xs">Not started</Text>
    </View>
  );
}

function NodeCard({
  node,
  last,
  isUpNext,
  onOpen,
}: {
  node: TrackNodeModel;
  last: boolean;
  isUpNext: boolean;
  onOpen: () => void;
}) {
  const cta =
    node.state === "mastered"
      ? { label: "Review", variant: "ghost" as const, icon: "rotate-ccw" }
      : node.state === "in-progress"
        ? { label: "Continue", variant: "primary" as const, icon: "arrow-right" }
        : { label: "Start", variant: "secondary" as const, icon: "arrow-right" };

  const markerBox =
    node.state === "mastered"
      ? "bg-mastery-mastered border-mastery-mastered"
      : node.state === "in-progress"
        ? "bg-surface border-mastery-in-progress"
        : "bg-surface border-border-strong";
  const markerTint =
    node.state === "mastered"
      ? colors.textOnAccent
      : node.state === "in-progress"
        ? colors.masteryInProgress
        : colors.textMuted;

  return (
    <View className="flex-row gap-3">
      {/* spine */}
      <View className="items-center">
        <View className={isUpNext ? "border-brand-subtle rounded-full border-4" : "p-1"}>
          <View
            className={`h-10 w-10 items-center justify-center rounded-full border-2 ${markerBox}`}
          >
            <Icon
              name={node.state === "mastered" ? "check" : node.typeIcon}
              size={17}
              color={markerTint}
              strokeWidth={node.state === "mastered" ? 2.6 : 2}
            />
          </View>
        </View>
        {!last ? (
          <View
            className={`my-1 w-px flex-1 ${
              node.state === "mastered" ? "bg-mastery-mastered" : "bg-border-subtle"
            }`}
          />
        ) : null}
      </View>

      {/* card */}
      <Card
        interactive
        onPress={onOpen}
        className={`mb-4 flex-1 gap-3 ${isUpNext ? "border-brand-muted" : ""}`}
      >
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 gap-1.5">
            <Text className="font-ui text-text-primary text-sm font-semibold leading-5">
              {node.title}
            </Text>
            <View className="flex-row flex-wrap items-center gap-2">
              <Chip className="px-2 py-0.5">
                <View className="flex-row items-center gap-1">
                  <Icon name={node.typeIcon} size={12} color={colors.textSecondary} />
                  <Text className="font-ui text-text-secondary text-2xs font-medium">
                    {node.typeLabel}
                  </Text>
                </View>
              </Chip>
              {isUpNext && node.state !== "mastered" ? (
                <View className="bg-marigold-50 rounded-pill px-2 py-0.5">
                  <Text className="font-ui text-marigold-600 text-2xs font-semibold">Up next</Text>
                </View>
              ) : null}
            </View>
            <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
              <Text className="font-ui text-text-muted text-xs">
                <Text className="font-mono">{node.itemCount}</Text> items
              </Text>
              {node.totalPoints > 0 ? (
                <Text className="font-ui text-text-muted text-xs">
                  <Text className="font-mono">
                    {node.points}/{node.totalPoints}
                  </Text>{" "}
                  pts
                </Text>
              ) : null}
              {node.timed && node.estimatedMinutes ? (
                <Text className="font-ui text-text-muted text-xs">
                  <Text className="font-mono">{node.estimatedMinutes}</Text> min · timed
                </Text>
              ) : null}
            </View>
          </View>
          <MasteryLabel state={node.state} percentage={node.percentage} />
        </View>

        {node.state === "in-progress" && !node.timed ? (
          <ProgressBar value={node.percentage} variant="brand" height={6} />
        ) : null}

        {node.timed && node.state !== "mastered" ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="lock" size={12} color={colors.textMuted} />
            <Text className="font-ui text-text-muted text-xs">
              Answers stay sealed until you finish
            </Text>
          </View>
        ) : null}

        <View className="flex-row justify-end">
          <Button
            variant={cta.variant}
            size="sm"
            trailingIcon={<Icon name={cta.icon} size={14} />}
            onPress={onOpen}
          >
            {cta.label}
          </Button>
        </View>
      </Card>
    </View>
  );
}

/** Empty-content card shown when the track has no nodes yet. */
function EmptyContent() {
  return (
    <Card className="items-center gap-2 py-8">
      <Icon name="book-open" size={28} color={colors.textMuted} />
      <Text className="font-display text-text-primary text-base">
        This journey is still being built
      </Text>
      <Text className="text-text-muted font-ui px-6 text-center text-sm">
        Your teacher is adding content here. Check back soon — it'll be worth the wait.
      </Text>
    </Card>
  );
}

/* ── Overview — hero + headline stats ───────────────────────────────────── */
function OverviewSection({
  title,
  subject,
  description,
  thumbnailUrl,
  overall,
  progressLoading,
  earned,
  totalPoints,
  nodes,
  resumeNode,
  onResume,
}: {
  title: string;
  subject?: string;
  description?: string;
  thumbnailUrl?: string;
  overall: number;
  progressLoading: boolean;
  earned: number;
  totalPoints: number;
  nodes: TrackNodeModel[];
  resumeNode?: TrackNodeModel;
  onResume: () => void;
}) {
  const totalItems = nodes.reduce((a, n) => a + n.itemCount, 0);
  return (
    <View className="gap-4">
      {/* hero */}
      <Card className="overflow-hidden p-0">
        <SpaceCover
          seed={subject ?? title}
          title={title}
          thumbnailUrl={thumbnailUrl}
          height={132}
        />
        <View className="gap-3 p-4">
          {subject ? (
            <View className="border-border-subtle bg-surface-sunken rounded-pill self-start border px-2 py-0.5">
              <Text className="font-ui text-text-secondary text-2xs font-medium">{subject}</Text>
            </View>
          ) : null}
          <Text className="font-display text-text-primary text-2xl leading-8">{title}</Text>
          {description ? (
            <Text className="font-ui text-text-secondary text-sm leading-6">{description}</Text>
          ) : null}

          <View className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="font-ui text-text-secondary text-sm font-medium">Your journey</Text>
              <Text className="text-text-primary font-mono text-sm font-medium">{overall}%</Text>
            </View>
            <ProgressBar
              value={overall}
              variant={overall >= 100 ? "success" : "brand"}
              height={6}
            />
            {progressLoading ? (
              <Text className="text-2xs font-ui text-text-muted">
                Track is ready — your progress is catching up.
              </Text>
            ) : null}
          </View>

          <View className="flex-row items-center justify-between gap-3">
            <PointsChip earned={earned} total={totalPoints} />
            {overall >= 100 ? (
              <View className="flex-row items-center gap-1.5">
                <Icon name="check-circle" size={15} color={colors.masteryMastered} />
                <Text className="font-ui text-mastery-mastered text-sm font-medium">
                  Space complete
                </Text>
              </View>
            ) : resumeNode ? (
              <Button
                variant="primary"
                trailingIcon={<Icon name="arrow-right" size={15} />}
                onPress={onResume}
              >
                {overall > 0 ? "Resume" : "Start learning"}
              </Button>
            ) : null}
          </View>
        </View>
      </Card>

      {/* headline stats */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <StatTile
            label="Modules"
            value={String(nodes.length)}
            icon={<Icon name="layers" size={16} />}
          />
        </View>
        <View className="flex-1">
          <StatTile
            label="Total items"
            value={String(totalItems)}
            icon={<Icon name="list" size={16} />}
          />
        </View>
        <View className="flex-1">
          <StatTile
            label="Points"
            value={String(totalPoints)}
            icon={<Icon name="star" size={16} />}
          />
        </View>
      </View>

      {resumeNode && overall < 100 ? (
        <Card className="bg-brand-subtle gap-1 border-0 p-4">
          <Text className="font-ui text-brand text-2xs tracking-caps font-semibold uppercase">
            Up next
          </Text>
          <Text className="font-display text-text-primary text-base">{resumeNode.title}</Text>
          <Text className="font-ui text-text-secondary text-xs">
            {resumeNode.typeLabel} · <Text className="font-mono">{resumeNode.itemCount}</Text> items
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

/* ── Progress — per-type completion + per-module scores ─────────────────── */
function ProgressSection({ nodes }: { nodes: TrackNodeModel[] }) {
  const byType = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    nodes.forEach((n) => {
      const e = m.get(n.typeLabel) ?? { done: 0, total: 0 };
      e.total += 1;
      if (n.state === "mastered") e.done += 1;
      m.set(n.typeLabel, e);
    });
    return Array.from(m.entries());
  }, [nodes]);

  if (nodes.length === 0) return <EmptyContent />;

  return (
    <View className="gap-4">
      <Card className="gap-3">
        <Text className="font-display text-text-primary text-base">What's in this space</Text>
        {byType.map(([name, e]) => (
          <View key={name} className="flex-row items-center gap-3">
            <Text className="font-ui text-text-secondary w-24 text-sm">{name}</Text>
            <View className="flex-1">
              <ProgressBar
                value={e.total ? Math.round((e.done / e.total) * 100) : 0}
                variant="success"
                height={6}
              />
            </View>
            <Text className="text-text-muted w-10 text-right font-mono text-xs">
              {e.done}/{e.total}
            </Text>
          </View>
        ))}
      </Card>

      <Card className="gap-3">
        <Text className="font-display text-text-primary text-base">How you're doing</Text>
        {nodes.map((n) => (
          <View key={n.id} className="flex-row items-center gap-3">
            <Text className="font-ui text-text-primary flex-1 text-sm" numberOfLines={1}>
              {n.title}
            </Text>
            <Text
              className={`font-mono text-xs ${
                n.state === "mastered" ? "text-mastery-mastered" : "text-text-muted"
              }`}
            >
              {n.percentage}%
            </Text>
            <View className="w-20">
              <ProgressBar
                value={n.percentage}
                variant={n.state === "mastered" ? "success" : "brand"}
                height={6}
              />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

export default function SpaceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string }>();
  const spaceId = String(params.spaceId ?? "");

  const space = useSpace<SpaceView>(spaceId);
  const storyPointsQ = useStoryPoints<unknown>(spaceId);
  const progressQ = useSpaceProgress(asSpaceId(spaceId));

  const [activeTab, setActiveTab] = useState("overview");

  const storyPoints = useMemo(
    () => asArray<StoryPointView>(storyPointsQ.data).slice().sort(byOrder),
    [storyPointsQ.data]
  );
  const progress = (progressQ.data ?? undefined) as SpaceProgressView | undefined;

  const nodes = useMemo(
    () => storyPoints.map((sp) => toTrackNode(sp, progress)),
    [storyPoints, progress]
  );

  const overall = pct(progress?.percentage);
  const earned = progress?.pointsEarned ?? 0;
  const totalPoints = progress?.totalPoints ?? nodes.reduce((a, n) => a + n.totalPoints, 0);

  // first non-mastered node → "Resume" / "Up next" target
  const resumeNode = nodes.find((n) => n.state !== "mastered") ?? nodes[0];
  const upNextId = resumeNode && resumeNode.state !== "mastered" ? resumeNode.id : undefined;

  const openNode = (node: TrackNodeModel) => {
    if (node.route === "practice") router.push(routes.practice(spaceId, node.id));
    else if (node.route === "test") router.push(routes.testGate(node.id));
    else router.push(routes.spaceContent(spaceId, node.id));
  };

  if (space.isLoading || storyPointsQ.isLoading) return <DetailSkeleton rows={4} />;
  // Only a genuine failure hard-errors; a transient UNAUTHENTICATED/NOT_FOUND
  // falls through and renders with whatever loaded.
  if (isHardError(space))
    return (
      <ErrorState
        title="We couldn't load this space."
        onRetry={() => {
          space.refetch();
          storyPointsQ.refetch();
          progressQ.refetch();
        }}
      />
    );

  // The read may deliver the space bare OR wrapped in a `{ space }` envelope
  // (the deployed callable returns the envelope) — probe both before aliases.
  const rawSpace = space.data as unknown as
    | { space?: Record<string, unknown> }
    | Record<string, unknown>
    | undefined;
  const spaceData = ((rawSpace as { space?: Record<string, unknown> })?.space ?? rawSpace) as
    | {
        title?: string;
        name?: string;
        displayName?: string;
        subject?: string;
        description?: string;
      }
    | undefined;
  const title = spaceData?.title ?? spaceData?.name ?? spaceData?.displayName ?? "Space";
  const subject = spaceData?.subject;
  const thumbnailUrl = thumbnailOf(spaceData as Record<string, unknown> | undefined);

  return (
    <SafeAreaView edges={["top"]} className="bg-canvas flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-6 gap-4"
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "overview" ? (
          <OverviewSection
            title={title}
            subject={subject}
            description={spaceData?.description}
            thumbnailUrl={thumbnailUrl}
            overall={overall}
            progressLoading={progressQ.isLoading}
            earned={earned}
            totalPoints={totalPoints}
            nodes={nodes}
            resumeNode={resumeNode}
            onResume={() => resumeNode && openNode(resumeNode)}
          />
        ) : activeTab === "content" ? (
          nodes.length === 0 ? (
            <EmptyContent />
          ) : (
            <View>
              {nodes.map((n, i) => (
                <NodeCard
                  key={n.id}
                  node={n}
                  last={i === nodes.length - 1}
                  isUpNext={n.id === upNextId}
                  onOpen={() => openNode(n)}
                />
              ))}
            </View>
          )
        ) : (
          <ProgressSection nodes={nodes} />
        )}
      </ScrollView>

      <SpaceTabbar
        items={SPACE_SECTIONS}
        activeKey={activeTab}
        onSelect={setActiveTab}
        onBack={() => router.push(routes.spaces())}
      />
    </SafeAreaView>
  );
}
