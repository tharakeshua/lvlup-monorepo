/**
 * Dev preview for Surface G — renders <FeedbackResult> against the real-shaped
 * fixtures so the card can be eyeballed / screenshotted without logging in and
 * grading a live attempt. Not part of any user flow; reached only via the
 * /dev/feedback-preview route. `state` selects one case or shows them all.
 */
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeedbackResult } from "./feedback-result";
import {
  CORRECT_EVALUATION,
  INCORRECT_EVALUATION,
  LEGACY_STRING_SUMMARY_EVALUATION,
  MOON_CONFIG,
  PARTIAL_EVALUATION,
} from "./fixtures";
import type { FeedbackActions, StoredEvaluationInput, EvaluationConfigInput } from "./types";

const noop = () => {};
const ACTIONS: FeedbackActions = {
  onTryAgain: noop,
  onDiscuss: noop,
  onHistory: noop,
  onNext: noop,
};

type Case = {
  key: string;
  label: string;
  evaluation: StoredEvaluationInput;
  config?: EvaluationConfigInput | null;
  isBest?: boolean;
  actions?: FeedbackActions;
};

const CASES: Case[] = [
  {
    key: "partial",
    label: "G1 · Partial credit (full payload)",
    evaluation: PARTIAL_EVALUATION,
    config: MOON_CONFIG,
    actions: ACTIONS,
  },
  {
    key: "correct",
    label: "G2 · Got it! (correct, compact)",
    evaluation: CORRECT_EVALUATION,
    config: MOON_CONFIG,
    isBest: true,
    actions: { onNext: noop },
  },
  {
    key: "incorrect",
    label: "G3 · Not quite yet + low confidence",
    evaluation: INCORRECT_EVALUATION,
    config: MOON_CONFIG,
    actions: { onTryAgain: noop, onDiscuss: noop },
  },
  {
    key: "legacy",
    label: "Legacy · summary-as-string",
    evaluation: LEGACY_STRING_SUMMARY_EVALUATION,
    config: null,
    actions: ACTIONS,
  },
];

function CaseFrame({ item }: { item: Case }) {
  return (
    <View className="gap-3">
      <Text className="text-text-muted font-mono text-xs uppercase" style={{ letterSpacing: 0.6 }}>
        {item.label}
      </Text>
      <FeedbackResult
        evaluation={item.evaluation}
        config={item.config}
        isBestAttempt={item.isBest}
        actions={item.actions}
      />
    </View>
  );
}

export function FeedbackPreview({ state = "all" }: { state?: string }) {
  const insets = useSafeAreaInsets();
  const shown = state === "all" ? CASES : CASES.filter((c) => c.key === state);
  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 48,
        paddingHorizontal: 16,
        gap: 40,
      }}
    >
      <Text className="font-display text-text-primary text-2xl">Surface G — Feedback result</Text>
      {shown.map((item) => (
        <CaseFrame key={item.key} item={item} />
      ))}
    </ScrollView>
  );
}
