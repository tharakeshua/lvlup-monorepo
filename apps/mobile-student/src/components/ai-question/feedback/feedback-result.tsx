/**
 * FeedbackResult (Surface G) — the payoff. Renders the FULL StoredEvaluation,
 * growth-framed: verdict + score, the drawing percentage bar with confidence /
 * mistake / passing-bar context, the key takeaway + overall comment, the scored
 * "How you'll be evaluated" strip that closes the loop with the up-front chips,
 * the scored rubric ladder, per-dimension qualitative feedback, the growth
 * sections, and the growth actions (Try again leads — W1 wires the behaviour).
 *
 * Everything is section-gated: an absent field simply doesn't render (the server
 * applies displaySettings), and a perfect score collapses to a compact card.
 *
 * Prop contract: {@link FeedbackResultProps} in ./types. W1 passes
 * `evaluation = progress.evaluation` (or a raw attempt result via
 * {@link toStoredEvaluation}) and the getEvaluationConfig student projection.
 */
import { Text, View } from "react-native";

import { cx } from "../../cx";
import { buildEvaluationView } from "./adapter";
import { ConfidenceBadge, MistakeChip, ReviewBanner } from "./chips";
import { DimensionFeedback } from "./dimension-feedback";
import { GrowthActions } from "./actions";
import { GrowthSections } from "./growth-sections";
import { KeyTakeaway, OverallComment } from "./takeaway";
import { PercentBar } from "./score-bar";
import { Reveal } from "./reveal";
import { RubricBreakdown } from "./rubric-breakdown";
import { ScoredHyeStrip } from "./scored-hye";
import { VerdictHeader } from "./verdict-header";
import { staggerDelay } from "./motion";
import { tone } from "./tone";
import type { FeedbackResultProps } from "./types";

export function FeedbackResult({
  evaluation,
  config,
  verdict,
  isBestAttempt = false,
  actions,
  className,
}: FeedbackResultProps) {
  const v = buildEvaluationView(evaluation, config, verdict);

  // Sequence the cascade only across the blocks that actually render.
  let step = 0;
  const next = () => staggerDelay(step++);

  const hasMeta = v.percentage != null || v.confidence != null || v.mistake != null;
  const passLabel =
    v.passed == null
      ? null
      : v.passed
        ? `Above the passing bar${v.passingPercentage != null ? ` (${Math.round(v.passingPercentage)}%)` : ""}`
        : `Below the passing bar${v.passingPercentage != null ? ` (${Math.round(v.passingPercentage)}%)` : ""}`;

  return (
    <View accessibilityLiveRegion="polite" className={cx("gap-4", className)}>
      <Reveal delay={0}>
        <VerdictHeader
          verdict={v.verdict}
          score={v.score}
          maxScore={v.maxScore}
          isBestAttempt={isBestAttempt}
        />
      </Reveal>

      {hasMeta ? (
        <Reveal delay={next()}>
          <View className="gap-2">
            {v.percentage != null ? (
              <PercentBar
                percentage={v.percentage}
                correct={v.verdict === "correct"}
                passingPercentage={v.passingPercentage}
              />
            ) : null}
            <View className="flex-row flex-wrap items-center gap-2">
              {v.confidence ? <ConfidenceBadge level={v.confidence} /> : null}
              {v.mistake ? <MistakeChip label={v.mistake} /> : null}
              {v.percentage != null ? (
                <Text className="text-text-muted font-mono text-xs">
                  {Math.round(v.percentage)}%
                </Text>
              ) : null}
            </View>
            {passLabel ? (
              <Text
                style={{ color: v.passed ? tone.success : tone.warning }}
                className="font-ui text-2xs font-medium"
              >
                {passLabel}
              </Text>
            ) : null}
          </View>
        </Reveal>
      ) : null}

      {v.keyTakeaway ? (
        <Reveal delay={next()}>
          <KeyTakeaway text={v.keyTakeaway} />
        </Reveal>
      ) : null}

      {v.overallComment ? (
        <Reveal delay={next()}>
          <OverallComment text={v.overallComment} />
        </Reveal>
      ) : null}

      {v.scoredChips.length ? (
        <Reveal delay={next()}>
          <ScoredHyeStrip chips={v.scoredChips} />
        </Reveal>
      ) : null}

      {v.needsReview ? (
        <Reveal delay={next()}>
          <ReviewBanner />
        </Reveal>
      ) : null}

      {v.rubric.length ? (
        <Reveal delay={next()}>
          <RubricBreakdown rows={v.rubric} score={v.score} maxScore={v.maxScore} />
        </Reveal>
      ) : null}

      {v.dimensions.length ? (
        <Reveal delay={next()}>
          <DimensionFeedback groups={v.dimensions} />
        </Reveal>
      ) : null}

      <Reveal delay={next()}>
        <GrowthSections
          strengths={v.strengths}
          weaknesses={v.weaknesses}
          missingConcepts={v.missingConcepts}
        />
      </Reveal>

      <Reveal delay={next()}>
        <GrowthActions actions={actions} verdict={v.verdict} />
      </Reveal>
    </View>
  );
}
