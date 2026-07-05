/**
 * ChatAgentQuestion — the multi-turn UI for the `chat_agent_question` type.
 *
 * The learner holds a real conversation with the AI agent (same backend the
 * profile AI-Tutor uses: `useSendChatMessage` → `v1.levelup.sendChatMessage`,
 * with live assistant tokens streamed over `useChatStream`). Each turn is
 * accumulated into the controlled answer value shaped for AI grading:
 *
 *     value = { transcript: [{ role: "user" | "assistant", content: string }, …] }
 *
 * (matches the domain LEARNER schema `ChatAgentQuestionLearner` in
 * packages/domain/.../question-types/registry.ts).
 *
 * `agentInstructions` frame the opening turn; `maxTurns` (when set) caps the
 * number of learner messages — the composer is sealed once the limit is hit.
 *
 * Reused reference: src/screens/profile/AiTutorChatScreen.tsx. We deliberately
 * do NOT use a FlatList here — this component renders inside the item viewer's
 * outer ScrollView, so the thread is a plain mapped column of bubbles.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import {
  useChatSession,
  useChatStream,
  useSendChatMessage,
  type SubscriptionStatus,
} from "@levelup/query";

import { colors } from "../../theme";
import { cx } from "../cx";
import { Icon } from "../Icon";

/* ── defensive readers ──────────────────────────────────────────────────── */
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Unwrap a list envelope: `T[]` | `{ items | messages | data | results }`. */
function asList(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  const o = obj(v);
  for (const key of ["messages", "items", "data", "results"]) {
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

function roleOf(raw: string): ChatRole {
  const r = raw.toLowerCase();
  return r === "user" || r === "student" || r === "human" ? "user" : "assistant";
}

/** Read one raw server/stream message defensively into a ChatMsg (or null). */
function toMsg(raw: unknown, idx: number): ChatMsg | null {
  const o = obj(raw);
  const text = str(o.text) || str(o.content) || str(o.message) || str(o.body);
  if (!text) return null;
  const role = roleOf(str(o.role) || str(o.author) || str(o.from));
  const id = str(o.id) || str(o.messageId) || `idx_${idx}`;
  return { id, role, text, pending: o.pending === true };
}

/** Seed the thread from the persisted answer transcript (on re-entry). */
function fromTranscript(value: unknown): ChatMsg[] {
  const t = obj(value).transcript;
  return asList(Array.isArray(t) ? t : []).map((m, i) => {
    const o = obj(m);
    return {
      id: `t_${i}`,
      role: roleOf(str(o.role)),
      text: str(o.content) || str(o.text),
    };
  });
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

/* ── live-stream bridge (mounted only for a real session id) ─────────────── */
/**
 * `useChatStream` has no `enabled` flag and builds a Firestore path
 * `chatSessions/<id>/messages`; an empty id yields a rejected `//` segment. So
 * this child is mounted ONLY when a real session id exists, gating the hook.
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

/* ── bubbles ────────────────────────────────────────────────────────────── */
function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <View className={cx("mb-2.5 w-full flex-row", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? (
        <View className="rounded-pill bg-brand-subtle mr-2 mt-1 h-7 w-7 items-center justify-center">
          <Icon name="bot" size={15} color={colors.brand} />
        </View>
      ) : null}
      <View
        className={
          isUser
            ? "bg-brand max-w-[80%] rounded-xl rounded-tr-sm px-3.5 py-2.5"
            : "border-border-subtle bg-surface max-w-[82%] rounded-xl rounded-tl-sm border px-3.5 py-2.5"
        }
        style={{ opacity: msg.pending ? 0.6 : 1 }}
      >
        <Text
          className={cx(
            "font-ui text-base leading-5",
            isUser ? "text-text-on-accent" : "text-text-primary"
          )}
        >
          {msg.text}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View className="mb-2.5 w-full flex-row justify-start">
      <View className="rounded-pill bg-brand-subtle mr-2 mt-1 h-7 w-7 items-center justify-center">
        <Icon name="bot" size={15} color={colors.brand} />
      </View>
      <View className="border-border-subtle bg-surface flex-row items-center gap-2 rounded-xl rounded-tl-sm border px-3.5 py-3">
        <ActivityIndicator size="small" color={colors.brand} />
        <Text className="font-ui text-text-muted text-sm">Thinking…</Text>
      </View>
    </View>
  );
}

/* ── component ──────────────────────────────────────────────────────────── */
export interface ChatAgentQuestionProps {
  /** questionData / prompt payload — reads `agentInstructions`, `maxTurns`. */
  data: Record<string, unknown>;
  /** Controlled answer value: `{ transcript: [{ role, content }] }`. */
  value: unknown;
  onChange?: (value: unknown) => void;
  disabled?: boolean;
  /** Item context threaded from the viewer — required by sendChatMessage. */
  itemId?: string;
  spaceId?: string;
  storyPointId?: string;
}

export function ChatAgentQuestion({
  data,
  value,
  onChange,
  disabled,
  itemId,
  spaceId,
  storyPointId,
}: ChatAgentQuestionProps) {
  const instructions = str(data.agentInstructions);
  const rawMaxTurns = data.maxTurns;
  const maxTurns = typeof rawMaxTurns === "number" && rawMaxTurns > 0 ? rawMaxTurns : 0;

  // Seed prior conversation from the persisted answer (re-entry / review).
  const seeded = useMemo(() => fromTranscript(value), [value]);
  const [activeSessionId, setActiveSessionId] = useState("");

  // ── authoritative thread for the live session ────────────────────────────
  const threadQ = useChatSession(activeSessionId);
  const serverMessages = useMemo<ChatMsg[]>(() => {
    if (!activeSessionId) return [];
    const list = asList(obj(threadQ.data).messages ?? threadQ.data);
    return list.map((m, i) => toMsg(m, i)).filter((m): m is ChatMsg => m !== null);
  }, [activeSessionId, threadQ.data]);

  // ── streamed assistant tokens ────────────────────────────────────────────
  const [streamed, setStreamed] = useState<ChatMsg[]>([]);
  const [streamStatus, setStreamStatus] = useState<SubscriptionStatus>("idle");
  const onStreamPayload = useCallback((payload: unknown) => {
    const incoming = asList(obj(payload).messages ?? payload);
    const mapped = incoming.map((m, i) => toMsg(m, i)).filter((m): m is ChatMsg => m !== null);
    if (mapped.length > 0) setStreamed((prev) => mergeById(prev, mapped));
  }, []);
  useEffect(() => {
    setStreamed([]);
    setStreamStatus("idle");
  }, [activeSessionId]);

  // ── send ──────────────────────────────────────────────────────────────────
  const sendMutation = useSendChatMessage();
  const [draft, setDraft] = useState("");
  const [optimistic, setOptimistic] = useState<ChatMsg[]>([]);
  const sending = sendMutation.isPending;

  // Once a live session exists it is the source of truth; before that we show
  // the seeded (persisted) transcript so returning to the question restores it.
  const messages = useMemo<ChatMsg[]>(() => {
    if (activeSessionId) return mergeById(serverMessages, optimistic, streamed);
    return mergeById(seeded, optimistic);
  }, [activeSessionId, serverMessages, optimistic, streamed, seeded]);

  // drop optimistic copies the server thread now echoes back
  useEffect(() => {
    if (optimistic.length === 0 || serverMessages.length === 0) return;
    const serverTexts = new Set(serverMessages.map((m) => `${m.role}:${m.text}`));
    setOptimistic((prev) => prev.filter((m) => !serverTexts.has(`${m.role}:${m.text}`)));
  }, [serverMessages, optimistic.length]);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const turnsReached = maxTurns > 0 && userTurns >= maxTurns;
  const showTyping = sending || streamStatus === "live";

  // ── accumulate the transcript into the answer value ──────────────────────
  const lastEmitted = useRef<string>("");
  useEffect(() => {
    // Only publish once a live conversation is under way, so we never overwrite
    // the persisted answer with the copy we just seeded FROM it.
    if (!activeSessionId) return;
    const transcript = messages
      .filter((m) => !m.pending && m.text.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.text }));
    const encoded = JSON.stringify(transcript);
    if (encoded === lastEmitted.current) return;
    lastEmitted.current = encoded;
    onChange?.({ transcript });
  }, [activeSessionId, messages, onChange]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || sending || disabled || turnsReached) return;
    setDraft("");
    setOptimistic((prev) => [...prev, { id: nextLocalId(), role: "user", text, pending: true }]);
    sendMutation.mutate(
      {
        sessionId: activeSessionId || undefined,
        spaceId: str(spaceId),
        storyPointId: str(storyPointId),
        itemId: str(itemId),
        text,
      },
      {
        onSuccess: (result) => {
          const d = obj(result);
          const newId = str(d.sessionId) || str(obj(d.session).id);
          if (newId && newId !== activeSessionId) setActiveSessionId(newId);
        },
      }
    );
  }, [
    draft,
    sending,
    disabled,
    turnsReached,
    sendMutation,
    activeSessionId,
    spaceId,
    storyPointId,
    itemId,
  ]);

  const composerSealed = disabled || turnsReached;
  const canSend = draft.trim().length > 0 && !sending && !composerSealed;

  return (
    <View className="gap-3">
      {/* opening framing */}
      {instructions ? (
        <View className="bg-surface-sunken flex-row gap-2 rounded-md p-3">
          <Icon name="bot" size={16} color={colors.brand} />
          <Text className="font-ui text-text-secondary flex-1 text-sm">{instructions}</Text>
        </View>
      ) : null}

      {/* turn counter */}
      {maxTurns > 0 ? (
        <Text className="font-ui text-text-muted text-xs">
          {turnsReached
            ? `Conversation complete — ${maxTurns} of ${maxTurns} turns used.`
            : `Turn ${userTurns + 1} of ${maxTurns}`}
        </Text>
      ) : null}

      {/* thread */}
      <View
        className="border-border-subtle bg-canvas rounded-md border p-3"
        style={{ minHeight: 120 }}
      >
        {messages.length === 0 ? (
          <View className="items-center gap-1 py-6">
            <Icon name="message-circle" size={22} color={colors.textMuted} />
            <Text className="font-ui text-text-muted text-sm">
              Start the conversation with a message below.
            </Text>
          </View>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} msg={m} />)
        )}
        {showTyping ? <TypingIndicator /> : null}
      </View>

      {/* composer */}
      {composerSealed && !disabled ? (
        <View className="rounded-md bg-green-200/40 px-3 py-2.5">
          <Text className="font-ui text-success text-sm font-semibold">
            You&apos;ve completed this conversation.
          </Text>
        </View>
      ) : (
        <View className="flex-row items-end gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            editable={!composerSealed}
            multiline
            placeholder={disabled ? "" : "Type your response…"}
            placeholderTextColor={colors.textMuted}
            style={{ minHeight: 44, maxHeight: 140, textAlignVertical: "top" }}
            className="border-border-strong bg-surface font-ui text-text-primary flex-1 rounded-md border px-3 py-2.5 text-base"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            className={cx(
              "h-11 w-11 items-center justify-center rounded-md",
              canSend ? "bg-brand" : "bg-border-subtle"
            )}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <Icon name="send-horizontal" size={18} color={colors.textOnAccent} />
            )}
          </Pressable>
        </View>
      )}

      {/* live stream — mounted only for a real session id */}
      {activeSessionId ? (
        <ChatStreamBridge
          sessionId={activeSessionId}
          onPayload={onStreamPayload}
          onStatus={setStreamStatus}
        />
      ) : null}
    </View>
  );
}
