/**
 * Scoped tutor route. A tutor session is never selected globally: the route
 * either supplies a complete space/story/item scope or lets the learner pick a
 * space before starting. The shared controller owns resume and lifecycle.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConversations, useSpaces } from "@levelup/query";

import {
  conversationListFilter,
  useConversationController,
  useConversationOperations,
  type ConversationContext,
  type ConversationSessionSummaryView,
  type TutorContext,
} from "../../features/conversation";
import {
  Button,
  Card,
  ConversationScaffold,
  EmptyState,
  Icon,
  Screen,
  Skeleton,
  TopBar,
} from "../../components";
import { routes, type TutorRouteParams } from "../../lib/routes";
import { colors } from "../../theme";

const stringParam = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value.trim() : "";

function tutorContextFromParams(params: {
  scope?: string | string[];
  spaceId?: string | string[];
  storyPointId?: string | string[];
  itemId?: string | string[];
}): ConversationContext | undefined {
  const scope = stringParam(params.scope);
  const spaceId = stringParam(params.spaceId);
  const storyPointId = stringParam(params.storyPointId);
  const itemId = stringParam(params.itemId);
  if (!spaceId) return undefined;
  if (scope === "space") return { kind: "tutor", scope, spaceId };
  if (scope === "story_point" && storyPointId) {
    return { kind: "tutor", scope, spaceId, storyPointId };
  }
  if (scope === "item" && storyPointId && itemId) {
    return { kind: "tutor", scope, spaceId, storyPointId, itemId };
  }
  return undefined;
}

function contextLabel(context: ConversationContext): string {
  if (context.kind !== "tutor") return "Learning support";
  if (context.scope === "space") return "Support for this learning space";
  if (context.scope === "story_point") return "Support for this lesson";
  return "Support for this question";
}

function toTutorRoute(context: ConversationContext, sessionId?: string): TutorRouteParams {
  if (context.kind !== "tutor") throw new Error("Tutor route requires tutor context");
  if (context.scope === "space") return { scope: "space", spaceId: context.spaceId, sessionId };
  if (context.scope === "story_point") {
    return {
      scope: "story_point",
      spaceId: context.spaceId,
      storyPointId: context.storyPointId,
      sessionId,
    };
  }
  return {
    scope: "item",
    spaceId: context.spaceId,
    storyPointId: context.storyPointId,
    itemId: context.itemId,
    sessionId,
  };
}

function listFromUnknown(value: unknown): { id: string; title: string }[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).items)
      ? ((value as Record<string, unknown>).items as unknown[])
      : [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id =
      typeof item.id === "string" ? item.id : typeof item.spaceId === "string" ? item.spaceId : "";
    if (!id) return [];
    const title =
      typeof item.title === "string"
        ? item.title
        : typeof item.name === "string"
          ? item.name
          : "Untitled space";
    return [{ id, title }];
  });
}

function TutorScopePicker() {
  const router = useRouter();
  const spacesQ = useSpaces<unknown>();
  const spaces = useMemo(() => listFromUnknown(spacesQ.data), [spacesQ.data]);

  return (
    <Screen scroll={false} contentClassName="gap-4">
      <TopBar title="Your tutor" onBack={() => router.back()} />
      <View className="flex-1 gap-4">
        <View className="bg-brand-subtle gap-2 rounded-lg p-4">
          <View className="flex-row items-center gap-2">
            <Icon name="graduation-cap" size={21} color={colors.brand} />
            <Text accessibilityRole="header" className="font-display text-text-primary text-xl">
              Pick a learning space
            </Text>
          </View>
          <Text className="font-ui text-text-secondary text-sm leading-5">
            Your tutor stays within the space you choose, so guidance has the right context.
          </Text>
        </View>
        {spacesQ.isLoading ? (
          <View className="gap-2">
            <Skeleton height={68} radius={12} />
            <Skeleton height={68} radius={12} />
          </View>
        ) : spaces.length === 0 ? (
          <EmptyState
            icon="book-open"
            title="No learning spaces available"
            body="Join or open a learning space first, then return here for scoped help."
            action={
              <Button variant="secondary" onPress={() => router.push(routes.spaces())}>
                Browse spaces
              </Button>
            }
          />
        ) : (
          <ScrollView contentContainerClassName="gap-2" showsVerticalScrollIndicator={false}>
            {spaces.map((space) => (
              <Card
                key={space.id}
                interactive
                onPress={() => router.replace(routes.tutor({ scope: "space", spaceId: space.id }))}
                className="min-h-16 flex-row items-center gap-3"
              >
                <View className="bg-spark h-10 w-10 items-center justify-center rounded-md">
                  <Icon name="book-open" size={19} color={colors.textPrimary} />
                </View>
                <Text
                  className="font-ui text-text-primary flex-1 text-base font-semibold"
                  numberOfLines={2}
                >
                  {space.title}
                </Text>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </Card>
            ))}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

function ScopedTutor({ context, sessionId }: { context: TutorContext; sessionId?: string }) {
  const router = useRouter();
  const operations = useConversationOperations();
  const controller = useConversationController({
    mode: "tutor",
    context,
    operations,
    sessionId,
    autoStart: true,
  });
  const [showSessions, setShowSessions] = useState(false);
  const conversationsQ = useConversations(conversationListFilter({ mode: "tutor", context }), {
    throwOnError: false,
  });
  const sessions = useMemo(
    () => (conversationsQ.data?.items ?? []) as unknown as ConversationSessionSummaryView[],
    [conversationsQ.data]
  );

  const previousSessions = sessions.filter((session) => session.id !== controller.session?.id);

  return (
    <Screen scroll={false} contentClassName="gap-3">
      <TopBar
        title="Your tutor"
        subtitle={contextLabel(context)}
        onBack={() => router.back()}
        right={
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="book-open"
            onPress={() => router.replace(routes.tutorPicker())}
          >
            Change
          </Button>
        }
      />
      {previousSessions.length > 0 ? (
        <View className="gap-2">
          <Pressable
            onPress={() => setShowSessions((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showSessions }}
            className="bg-surface-sunken min-h-11 flex-row items-center justify-between rounded-md px-3 py-2"
          >
            <Text className="font-ui text-text-secondary text-sm">
              Past conversations in this scope
            </Text>
            <Icon
              name={showSessions ? "chevron-up" : "chevron-down"}
              size={17}
              color={colors.textMuted}
            />
          </Pressable>
          {showSessions ? (
            <View className="gap-1.5">
              {previousSessions.map((session) => (
                <Card
                  key={session.id}
                  interactive
                  onPress={() => router.replace(routes.tutor(toTutorRoute(context, session.id)))}
                  className="min-h-12 flex-row items-center gap-2 py-2.5"
                >
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text
                      className="font-ui text-text-primary text-sm font-semibold"
                      numberOfLines={1}
                    >
                      {session.title || "Resume a previous conversation"}
                    </Text>
                    {session.lastMessagePreview ? (
                      <Text className="font-ui text-text-muted text-xs" numberOfLines={1}>
                        {session.lastMessagePreview}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.textMuted} />
                </Card>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <ConversationScaffold
        controller={controller}
        mode="tutor"
        contextLabel={contextLabel(context)}
        onClose={() => router.back()}
      />
    </Screen>
  );
}

export default function AiTutorChatScreen(): JSX.Element {
  const params = useLocalSearchParams<{
    scope?: string;
    spaceId?: string;
    storyPointId?: string;
    itemId?: string;
    sessionId?: string;
  }>();
  const context = tutorContextFromParams(params);
  const sessionId = stringParam(params.sessionId);

  if (!context) return <TutorScopePicker />;
  const tutorContext = context as TutorContext;
  const key = `${tutorContext.kind}:${tutorContext.scope}:${tutorContext.spaceId}:${"storyPointId" in tutorContext ? (tutorContext.storyPointId ?? "") : ""}:${"itemId" in tutorContext ? (tutorContext.itemId ?? "") : ""}:${sessionId}`;
  return <ScopedTutor key={key} context={tutorContext} sessionId={sessionId || undefined} />;
}
