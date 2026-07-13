import type { ParagraphData } from "@levelup/shared-types";

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

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={6}
        placeholder="Write your answer..."
        className="border-input focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 disabled:opacity-60"
      />
      <div className="text-muted-foreground mt-1 flex justify-between text-xs">
        <span>{wordCount} words</span>
        <span>
          {data.minLength && `Min: ${data.minLength}`}
          {data.minLength && data.maxLength && " | "}
          {data.maxLength && `Max: ${data.maxLength} chars`}
        </span>
      </div>
    </div>
  );
}
