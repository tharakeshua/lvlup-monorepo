/**
 * Growth actions — the "keep going" affordances. Try again leads (owner-locked:
 * it pre-fills the student's prior answer to edit; W1 wires the behaviour behind
 * onTryAgain). Discuss / History / Next follow. Only actions with a handler
 * render, so incorrect verdicts lead with Try again while a perfect score can
 * show just Next.
 */
import { View } from "react-native";

import { Button } from "../../primitives";
import type { FeedbackActions, Verdict } from "./types";

export function GrowthActions({
  actions,
  verdict,
}: {
  actions?: FeedbackActions;
  verdict: Verdict;
}) {
  const a = actions ?? {};
  const showTryAgain = Boolean(a.onTryAgain) && verdict !== "correct";
  const hasSecondary = Boolean(a.onDiscuss || a.onHistory);
  if (!showTryAgain && !hasSecondary && !a.onNext) return null;
  return (
    <View className="gap-2">
      {showTryAgain ? (
        <Button variant="primary" size="lg" block leadingIcon="rotate-ccw" onPress={a.onTryAgain}>
          Try again — edit your answer
        </Button>
      ) : null}

      {hasSecondary ? (
        <View className="flex-row gap-2">
          {a.onDiscuss ? (
            <Button
              variant="secondary"
              leadingIcon="message-circle"
              className="flex-1"
              onPress={a.onDiscuss}
            >
              Discuss with tutor
            </Button>
          ) : null}
          {a.onHistory ? (
            <Button
              variant="ghost"
              leadingIcon="history"
              className={a.onDiscuss ? "flex-1" : "flex-1"}
              onPress={a.onHistory}
            >
              History
            </Button>
          ) : null}
        </View>
      ) : null}

      {a.onNext ? (
        <Button
          variant={showTryAgain || hasSecondary ? "ghost" : "primary"}
          size={showTryAgain || hasSecondary ? "md" : "lg"}
          block
          trailingIcon="arrow-right"
          onPress={a.onNext}
        >
          Next question
        </Button>
      ) : null}
    </View>
  );
}
