import type { ParagraphData } from "@levelup/shared-types";
import { Mic, Square } from "lucide-react";
import { useSpeechToText } from "../../hooks/useSpeechToText";

interface ParagraphAnswererProps {
  data: ParagraphData;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function ParagraphAnswerer({
  data,
  value = "",
  onChange,
  disabled,
}: ParagraphAnswererProps) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  const { isSupported, isListening, toggle } = useSpeechToText({
    onResult: (transcript) => {
      const needsSpace = value.length > 0 && !/\s$/.test(value);
      onChange(value + (needsSpace ? " " : "") + transcript);
    },
  });

  return (
    <div>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={6}
          placeholder="Write your answer..."
          className="border-input focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 pr-10 text-sm focus:outline-none focus-visible:ring-2 disabled:opacity-60"
        />
        {isSupported && (
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            aria-pressed={isListening}
            aria-label={isListening ? "Stop voice input" : "Answer with your voice"}
            title={isListening ? "Stop voice input" : "Answer with your voice"}
            className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
              isListening
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {isListening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <div className="text-muted-foreground mt-1 flex justify-between text-xs">
        <span>
          {wordCount} words{isListening && " · Listening…"}
        </span>
        <span>
          {data.minLength && `Min: ${data.minLength}`}
          {data.minLength && data.maxLength && " | "}
          {data.maxLength && `Max: ${data.maxLength} chars`}
        </span>
      </div>
    </div>
  );
}
