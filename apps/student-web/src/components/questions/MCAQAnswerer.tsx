import type { MCAQData } from "@levelup/shared-types";

interface MCAQAnswererProps {
  data: MCAQData;
  value?: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  showCorrect?: boolean;
}

export default function MCAQAnswerer({
  data,
  value = [],
  onChange,
  disabled,
  showCorrect,
}: MCAQAnswererProps) {
  const toggleOption = (optionId: string) => {
    if (value.includes(optionId)) {
      onChange(value.filter((id) => id !== optionId));
    } else {
      if (data.maxSelections && value.length >= data.maxSelections) return;
      onChange([...value, optionId]);
    }
  };

  return (
    <div className="space-y-2">
      {data.minSelections && (
        <p className="text-muted-foreground mb-1 text-xs">
          Select {data.minSelections}
          {data.maxSelections && data.maxSelections !== data.minSelections
            ? `–${data.maxSelections}`
            : ""}{" "}
          options
        </p>
      )}
      {data.options.map((option) => {
        const isSelected = value.includes(option.id);
        const isCorrectOption = showCorrect && option.isCorrect;
        const isWrong = showCorrect && isSelected && !option.isCorrect;

        return (
          <label
            key={option.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              isSelected
                ? isWrong
                  ? "border-destructive bg-destructive/10"
                  : "border-primary bg-primary/10"
                : isCorrectOption
                  ? "border-emerald-400 bg-emerald-500/10 dark:border-emerald-600"
                  : "border-input hover:bg-accent"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleOption(option.id)}
              disabled={disabled}
              className="mt-0.5"
            />
            <div>
              <span className="text-sm">{option.text}</span>
              {showCorrect && isSelected && option.explanation && (
                <p className="text-muted-foreground mt-1 text-xs">{option.explanation}</p>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
