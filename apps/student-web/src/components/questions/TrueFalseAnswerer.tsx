import { Check, X } from "lucide-react";

interface TrueFalseAnswererProps {
  value?: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  showCorrect?: boolean;
  correctAnswer?: boolean;
}

export default function TrueFalseAnswerer({
  value,
  onChange,
  disabled,
  showCorrect,
  correctAnswer,
}: TrueFalseAnswererProps) {
  const options = [
    { label: "True", val: true, Icon: Check },
    { label: "False", val: false, Icon: X },
  ];

  return (
    <div className="flex gap-3">
      {options.map((opt) => {
        const isSelected = value === opt.val;
        const isCorrectOption = showCorrect && correctAnswer === opt.val;
        const isWrong = showCorrect && isSelected && correctAnswer !== opt.val;

        const frame = isSelected
          ? isWrong
            ? "border-error bg-error/10 text-error"
            : "border-brand bg-brand-subtle/60 text-brand shadow-e1"
          : isCorrectOption
            ? "border-success bg-success/10 text-success"
            : "border-subtle text-fg-secondary hover:border-strong hover:bg-surface-sunken/60";

        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.val)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`duration-fast ease-standard focus-visible:ring-brand/40 flex flex-1 items-center justify-center gap-2 rounded-lg border px-6 py-3.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 ${frame} ${
              disabled ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            <opt.Icon className="h-4 w-4" aria-hidden />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
