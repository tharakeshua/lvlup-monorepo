/**
 * Assign Content (assign-content) — a focused mobile assign flow.
 *
 * The phone is for the QUICK move: pick a space and assign it to this class.
 * Heavy authoring (building/editing content, fine-grained scheduling, per-
 * student targeting) lives on the web app — a prominent "Continue on web"
 * affordance routes there.
 *
 * Data: `useSpaces()` to pick content. The assign action calls the
 * `assignmentRepo.save` callable via a thin `useMutation` over `useApi` (there
 * is no dedicated query-hook for it yet). The mutation MONITOR (idle / pending /
 * success / error) is rendered inline. Until the teacher-assign callable is live
 * (GATE-B) the action fails soft → the screen guides the teacher to web.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  CloudOff,
  Monitor,
  Orbit,
  Search,
} from "lucide-react-native";

import { useApi, useSpaces } from "@levelup/query";

import { Badge, Button, Card, EmptyState, Screen, SearchField, Skeleton } from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { asArray, C, numOf, rec, str } from "./_shared";

interface SpaceRow {
  id: string;
  title: string;
  description?: string;
  points?: number;
}

function toSpace(raw: unknown): SpaceRow {
  const o = rec(raw);
  return {
    id: str(o, "id", "spaceId", "uid") ?? "",
    title: str(o, "title", "name", "displayName") ?? "Untitled space",
    description: str(o, "description", "summary", "subtitle"),
    points:
      numOf(o, "storyPointCount", "points", "totalStoryPoints") ??
      numOf(rec(o.stats ?? o.counts), "storyPoints"),
  };
}

/** Loose shape of the assignment repo on the injected repo bag. */
interface AssignmentRepoLike {
  save(input: {
    contentType: "space" | "exam";
    contentId: string;
    classIds?: string[];
  }): Promise<unknown>;
}

export default function AssignContentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ classId?: string }>();
  const classId = String(params.classId ?? "");
  const { repos } = useApi();

  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const spacesQ = useSpaces();
  const spaces = useMemo(
    () =>
      asArray(spacesQ.data)
        .map(toSpace)
        .filter((s) => s.id || s.title),
    [spacesQ.data]
  );
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return spaces;
    return spaces.filter(
      (s) => s.title.toLowerCase().includes(n) || (s.description ?? "").toLowerCase().includes(n)
    );
  }, [spaces, q]);

  const selected = spaces.find((s) => s.id === selectedId) ?? null;

  const assign = useMutation({
    mutationFn: async (spaceId: string) => {
      const repo = (repos as unknown as Record<string, AssignmentRepoLike>).assignmentRepo;
      if (!repo?.save) throw new Error("Assignment is not available yet");
      return repo.save({
        contentType: "space",
        contentId: spaceId,
        classIds: classId ? [classId] : [],
      });
    },
  });

  // ── monitor banner ─────────────────────────────────────────────────────────
  let monitor: React.ReactNode = null;
  if (assign.isPending) {
    monitor = (
      <Card>
        <View className="flex-row items-center gap-3">
          <Monitor size={18} color={C.brand} />
          <Text className="font-ui text-text-secondary flex-1 text-sm">
            Assigning {selected?.title ?? "space"} to this class…
          </Text>
        </View>
      </Card>
    );
  } else if (assign.isSuccess) {
    monitor = (
      <Card>
        <View className="flex-row items-center gap-3">
          <CheckCircle2 size={18} color={C.success} />
          <Text className="font-ui text-text-primary flex-1 text-sm">
            Assigned. Students will see it on their next sync.
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => router.push(routes.classDetail(classId))}
          >
            Done
          </Button>
        </View>
      </Card>
    );
  } else if (assign.isError) {
    monitor = (
      <Card>
        <View className="gap-2">
          <View className="flex-row items-center gap-3">
            <CloudOff size={18} color={C.warning} />
            <Text className="font-ui text-text-primary flex-1 text-sm">
              Couldn't assign from mobile just yet
            </Text>
          </View>
          <Text className="font-ui text-text-secondary text-xs">
            Assigning content is rolling out — for now, finish this on the web app where you can
            also schedule and target students.
          </Text>
          <View className="flex-row">
            <Button
              variant="secondary"
              size="sm"
              trailingIcon={<ArrowUpRight size={14} color={C.brand} />}
            >
              Continue on web
            </Button>
          </View>
        </View>
      </Card>
    );
  }

  let list: React.ReactNode;
  if (spacesQ.isLoading) {
    list = (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <View className="gap-2">
              <Skeleton width="55%" height={14} />
              <Skeleton width="80%" height={10} />
            </View>
          </Card>
        ))}
      </View>
    );
  } else if (isHardError(spacesQ)) {
    list = (
      <EmptyState
        icon={<CloudOff size={36} color={C.muted} />}
        title="Couldn't load your spaces"
        body="Let's try again — this one's on us."
        action={
          <Button variant="secondary" size="sm" onPress={() => spacesQ.refetch()}>
            Retry
          </Button>
        }
      />
    );
  } else if (spaces.length === 0) {
    list = (
      <EmptyState
        icon={<Orbit size={36} color={C.brand} />}
        title="No spaces to assign yet"
        body="Build a space in the web app, then come back here to assign it to a class in a tap."
        action={
          <Button
            variant="secondary"
            size="sm"
            trailingIcon={<ArrowUpRight size={14} color={C.brand} />}
          >
            Open web authoring
          </Button>
        }
      />
    );
  } else if (filtered.length === 0) {
    list = (
      <Text className="font-ui text-text-muted px-1 py-6 text-center text-sm">
        No spaces match "{q}".
      </Text>
    );
  } else {
    list = (
      <View className="gap-3">
        {filtered.map((s) => {
          const active = s.id === selectedId;
          return (
            <Pressable
              key={s.id || s.title}
              onPress={() => setSelectedId(active ? null : s.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <Card interactive>
                <View className="flex-row items-center gap-3">
                  <View
                    className={`h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-brand-subtle" : "bg-surface-sunken"}`}
                  >
                    {active ? (
                      <Check size={18} color={C.brand} strokeWidth={2.4} />
                    ) : (
                      <Orbit size={16} color={C.muted} />
                    )}
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text
                      className="font-ui text-text-primary text-sm font-semibold"
                      numberOfLines={1}
                    >
                      {s.title}
                    </Text>
                    {s.description ? (
                      <Text className="text-2xs font-ui text-text-muted" numberOfLines={1}>
                        {s.description}
                      </Text>
                    ) : null}
                  </View>
                  {s.points != null ? <Badge>{s.points} pts</Badge> : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <Screen contentClassName="px-5 pt-4 pb-10 gap-5">
      <View className="gap-2">
        <Text className="font-display text-text-primary text-2xl font-semibold">
          Assign content
        </Text>
        <Text className="font-ui text-text-secondary text-sm">
          Pick a space to assign to this class. Building and fine-grained scheduling continue on the
          web.
        </Text>
      </View>

      {/* web-handoff card — the heavy-authoring escape hatch */}
      <Card>
        <View className="flex-row items-start gap-3">
          <View className="bg-brand-subtle h-9 w-9 items-center justify-center rounded-lg">
            <Monitor size={18} color={C.brand} />
          </View>
          <View className="flex-1 gap-1">
            <Text className="font-ui text-text-primary text-sm font-semibold">
              Authoring lives on the web
            </Text>
            <Text className="font-ui text-text-secondary text-xs">
              Create content, set due dates, and target individual students in the full web editor.
            </Text>
          </View>
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowUpRight size={14} color={C.brand} />}
          >
            Continue on web
          </Button>
        </View>
      </Card>

      {monitor}

      <View className="flex-row items-center gap-2">
        <Search size={14} color={C.muted} />
        <Text className="text-2xs text-text-muted font-mono uppercase tracking-wide">
          Choose a space
        </Text>
      </View>
      {spaces.length > 0 ? (
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Search spaces"
          onClear={() => setQ("")}
        />
      ) : null}

      {list}

      {/* sticky-ish assign action */}
      {selected ? (
        <Button
          variant="primary"
          block
          loading={assign.isPending}
          leadingIcon={<Check size={16} color="#FFFDFA" />}
          onPress={() => assign.mutate(selected.id)}
        >
          Assign “{selected.title}”
        </Button>
      ) : null}
    </Screen>
  );
}
