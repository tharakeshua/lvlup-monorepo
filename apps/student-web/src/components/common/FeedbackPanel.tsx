import type { UnifiedEvaluationResult } from "@levelup/shared-types";
import { CheckCircle2, XCircle, AlertCircle, Minus } from "lucide-react";

interface FeedbackPanelProps {
  evaluation: UnifiedEvaluationResult;
  explanation?: string;
}

export default function FeedbackPanel({ evaluation, explanation }: FeedbackPanelProps) {
  // correctness is a number: 1 = correct, 0 = incorrect, 0 < x < 1 = partial
  const isCorrect = evaluation.correctness >= 1;
  const isPartial = evaluation.correctness > 0 && evaluation.correctness < 1;
  const isIncorrect = evaluation.correctness === 0;

  return (
    <div
      aria-live="polite"
      className={`mt-4 rounded-lg border p-4 ${
        isCorrect
          ? "border-emerald-200 bg-emerald-500/10 dark:border-emerald-800"
          : isPartial
            ? "border-yellow-200 bg-yellow-500/10 dark:border-yellow-800"
            : isIncorrect
              ? "border-destructive/30 bg-destructive/10"
              : "border-border bg-muted/50"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {isCorrect && <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
        {isPartial && <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />}
        {isIncorrect && <XCircle className="text-destructive h-5 w-5" />}
        {!evaluation.correctness && <Minus className="text-muted-foreground h-5 w-5" />}
        <span className="font-semibold">
          {isCorrect
            ? "Correct!"
            : isPartial
              ? "Partially Correct"
              : isIncorrect
                ? "Incorrect"
                : "Evaluated"}
        </span>
        {evaluation.score != null && evaluation.maxScore != null && (
          <span className="ml-auto text-sm font-medium">
            {evaluation.score}/{evaluation.maxScore} points
          </span>
        )}
      </div>

      {evaluation.percentage != null && (
        <div className="mb-2">
          <div className="bg-muted h-2 w-full rounded-full">
            <div
              className={`h-2 rounded-full ${
                isCorrect ? "bg-emerald-500" : isPartial ? "bg-yellow-500" : "bg-destructive"
              }`}
              style={{ width: `${Math.min(evaluation.percentage, 100)}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{evaluation.percentage}%</p>
        </div>
      )}

      {explanation && <p className="text-muted-foreground mb-2 text-sm">{explanation}</p>}

      {evaluation.summary?.overallComment && (
        <p className="text-sm">{evaluation.summary.overallComment}</p>
      )}

      {evaluation.strengths && evaluation.strengths.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Strengths:</p>
          <ul className="list-disc pl-4 text-xs text-emerald-700 dark:text-emerald-400">
            {evaluation.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
        <div className="mt-2">
          <p className="text-destructive text-xs font-medium">Areas for improvement:</p>
          <ul className="text-destructive list-disc pl-4 text-xs">
            {evaluation.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.missingConcepts && evaluation.missingConcepts.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Missing concepts:
          </p>
          <ul className="list-disc pl-4 text-xs text-amber-700 dark:text-amber-400">
            {evaluation.missingConcepts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
