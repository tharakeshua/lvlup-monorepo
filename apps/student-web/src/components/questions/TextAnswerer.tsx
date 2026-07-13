import type { TextData } from "@levelup/shared-types";

interface TextAnswererProps {
  data: TextData;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function TextAnswerer({ data, value = "", onChange, disabled }: TextAnswererProps) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={data.maxLength}
        placeholder="Type your answer"
        className="border-input focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 disabled:opacity-60"
      />
      {data.maxLength && (
        <p className="text-muted-foreground mt-1 text-right text-xs">
          {value.length}/{data.maxLength}
        </p>
      )}
    </div>
  );
}
