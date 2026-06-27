import { useState } from "react";
import { useChatSessions } from "@levelup/query";
import ChatTutorPanel from "../components/chat/ChatTutorPanel";
import type { ChatSession } from "@levelup/shared-types";
import { MessageCircle, Bot, Clock, ChevronRight } from "lucide-react";
import { Skeleton } from "@levelup/shared-ui";

interface ChatSessionPage {
  items?: ChatSession[];
  nextCursor?: string | null;
}

export default function ChatTutorPage() {
  const { data: page, isLoading } = useChatSessions<ChatSessionPage>({ limit: 50 });
  const sessions = page?.items;

  const [activeSession, setActiveSession] = useState<{
    spaceId: string;
    storyPointId: string;
    itemId: string;
  } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageCircle className="text-primary h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Chat Tutor</h1>
          <p className="text-muted-foreground text-sm">
            Browse previous chat sessions or start a new one from any question
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="bg-muted/50 rounded-lg border p-8 text-center">
          <Bot className="text-primary/30 mx-auto mb-3 h-10 w-10" />
          <p className="text-sm font-medium">No chat sessions yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Start a conversation with the AI tutor from any question by clicking "Ask AI Tutor"
            while practicing.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const lastMessage = session.messages?.[session.messages.length - 1];
            const rawUpdated = session.updatedAt as unknown;
            const updatedAt = rawUpdated
              ? new Date(
                  typeof rawUpdated === "string"
                    ? rawUpdated
                    : (rawUpdated as { seconds: number }).seconds * 1000
                )
              : null;

            return (
              <button
                key={session.id}
                onClick={() =>
                  setActiveSession({
                    spaceId: session.spaceId,
                    storyPointId: session.storyPointId,
                    itemId: session.itemId,
                  })
                }
                className="bg-card flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-shadow hover:shadow-sm"
              >
                <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <Bot className="text-primary h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium">
                      {session.sessionTitle ?? `Chat Session`}
                    </h3>
                    {session.isActive && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                        Active
                      </span>
                    )}
                  </div>
                  {lastMessage && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {lastMessage.role === "user" ? "You: " : "AI: "}
                      {lastMessage.text}
                    </p>
                  )}
                  <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                    <span>{session.messageCount ?? session.messages?.length ?? 0} messages</span>
                    {updatedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {updatedAt.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground h-5 w-5 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Chat Panel slide-over */}
      {activeSession && (
        <ChatTutorPanel
          spaceId={activeSession.spaceId}
          storyPointId={activeSession.storyPointId}
          itemId={activeSession.itemId}
          onClose={() => setActiveSession(null)}
        />
      )}
    </div>
  );
}
