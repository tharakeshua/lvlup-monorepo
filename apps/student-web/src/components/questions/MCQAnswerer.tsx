import type { MCQData } from "@levelup/shared-types";

interface MCQAnswererProps {
  data: MCQData;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showCorrect?: boolean;
}

export default function MCQAnswerer({
  data,
  value,
  onChange,
  disabled,
  showCorrect,
}: MCQAnswererProps) {
  return (
    <div className="space-y-2">
      {data.options.map((option) => {
        const isSelected = value === option.id;
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
              type="radio"
              name="mcq-answer"
              value={option.id}
              checked={isSelected}
              onChange={() => onChange(option.id)}
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
