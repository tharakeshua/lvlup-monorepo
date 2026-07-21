import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@levelup/shared-stores";
import { useChatSession, useItemChatSessions, useSendChatMessage } from "../../hooks/useChatTutor";
import { Send, Bot, User, X, Minimize2, Plus, ChevronLeft } from "lucide-react";
import { Input, Button } from "@levelup/shared-ui";

interface ChatTutorPanelProps {
  spaceId: string;
  storyPointId: string;
  itemId: string;
  onClose: () => void;
}

export default function ChatTutorPanel({
  spaceId,
  storyPointId,
  itemId,
  onClose,
}: ChatTutorPanelProps) {
  const { currentTenantId, user } = useAuthStore();
  const userId = user?.uid ?? null;
  // `activeSessionId` = an explicitly-selected session. `isNewSession` = the user
  // asked for a fresh, isolated chat for THIS question (per owner decision:
  // sessions are question-level, and "New Session" starts a genuinely empty one).
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isNewSession, setIsNewSession] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);

  const { data: allSessions } = useItemChatSessions(currentTenantId, userId, itemId);

  // Resolve which session to load: an explicit selection wins; otherwise, unless
  // the user started a fresh session, auto-open this question's most-recent one so
  // its history is visible on open (the list is most-recent-first).
  const effectiveSessionId =
    activeSessionId ?? (isNewSession ? null : (allSessions?.[0]?.id ?? null));
  const { data: session } = useChatSession(currentTenantId, userId, itemId, effectiveSessionId);
  const sendMessage = useSendChatMessage();

  const [input, setInput] = useState("");
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = session?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");

    try {
      const res = await sendMessage.mutateAsync({
        tenantId: currentTenantId ?? "",
        spaceId,
        storyPointId,
        itemId,
        message: text,
        sessionId: effectiveSessionId ?? undefined,
      });
      // Adopt the session the server used/created so follow-up turns continue it
      // (and a fresh session stops being "new" once it has a message).
      const newId = (res as { sessionId?: string }).sessionId;
      if (newId) {
        setActiveSessionId(newId);
        setIsNewSession(false);
      }
    } catch {
      // Errors surface via the shared api-error toast (mutation onError); keep the
      // typed text so the user can retry without re-typing.
      setInput(text);
    }
  };

  const startNewSession = () => {
    setActiveSessionId(null);
    setIsNewSession(true);
    setShowSessionList(false);
    // Sending the first message (with no sessionId) creates the fresh session.
  };

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button size="sm" onClick={() => setMinimized(false)} className="gap-2 shadow-lg">
          <Bot className="h-4 w-4" /> AI Tutor
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop — dims the underlying question so it doesn't bleed through
          behind the panel; the panel is a fixed-position overlay, not part of
          the page flow, so without this the question text stays fully visible
          and interactive around/behind it. */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="bg-background fixed bottom-0 right-0 z-50 flex h-[500px] max-h-[70vh] w-96 max-w-[calc(100vw-1rem)] flex-col rounded-t-xl border border-b-0 shadow-xl sm:bottom-4 sm:right-4 sm:rounded-xl sm:border-b">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {showSessionList ? (
              <button
                type="button"
                onClick={() => setShowSessionList(false)}
                className="hover:text-primary flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <>
                <Bot className="text-primary h-5 w-5" />
                AI Tutor
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!showSessionList && allSessions && allSessions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setShowSessionList(true)}
              >
                Sessions ({allSessions.length})
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setMinimized(true)}
              aria-label="Minimize chat"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="Close chat"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {showSessionList ? (
          /* Session List View */
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={startNewSession}
            >
              <Plus className="h-3.5 w-3.5" /> New Session
            </Button>
            {allSessions?.map((s) => {
              // List items are summaries (no `messages` array) — use the summary
              // fields the list endpoint returns.
              const summary = s as unknown as {
                id: string;
                sessionTitle?: string;
                previewMessage?: string;
                messageCount?: number;
              };
              const isActive = s.id === effectiveSessionId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setActiveSessionId(s.id);
                    setIsNewSession(false);
                    setShowSessionList(false);
                  }}
                  className={`hover:bg-accent w-full rounded-lg border p-3 text-left transition-colors ${
                    isActive ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <p className="truncate text-sm font-medium">
                    {summary.sessionTitle || "Tutor chat"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {summary.messageCount ?? 0} messages
                  </p>
                  {summary.previewMessage && (
                    <p className="text-muted-foreground mt-0.5 truncate text-sm">
                      {summary.previewMessage}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* Chat View */
          <>
            <div
              className="flex-1 space-y-3 overflow-y-auto p-4"
              role="log"
              aria-label="Chat messages"
            >
              {messages.length === 0 && (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  <Bot className="text-primary/30 mx-auto mb-2 h-8 w-8" />
                  <p>Ask me anything about this question!</p>
                  <p className="mt-1 text-xs">I'll guide you without giving away the answer.</p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <Bot className="text-primary mt-1 h-6 w-6 flex-shrink-0" />
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.role === "user" && (
                    <User className="text-muted-foreground mt-1 h-6 w-6 flex-shrink-0" />
                  )}
                </div>
              ))}

              {sendMessage.isPending && (
                <div className="flex gap-2">
                  <Bot className="text-primary mt-1 h-6 w-6 flex-shrink-0" />
                  <div className="bg-muted flex items-center gap-1 rounded-lg px-4 py-3">
                    <span
                      className="bg-primary/60 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="bg-primary/60 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="bg-primary/60 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 border-t p-3">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Ask the AI tutor..."
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || sendMessage.isPending}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
