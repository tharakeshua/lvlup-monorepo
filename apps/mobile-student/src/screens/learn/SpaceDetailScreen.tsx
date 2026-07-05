/**
 * SpaceDetailScreen — the learning track for one space.
 *
 * Design: docs/rebuild-spec/design/build/app/mobile-family/_build/space-detail-learning-track.viewjs
 * Data:   useSpace + useStoryPoints + useSpaceProgress (the granular GATE-0-proven
 *         primitives; the composed useSpaceDetailView is the alt the contract
 *         allows, but the three reads are individually reliable on prod).
 *
 * Reads spaceId from the route; renders a vertical "spine" of story-point nodes
 * (Contents) plus an Overview tab. Navigates into the item viewer / practice /
 * timed-test gate per node type.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSpace, useSpaceProgress, useStoryPoints } from "@levelup/query";
import { asSpaceId } from "@levelup/domain";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Chip,
  Icon,
  ProgressBar,
  Screen,
  StatTile,
  XPMeter,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { DetailSkeleton, ErrorState } from "./_shared/states";
import {
  asArray,
  byOrder,
  pct,
  toTrackNode,
  type NodeRouteKind,
  type NodeState,
  type TrackNodeModel,
} from "./_shared/normalize";
import type { SpaceProgressView, SpaceView, StoryPointView } from "./_shared/types";

function MasteryLabel({ state, percentage }: { state: NodeState; percentage: number }) {
  if (state === "mastered")
    return (
      <View className="flex-row items-center gap-1">
        <Icon name="check-circle" size={15} color="#2F7D5B" />
        <Text className="text-success text-xs font-semibold">Mastered</Text>
      </View>
    );
  if (state === "in-progress")
    return (
      <View className="flex-row items-center gap-1">
        <Icon name="circle-dashed" size={15} color="#B7791F" />
        <Text className="text-warning text-xs font-semibold">In progress · {percentage}%</Text>
      </View>
    );
  return (
    <View className="flex-row items-center gap-1">
      <Icon name="circle" size={15} color="#756E61" />
      <Text className="text-text-muted text-xs">Not started</Text>
    </View>
  );
}

function NodeCard({
  node,
  index,
  last,
  onOpen,
}: {
  node: TrackNodeModel;
  index: number;
  last: boolean;
  onOpen: () => void;
}) {
  const cta =
    node.state === "mastered"
      ? { label: "Review", variant: "ghost" as const, icon: "rotate-ccw" }
      : node.state === "in-progress"
        ? { label: "Continue", variant: "primary" as const, icon: "arrow-right" }
        : { label: "Start", variant: "secondary" as const, icon: "arrow-right" };

  return (
    <View className="flex-row gap-3">
      {/* spine */}
      <View className="items-center">
        <View
          className={`h-8 w-8 items-center justify-center rounded-full ${
            node.state === "mastered"
              ? "bg-success"
              : node.state === "in-progress"
                ? "bg-spark"
                : "border-border-strong bg-surface border"
          }`}
        >
          {node.state === "mastered" ? (
            <Icon name="check" size={16} color="#FFFDFA" />
          ) : (
            <Text
              className={`text-sm font-semibold ${node.state === "in-progress" ? "text-text-on-accent" : "text-text-muted"}`}
            >
              {index + 1}
            </Text>
          )}
        </View>
        {!last ? (
          <View
            className={`my-1 w-0.5 flex-1 ${node.state === "mastered" ? "bg-success" : "bg-border-subtle"}`}
          />
        ) : null}
      </View>

      {/* card */}
      <Card
        interactive
        onPress={onOpen}
        className={`mb-3 flex-1 gap-3 ${node.state === "in-progress" ? "border-spark" : ""}`}
      >
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 gap-1">
            <Text className="font-display text-text-primary text-base">{node.title}</Text>
            <View className="flex-row flex-wrap items-center gap-2">
              <Chip>
                <View className="flex-row items-center gap-1">
                  <Icon name={node.typeIcon} size={12} />
                  <Text className="text-xs">{node.typeLabel}</Text>
                </View>
              </Chip>
              <View className="flex-row items-center gap-1">
                <Icon name="layers" size={12} color="#756E61" />
                <Text className="text-text-muted text-xs">{node.itemCount} items</Text>
              </View>
              {node.totalPoints > 0 ? (
                <View className="flex-row items-center gap-1">
                  <Icon name="star" size={12} color="#756E61" />
                  <Text className="text-text-muted text-xs">
                    {node.points}/{node.totalPoints} pts
                  </Text>
                </View>
              ) : null}
              {node.timed && node.estimatedMinutes ? (
                <View className="flex-row items-center gap-1">
                  <Icon name="timer" size={12} color="#756E61" />
                  <Text className="text-text-muted text-xs">{node.estimatedMinutes} min</Text>
                </View>
              ) : null}
            </View>
          </View>
          <MasteryLabel state={node.state} percentage={node.percentage} />
        </View>

        {node.state === "in-progress" ? (
          <ProgressBar value={node.percentage} variant="spark" />
        ) : null}

        {node.timed ? (
          <Alert variant="info" title="Answers stay sealed" icon={<Icon name="lock" size={15} />}>
            The answer key is server-only and never sent to your device — the live clock starts
            inside the test.
          </Alert>
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

function OverviewTab({ nodes, totalPoints }: { nodes: TrackNodeModel[]; totalPoints: number }) {
  const totalItems = nodes.reduce((a, n) => a + n.itemCount, 0);
  // per-type completion rollup
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

  return (
    <View className="gap-5">
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

      <Card className="gap-3">
        <Text className="font-display text-text-primary text-base">What's in this space</Text>
        {byType.map(([name, e]) => (
          <View key={name} className="flex-row items-center gap-3">
            <Text className="text-text-secondary w-24 text-sm">{name}</Text>
            <View className="flex-1">
              <ProgressBar
                value={e.total ? Math.round((e.done / e.total) * 100) : 0}
                variant="success"
              />
            </View>
            <Text className="text-text-muted w-10 text-right text-xs">
              {e.done}/{e.total}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

// ── in-space navigation ──────────────────────────────────────────────────────
// A space is its own little world, so it gets its own nav bar — distinct from the
// app-wide bottom tabs. It sits under the hero and switches between the space's
// sections (Overview + one per story-point route kind present in this space).

type SpaceSection = {
  key: string;
  label: string;
  icon: string;
  count: number;
  /** null for Overview (the summary); the filtered node list otherwise. */
  nodes: TrackNodeModel[] | null;
};

/** Empty-content card shown when a section has no nodes yet. */
function EmptyContent() {
  return (
    <View className="py-8">
      <Card className="items-center gap-2 py-6">
        <Icon name="book-open" size={28} color="#756E61" />
        <Text className="font-display text-text-primary text-base">
          This journey is still being built
        </Text>
        <Text className="text-text-muted px-6 text-center text-sm">
          Your teacher is adding content here. Check back soon — it'll be worth the wait.
        </Text>
      </Card>
    </View>
  );
}

/** The space's own horizontal nav bar (its own brand-tinted surface). */
function SpaceNav({
  sections,
  activeKey,
  onSelect,
}: {
  sections: SpaceSection[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View className="border-border-subtle bg-brand-subtle gap-2 rounded-xl border p-2">
      <View className="flex-row items-center gap-1.5 px-1">
        <Icon name="compass" size={13} color="#423A82" />
        <Text className="text-brand text-2xs font-semibold uppercase">In this space</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-0.5"
      >
        {sections.map((s) => {
          const on = s.key === activeKey;
          return (
            <Pressable
              key={s.key}
              onPress={() => onSelect(s.key)}
              className={`rounded-pill flex-row items-center gap-1.5 px-3.5 py-2 ${
                on ? "bg-brand shadow-sm" : "border-border-subtle bg-surface border"
              }`}
            >
              <Icon name={s.icon} size={14} color={on ? "#FFFDFA" : "#756E61"} />
              <Text
                className={`font-ui text-sm ${
                  on ? "text-text-on-accent font-semibold" : "text-text-secondary"
                }`}
              >
                {s.label}
              </Text>
              <View
                className={`rounded-pill min-w-[20px] items-center px-1.5 py-0.5 ${
                  on ? "bg-brand-hover" : "bg-surface-sunken"
                }`}
              >
                <Text
                  className={`text-2xs font-semibold ${
                    on ? "text-text-on-accent" : "text-text-muted"
                  }`}
                >
                  {s.count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** The spine of node cards for one section. */
function SectionNodeList({
  nodes,
  onOpen,
}: {
  nodes: TrackNodeModel[];
  onOpen: (node: TrackNodeModel) => void;
}) {
  if (nodes.length === 0) return <EmptyContent />;
  return (
    <View className="mt-1">
      {nodes.map((n, i) => (
        <NodeCard
          key={n.id}
          node={n}
          index={i}
          last={i === nodes.length - 1}
          onOpen={() => onOpen(n)}
        />
      ))}
    </View>
  );
}

/** In-space nav bar + the active section's content. */
function SpaceSections({
  nodes,
  totalPoints,
  onOpen,
}: {
  nodes: TrackNodeModel[];
  totalPoints: number;
  onOpen: (node: TrackNodeModel) => void;
}) {
  const sections = useMemo<SpaceSection[]>(() => {
    const byRoute = (r: NodeRouteKind) => nodes.filter((n) => n.route === r);
    const out: SpaceSection[] = [
      { key: "overview", label: "Overview", icon: "compass", count: nodes.length, nodes: null },
    ];
    const content = byRoute("content");
    const practice = byRoute("practice");
    const tests = byRoute("test");
    if (content.length)
      out.push({
        key: "content",
        label: "Content",
        icon: "book-open",
        count: content.length,
        nodes: content,
      });
    if (practice.length)
      out.push({
        key: "practice",
        label: "Practice",
        icon: "dumbbell",
        count: practice.length,
        nodes: practice,
      });
    if (tests.length)
      out.push({ key: "tests", label: "Tests", icon: "timer", count: tests.length, nodes: tests });
    return out;
  }, [nodes]);

  const [activeKey, setActiveKey] = useState("overview");
  // Keep the selection valid even if the section set shifts (e.g. content loads in).
  const active = sections.find((s) => s.key === activeKey) ?? sections[0];

  return (
    <View className="gap-4">
      <SpaceNav sections={sections} activeKey={active.key} onSelect={setActiveKey} />
      {active.key === "overview" ? (
        <OverviewTab nodes={nodes} totalPoints={totalPoints} />
      ) : (
        <SectionNodeList nodes={active.nodes ?? []} onOpen={onOpen} />
      )}
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

  // first non-mastered node → "Resume" target
  const resumeNode = nodes.find((n) => n.state !== "mastered") ?? nodes[0];

  const openNode = (node: TrackNodeModel) => {
    if (node.route === "practice") router.push(routes.practice(spaceId, node.id));
    else if (node.route === "test") router.push(routes.testGate(node.id));
    else router.push(routes.spaceContent(spaceId, node.id));
  };

  if (space.isLoading || storyPointsQ.isLoading) return <DetailSkeleton rows={4} />;
  // Only a genuine failure hard-errors; a transient UNAUTHENTICATED/NOT_FOUND
  // falls through and renders with whatever loaded (real title once it arrives,
  // empty-content card otherwise).
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

  // Canonical space name is `title`; probe a couple of legacy aliases before the
  // generic fallback so the header shows the real course name, not "Space".
  const spaceData = space.data as unknown as
    | { title?: string; name?: string; displayName?: string }
    | undefined;
  const title = spaceData?.title ?? spaceData?.name ?? spaceData?.displayName ?? "Space";

  return (
    <Screen className="bg-canvas" contentClassName="p-5 gap-4">
      <Breadcrumb
        items={[{ label: "Spaces", onPress: () => router.push(routes.spaces()) }, { label: title }]}
      />

      {/* hero */}
      <View className="gap-3">
        <Text className="font-display text-text-primary text-2xl">{title}</Text>
        {space.data?.description ? (
          <Text className="text-text-secondary text-sm leading-5">{space.data.description}</Text>
        ) : null}

        <View className="gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-text-secondary text-sm font-semibold">Your journey</Text>
            <Text className="text-text-primary text-sm font-semibold">{overall}%</Text>
          </View>
          <ProgressBar value={overall} variant="spark" />
          {progressQ.isLoading ? (
            <Text className="text-2xs text-text-muted">
              Track is ready — your progress is catching up.
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <XPMeter
              level={Math.max(1, Math.floor(earned / 100) + 1)}
              xp={earned}
              next={Math.max(totalPoints, earned + 1)}
            />
          </View>
          {resumeNode ? (
            <Button
              variant="primary"
              leadingIcon={<Icon name="play" size={16} />}
              onPress={() => openNode(resumeNode)}
            >
              {overall > 0 ? "Resume" : "Start"}
            </Button>
          ) : null}
        </View>
      </View>

      <SpaceSections nodes={nodes} totalPoints={totalPoints} onOpen={openNode} />
    </Screen>
  );
}
