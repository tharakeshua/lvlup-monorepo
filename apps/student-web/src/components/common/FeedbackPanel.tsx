import type { UnifiedEvaluationResult } from "@levelup/shared-types";
import {
  CheckCircle2,
  CircleDot,
  AlertCircle,
  Minus,
  Sparkles,
  Sprout,
  BookOpen,
} from "lucide-react";

interface FeedbackPanelProps {
  evaluation: UnifiedEvaluationResult;
  explanation?: string;
}

export default function FeedbackPanel({ evaluation, explanation }: FeedbackPanelProps) {
  // correctness is a number: 1 = correct, 0 = incorrect, 0 < x < 1 = partial
  const isCorrect = evaluation.correctness >= 1;
  const isPartial = evaluation.correctness > 0 && evaluation.correctness < 1;
  const isIncorrect = evaluation.correctness === 0;

  const frame = isCorrect
    ? "border-success/30 bg-success/10"
    : isPartial
      ? "border-warning/30 bg-warning/10"
      : isIncorrect
        ? "border-error/30 bg-error/10"
        : "border-subtle bg-surface-sunken/60";

  const barColor = isCorrect ? "bg-success" : isPartial ? "bg-warning" : "bg-error";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-ly-rise mt-4 rounded-lg border p-4 sm:p-5 ${frame}`}
    >
      <div className="mb-2 flex items-center gap-2">
        {isCorrect && <CheckCircle2 className="text-success h-5 w-5 shrink-0" aria-hidden />}
        {isPartial && <CircleDot className="text-warning h-5 w-5 shrink-0" aria-hidden />}
        {isIncorrect && <AlertCircle className="text-error h-5 w-5 shrink-0" aria-hidden />}
        {!evaluation.correctness && !isIncorrect && (
          <Minus className="text-fg-muted h-5 w-5 shrink-0" aria-hidden />
        )}
        <span
          className={`font-display text-base ${
            isCorrect
              ? "text-success"
              : isPartial
                ? "text-warning"
                : isIncorrect
                  ? "text-error"
                  : "text-fg"
          }`}
        >
          {isCorrect
            ? "Got it!"
            : isPartial
              ? "You're close — let's look at this part again"
              : isIncorrect
                ? "Not quite yet — let's work through it"
                : "Evaluated"}
        </span>
        {evaluation.score != null && evaluation.maxScore != null && (
          <span className="text-fg ml-auto shrink-0 font-mono text-sm font-medium tabular-nums">
            {evaluation.score}/{evaluation.maxScore} pts
          </span>
        )}
      </div>

      {evaluation.percentage != null && (
        <div className="mb-3">
          <div className="bg-surface rounded-pill h-1.5 w-full overflow-hidden">
            <div
              className={`rounded-pill duration-slow ease-standard h-full transition-all ${barColor}`}
              style={{ width: `${Math.min(evaluation.percentage, 100)}%` }}
            />
          </div>
          <p className="text-fg-muted mt-1 font-mono text-xs tabular-nums">
            {evaluation.percentage}%
          </p>
        </div>
      )}

      {explanation && (
        <p className="text-fg-secondary mb-2 text-sm leading-relaxed">{explanation}</p>
      )}

      {evaluation.summary?.overallComment && (
        <p className="text-fg text-sm leading-relaxed">{evaluation.summary.overallComment}</p>
      )}

      {evaluation.strengths && evaluation.strengths.length > 0 && (
        <div className="mt-3">
          <p className="text-success flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> What you did well
          </p>
          <ul className="text-fg-secondary mt-1 list-disc pl-5 text-xs leading-relaxed">
            {evaluation.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
        <div className="mt-3">
          <p className="text-warning flex items-center gap-1.5 text-xs font-semibold">
            <Sprout className="h-3.5 w-3.5" aria-hidden /> Where to grow
          </p>
          <ul className="text-fg-secondary mt-1 list-disc pl-5 text-xs leading-relaxed">
            {evaluation.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.missingConcepts && evaluation.missingConcepts.length > 0 && (
        <div className="mt-3">
          <p className="text-fg-secondary flex items-center gap-1.5 text-xs font-semibold">
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> Worth revisiting
          </p>
          <ul className="text-fg-secondary mt-1 list-disc pl-5 text-xs leading-relaxed">
            {evaluation.missingConcepts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
