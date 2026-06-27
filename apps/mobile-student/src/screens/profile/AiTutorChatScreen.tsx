/**
 * AI Tutor Chat — full-screen / drawer-style conversation with the learner's
 * patient AI mentor. (mobile-student · profile/home lane)
 *
 * Translated from the web design prototype `mobile-family/_build/ai-tutor-chat`.
 * The Socratic tutor guides the learner to the answer; it never reveals the key.
 *
 * Data (ALL via `@levelup/query`, never firebase):
 *  - `useChatSessions()`     — list existing threads; we pick the session from the
 *                              route param, else the most-recently-updated one,
 *                              else start fresh (no sessionId).
 *  - `useChatSession(id)`    — the authoritative message thread for a session.
 *  - `useSendChatMessage()`  — mutation to send a turn (optimistically appends the
 *                              pending user message; server reconciles + may mint a
 *                              new sessionId for a fresh thread).
 *  - `useChatStream(id, cb)` — live subscription; appended assistant tokens stream
 *                              in via the `onPayload` callback while it's `live`.
 *
 * All hook `data` is `unknown` → read defensively. States: loading (skeleton
 * bubbles), error (EmptyState + retry), empty thread (warm prompt), success.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, type ListRenderItemInfo, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { QueryClient } from "@tanstack/react-query";
import {
  useChatSession,
  useChatSessions,
  useChatStream,
  useSendChatMessage,
  type SubscriptionStatus,
} from "@levelup/query";

import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  Screen,
  Skeleton,
  TextField,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";

/* ── defensive readers ──────────────────────────────────────────────────── */
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Unwrap a list envelope: `T[]` | `{ items }` | `{ sessions }` | `{ messages }`. */
function asList(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  const o = obj(v);
  for (const key of ["items", "sessions", "messages", "data", "results"]) {
    if (Array.isArray(o[key])) return o[key] as Record<string, unknown>[];
  }
  return [];
}

/* ── normalized message shape ───────────────────────────────────────────── */
type ChatRole = "user" | "assistant";
interface ChatMsg {
  id: string;
  role: ChatRole;
  text: string;
  pending?: boolean;
}

let _localSeq = 0;
const nextLocalId = (): string => `local_${Date.now()}_${_localSeq++}`;

/** Read one raw message defensively into a ChatMsg (or null to skip). */
function toMsg(raw: unknown, idx: number): ChatMsg | null {
  const o = obj(raw);
  const text = str(o.text) || str(o.content) || str(o.message) || str(o.body);
  const rawRole = (str(o.role) || str(o.author) || str(o.from)).toLowerCase();
  const role: ChatRole =
    rawRole === "user" || rawRole === "student" || rawRole === "human" ? "user" : "assistant";
  if (!text) return null;
  const id = str(o.id) || str(o.messageId) || `idx_${idx}`;
  return { id, role, text, pending: o.pending === true };
}

function mergeById(...lists: ChatMsg[][]): ChatMsg[] {
  const out: ChatMsg[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const m of list) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

/* ── bubbles ────────────────────────────────────────────────────────────── */
function MessageBubble({ msg }: { msg: ChatMsg }): JSX.Element {
  const isUser = msg.role === "user";
  return (
    <View className={`mb-3 w-full flex-row ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <View className="rounded-pill bg-brand-subtle mr-2 mt-1 h-7 w-7 items-center justify-center">
          <Icon name="bot" size={15} color="#4f46e5" />
        </View>
      )}
      <View
        className={
          isUser
            ? "bg-brand max-w-[80%] rounded-xl rounded-tr-sm px-4 py-2.5"
            : "border-border-subtle bg-surface max-w-[82%] rounded-xl rounded-tl-sm border px-4 py-2.5"
        }
        style={{ opacity: msg.pending ? 0.6 : 1 }}
      >
        <Text
          className={`font-ui text-base leading-5 ${
            isUser ? "text-text-on-accent" : "text-text-primary"
          }`}
        >
          {msg.text}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator(): JSX.Element {
  return (
    <View className="mb-3 w-full flex-row justify-start">
      <View className="rounded-pill bg-brand-subtle mr-2 mt-1 h-7 w-7 items-center justify-center">
        <Icon name="bot" size={15} color="#4f46e5" />
      </View>
      <View className="border-border-subtle bg-surface flex-row items-center gap-2 rounded-xl rounded-tl-sm border px-4 py-3">
        <ActivityIndicator size="small" color="#4f46e5" />
        <Text className="font-ui text-text-muted text-sm">Tutor is thinking…</Text>
      </View>
    </View>
  );
}

function SkeletonThread(): JSX.Element {
  return (
    <View className="px-4 pt-4">
      <View className="mb-3 flex-row justify-start">
        <Skeleton width={220} height={48} radius={16} />
      </View>
      <View className="mb-3 flex-row justify-end">
        <Skeleton width={160} height={40} radius={16} />
      </View>
      <View className="mb-3 flex-row justify-start">
        <Skeleton width={260} height={64} radius={16} />
      </View>
      <View className="mb-3 flex-row justify-end">
        <Skeleton width={140} height={40} radius={16} />
      </View>
    </View>
  );
}

/* ── live-stream bridge ─────────────────────────────────────────────────── */
/**
 * Mounts the live chat-stream subscription ONLY when a real session id exists.
 * `useChatStream` subscribes immediately and has no `enabled` option; it builds
 * a Firestore listener path `chatSessions/<id>/messages`, so an EMPTY id yields
 * `chatSessions//messages` — a `//` segment Firestore rejects ("Paths must not
 * contain //"). Gating the hook behind this child's conditional mount keeps the
 * subscription from ever firing with an empty id. It renders nothing; it lifts
 * streamed payloads + the live status up to the screen.
 */
function ChatStreamBridge({
  sessionId,
  onPayload,
  onStatus,
}: {
  sessionId: string;
  onPayload: (payload: unknown, qc: QueryClient) => void;
  onStatus: (status: SubscriptionStatus) => void;
}): null {
  const stream = useChatStream(sessionId, onPayload);
  useEffect(() => {
    onStatus(stream.status);
  }, [stream.status, onStatus]);
  return null;
}

/* ── screen ─────────────────────────────────────────────────────────────── */
export default function AiTutorChatScreen(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId?: string;
    spaceId?: string;
    storyPointId?: string;
    itemId?: string;
  }>();

  const paramSessionId = str(params.sessionId);
  const spaceId = str(params.spaceId);
  const storyPointId = str(params.storyPointId);
  const itemId = str(params.itemId);

  // ── sessions: pick the active thread (param → most recent → fresh) ────────
  const sessionsQ = useChatSessions();
  const sessions = useMemo(() => asList(sessionsQ.data), [sessionsQ.data]);

  const [activeSessionId, setActiveSessionId] = useState<string>(paramSessionId);
  useEffect(() => {
    if (activeSessionId) return;
    if (paramSessionId) {
      setActiveSessionId(paramSessionId);
      return;
    }
    if (sessions.length > 0) {
      const first = obj(sessions[0]);
      const id = str(first.id) || str(first.sessionId);
      if (id) setActiveSessionId(id);
    }
  }, [activeSessionId, paramSessionId, sessions]);

  // ── the authoritative thread for the active session ──────────────────────
  const threadQ = useChatSession(activeSessionId);
  const serverMessages = useMemo<ChatMsg[]>(() => {
    const list = asList(obj(threadQ.data).messages ?? threadQ.data);
    return list.map((m, i) => toMsg(m, i)).filter((m): m is ChatMsg => m !== null);
  }, [threadQ.data]);

  // ── streamed assistant tokens (kept in local state) ──────────────────────
  const [streamed, setStreamed] = useState<ChatMsg[]>([]);
  const onStreamPayload = useCallback((payload: unknown, _qc: QueryClient) => {
    const incoming = asList(obj(payload).messages ?? payload);
    const mapped = incoming.map((m, i) => toMsg(m, i)).filter((m): m is ChatMsg => m !== null);
    if (mapped.length === 0) return;
    setStreamed((prev) => mergeById(prev, mapped));
  }, []);
  // The live subscription is mounted via <ChatStreamBridge> in render — and ONLY
  // when a real session id exists — so it never builds a `chatSessions//messages`
  // path. The bridge lifts the live status here.
  const [streamStatus, setStreamStatus] = useState<SubscriptionStatus>("idle");

  // reset stream buffer + status when switching sessions
  useEffect(() => {
    setStreamed([]);
    setStreamStatus("idle");
  }, [activeSessionId]);

  // ── send ─────────────────────────────────────────────────────────────────
  const sendMutation = useSendChatMessage();
  const [draft, setDraft] = useState("");
  const [optimistic, setOptimistic] = useState<ChatMsg[]>([]);

  const messages = useMemo(
    () => mergeById(serverMessages, optimistic, streamed),
    [serverMessages, optimistic, streamed]
  );

  // drop optimistic copies that the server thread now echoes back
  useEffect(() => {
    if (optimistic.length === 0) return;
    const serverTexts = new Set(serverMessages.map((m) => `${m.role}:${m.text}`));
    setOptimistic((prev) => prev.filter((m) => !serverTexts.has(`${m.role}:${m.text}`)));
  }, [serverMessages, optimistic.length]);

  const sending = sendMutation.isPending;
  const showTyping = sending || streamStatus === "live";

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setOptimistic((prev) => [...prev, { id: nextLocalId(), role: "user", text, pending: true }]);

    sendMutation.mutate(
      {
        sessionId: activeSessionId || undefined,
        spaceId,
        storyPointId,
        itemId,
        text,
      },
      {
        onSuccess: (data) => {
          const d = obj(data);
          const newId = str(d.sessionId) || str(obj(d.session).id);
          if (newId && newId !== activeSessionId) setActiveSessionId(newId);
        },
      }
    );
  }, [draft, sending, sendMutation, activeSessionId, spaceId, storyPointId, itemId]);

  // ── auto-scroll to newest ─────────────────────────────────────────────────
  const listRef = useRef<FlatList<ChatMsg>>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length, showTyping]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatMsg>) => <MessageBubble msg={item} />,
    []
  );

  /* ── derived view state ──────────────────────────────────────────────── */
  const initialLoading =
    (Boolean(activeSessionId) && threadQ.isLoading) || (!activeSessionId && sessionsQ.isLoading);
  const hasError = (Boolean(activeSessionId) && threadQ.isError) || sessionsQ.isError;
  const isEmptyThread = messages.length === 0;

  const header = (
    <TopBar
      title="Your tutor"
      onBack={() => router.back()}
      right={
        <IconButton
          icon="bell"
          label="Notifications"
          variant="ghost"
          onPress={() => router.push(routes.notifications())}
        />
      }
    />
  );

  const composer = (
    <View className="border-border-subtle bg-surface border-t px-3 pb-2 pt-2">
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask your tutor anything…"
            multiline
            editable={!hasError}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
        </View>
        <IconButton
          icon="send-horizontal"
          label="Send message"
          variant="solid"
          solid
          disabled={draft.trim().length === 0 || sending}
          onPress={handleSend}
        />
      </View>
      <View className="mt-1.5 flex-row items-center gap-1.5 px-1">
        <Icon name="shield-check" size={13} color="#6b7280" />
        <Text className="font-ui text-2xs text-text-muted">
          I guide you to the answer — I won&apos;t just give it away.
        </Text>
      </View>
    </View>
  );

  /* ── render ──────────────────────────────────────────────────────────── */
  let body: JSX.Element;
  if (initialLoading) {
    body = <SkeletonThread />;
  } else if (hasError) {
    body = (
      <View className="flex-1 justify-center px-6">
        <EmptyState
          icon="cloud-off"
          title="Couldn't load your tutor"
          body="Something went wrong reaching your conversation. Check your connection and try again."
          action={
            <Button
              variant="secondary"
              leadingIcon="rotate-ccw"
              onPress={() => {
                void sessionsQ.refetch();
                void threadQ.refetch();
              }}
            >
              Retry
            </Button>
          }
        />
      </View>
    );
  } else if (isEmptyThread) {
    body = (
      <View className="flex-1 justify-center px-6">
        <EmptyState
          icon="bot"
          title="Ask your tutor anything"
          body="Where you're stuck, what's confusing, or how to start. I'll ask the right questions to help you get there yourself."
        />
      </View>
    );
  } else {
    body = (
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
        ListFooterComponent={showTyping ? <TypingIndicator /> : null}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
    );
  }

  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      {activeSessionId ? (
        <ChatStreamBridge
          sessionId={activeSessionId}
          onPayload={onStreamPayload}
          onStatus={setStreamStatus}
        />
      ) : null}
      {header}
      <View className="bg-canvas flex-1">{body}</View>
      {composer}
    </Screen>
  );
}
