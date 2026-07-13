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
    { label: "True", val: true },
    { label: "False", val: false },
  ];

  return (
    <div className="flex gap-3">
      {options.map((opt) => {
        const isSelected = value === opt.val;
        const isCorrectOption = showCorrect && correctAnswer === opt.val;
        const isWrong = showCorrect && isSelected && correctAnswer !== opt.val;

        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.val)}
            disabled={disabled}
            className={`flex-1 rounded-lg border px-6 py-3 text-sm font-medium transition-colors ${
              isSelected
                ? isWrong
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-primary bg-primary/10 text-primary"
                : isCorrectOption
                  ? "border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400"
                  : "border-input hover:bg-accent"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
