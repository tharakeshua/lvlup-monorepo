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
    <div className="space-y-2" role="radiogroup">
      {data.options.map((option, idx) => {
        const letter = String.fromCharCode(65 + idx);
        const isSelected = value === option.id;
        const isCorrectOption = showCorrect && option.isCorrect;
        const isWrong = showCorrect && isSelected && !option.isCorrect;

        const frame = isSelected
          ? isWrong
            ? "border-error bg-error/10"
            : "border-brand bg-brand-subtle/60 shadow-e1"
          : isCorrectOption
            ? "border-success bg-success/10"
            : "border-subtle hover:border-strong hover:bg-surface-sunken/60";

        const badge = isSelected
          ? isWrong
            ? "border-transparent bg-error text-fg-on-accent"
            : "border-transparent bg-brand text-fg-on-accent"
          : isCorrectOption
            ? "border-transparent bg-success text-fg-on-accent"
            : "border-subtle bg-surface-sunken text-fg-secondary";

        return (
          <label
            key={option.id}
            className={`duration-fast ease-standard focus-within:ring-brand/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-all focus-within:ring-2 ${frame} ${
              disabled ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            <input
              type="radio"
              name="mcq-answer"
              value={option.id}
              checked={isSelected}
              onChange={() => onChange(option.id)}
              disabled={disabled}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`duration-fast flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold transition-colors ${badge}`}
            >
              {letter}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="text-fg text-sm leading-relaxed">{option.text}</span>
              {showCorrect && isSelected && option.explanation && (
                <span className="text-fg-secondary mt-1 block text-xs leading-relaxed">
                  {option.explanation}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
