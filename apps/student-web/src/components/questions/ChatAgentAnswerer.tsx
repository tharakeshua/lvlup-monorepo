import { useState } from "react";
import type { ChatAgentQuestionData } from "@levelup/shared-types";
import { Send } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface ChatAgentAnswererProps {
  data: ChatAgentQuestionData;
  value?: ChatMessage[];
  onChange: (value: ChatMessage[]) => void;
  onSendMessage?: (message: string) => Promise<string>;
  disabled?: boolean;
}

export default function ChatAgentAnswerer({
  data,
  value = [],
  onChange,
  onSendMessage,
  disabled,
}: ChatAgentAnswererProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const maxTurns = data.maxTurns ?? 20;
  const userMessages = value.filter((m) => m.role === "user").length;
  const canSend = userMessages < maxTurns && !sending && input.trim() && !disabled;

  const handleSend = async () => {
    if (!canSend) return;
    const message = input.trim();
    setInput("");
    const updated = [...value, { role: "user" as const, text: message }];
    onChange(updated);
    setSending(true);

    try {
      if (onSendMessage) {
        const reply = await onSendMessage(message);
        onChange([...updated, { role: "assistant" as const, text: reply }]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border">
      {/* Objectives */}
      {data.objectives.length > 0 && (
        <div className="bg-muted/50 border-b p-3">
          <p className="text-muted-foreground text-xs font-medium">Objectives:</p>
          <ul className="text-muted-foreground list-disc pl-4 text-xs">
            {data.objectives.map((obj, i) => (
              <li key={i}>{obj}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Chat messages */}
      <div
        className="h-64 space-y-3 overflow-y-auto p-3"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {value.length === 0 && data.conversationStarters && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">Suggested starters:</p>
            {data.conversationStarters.map((starter, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setInput(starter);
                }}
                disabled={disabled}
                className="hover:bg-accent block w-full rounded border px-3 py-2 text-left text-sm disabled:opacity-60"
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        {value.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground animate-pulse rounded-lg px-3 py-2 text-sm">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={userMessages >= maxTurns ? "Max turns reached" : "Type your message..."}
          disabled={disabled || userMessages >= maxTurns}
          className="border-input focus-visible:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md p-2 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <div className="text-muted-foreground px-3 pb-2 text-xs">
        {userMessages}/{maxTurns} messages used
      </div>
    </div>
  );
}
