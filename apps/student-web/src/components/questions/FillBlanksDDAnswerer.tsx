import type { FillBlanksDDData } from "@levelup/shared-types";

interface FillBlanksDDAnswererProps {
  data: FillBlanksDDData;
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
}

export default function FillBlanksDDAnswerer({
  data,
  value = {},
  onChange,
  disabled,
}: FillBlanksDDAnswererProps) {
  const blanksMap = new Map(data.blanks.map((b) => [b.id, b]));

  const handleChange = (blankId: string, optionId: string) => {
    onChange({ ...value, [blankId]: optionId });
  };

  const parts = data.textWithBlanks.split(/(\{\{[^}]+\}\})/g);

  return (
    <div className="text-sm leading-loose">
      {parts.map((part, index) => {
        const match = part.match(/^\{\{(.+)\}\}$/);
        if (match) {
          const blankId = match[1]!;
          const blank = blanksMap.get(blankId);
          if (!blank) return <span key={index}>[?]</span>;

          return (
            <select
              key={index}
              value={value[blankId] ?? ""}
              onChange={(e) => handleChange(blankId, e.target.value)}
              disabled={disabled}
              className="border-input bg-background focus-visible:ring-ring mx-1 inline-block rounded border px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 disabled:opacity-60"
            >
              <option value="">Select...</option>
              {blank.options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.text}
                </option>
              ))}
            </select>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}
