/**
 * Dev-only preview for Surface H (attempt history) and Surface I (discuss chrome).
 * Not linked from any user flow — open at /dev/history-preview. Renders the kit
 * with deterministic fixtures so it can be screenshotted against the design card
 * `history-and-discuss.card.html` without a live backend/session.
 *
 * Owned by W5. The history views are the real components with fixture data; the
 * discuss block is a static render of the QuestionHelpSheet chrome (the live
 * sheet embeds W4's ConversationScaffold, shown here with static bubbles that
 * match W4's bubble language for a deterministic shot).
 */
import { ScrollView, View, Text } from "react-native";

import { Icon } from "../../Icon";
import { colors } from "../../../theme";
import { AttemptHistory } from "./AttemptHistory";
import { AttemptDetail } from "./AttemptDetail";
import { buildAttemptHistory, type ItemProgressEntryLike } from "./model";

const MULTI_ATTEMPT: ItemProgressEntryLike = {
  itemId: "item_moon_phases",
  attempts: [
    {
      attemptNumber: 1,
      answer: "The moon makes its own light and it runs out.",
      score: 2,
      maxScore: 10,
      timestamp: "2026-03-08T15:44:00.000Z",
      evaluation: {
        score: 2,
        maxScore: 10,
        correctness: 0.2,
        percentage: 20,
        summary: {
          keyTakeaway: "Phases are about sunlight and geometry, not the moon glowing.",
          overallComment:
            "The moon reflects sunlight — it doesn't make its own. Think about where the sun is relative to the moon and Earth.",
        },
        weaknesses: ["Says the moon produces light", "No mention of the sun's position"],
      },
    },
    {
      attemptNumber: 2,
      answer: "The sun lights the moon and we see different amounts as it orbits.",
      score: 5,
      maxScore: 10,
      timestamp: "2026-03-09T16:02:00.000Z",
      evaluation: {
        score: 5,
        maxScore: 10,
        correctness: 0.5,
        percentage: 50,
        summary: {
          keyTakeaway: "You've got the reflection idea — now connect it to what we see from Earth.",
          overallComment:
            "Good — sunlight is the key. Next, explain why the lit fraction we see changes as the moon orbits.",
        },
        strengths: ["Correctly identifies reflected sunlight"],
        weaknesses: ["Doesn't explain the viewing angle from Earth"],
      },
    },
    {
      attemptNumber: 3,
      answer:
        "The sun always lights half the moon. As the moon orbits Earth, we see different fractions of that lit half, which gives the phases.",
      score: 7,
      maxScore: 10,
      timestamp: "2026-03-10T09:41:00.000Z",
      evaluation: {
        score: 7,
        maxScore: 10,
        correctness: 0.7,
        percentage: 70,
        summary: {
          keyTakeaway: "Strong — sunlight + orbital viewing angle. Tighten the tidal-locking part.",
          overallComment:
            "You're close! The phases explanation is solid. Add why we always see the same face (tidal locking) to finish it.",
        },
        strengths: ["Sunlight lights half the moon", "Links phases to the orbital viewing angle"],
        missingConcepts: ["Tidal locking / one rotation per orbit"],
      },
    },
  ],
};

const DEGRADED_SINGLE: ItemProgressEntryLike = {
  itemId: "item_single",
  score: 8,
  maxScore: 10,
  correct: false,
  completed: true,
  updatedAt: "2026-03-10T09:41:00.000Z",
  evaluation: {
    score: 8,
    maxScore: 10,
    correctness: 0.8,
    percentage: 80,
    summary: {
      keyTakeaway: "Clear and mostly complete.",
      overallComment: "Nicely reasoned — just tighten the final step.",
    },
    strengths: ["Well structured"],
  },
};

const EMPTY: ItemProgressEntryLike = { itemId: "item_untouched" };

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-text-muted text-2xs tracking-caps font-mono uppercase">{label}</Text>
      <View className="border-border-subtle bg-canvas rounded-lg border p-4">{children}</View>
    </View>
  );
}

/** A static Surface-I discuss-chrome render (matches QuestionHelpSheet + W4 bubbles). */
function DiscussChromePreview() {
  return (
    <View className="bg-canvas gap-4 rounded-t-xl p-4">
      <View className="bg-border-strong h-1 w-10 self-center rounded-full" />
      <View className="flex-row items-center gap-2">
        <Icon name="message-circle" size={18} color={colors.brand} />
        <Text className="font-display text-text-primary flex-1 text-base font-semibold">
          Talk it through
        </Text>
        <View className="bg-sky-500/12 rounded-pill flex-row items-center gap-1 px-2.5 py-1">
          <Icon name="info" size={12} color={colors.info} />
          <Text className="font-ui text-2xs font-semibold" style={{ color: colors.info }}>
            Help — not your submission
          </Text>
        </View>
      </View>
      <View className="border-border-subtle flex-row items-center gap-2 border-b pb-3">
        <Text className="text-brand text-2xs tracking-caps font-mono uppercase">This question</Text>
        <Text className="font-display text-text-secondary flex-1 text-sm" numberOfLines={1}>
          Explain why the moon shows phases…
        </Text>
      </View>
      <View className="border-border-subtle bg-surface-sunken flex-row items-center gap-2 rounded-md border px-3 py-2">
        <Icon name="eye" size={15} color={colors.brand} />
        <Text className="font-ui text-text-secondary flex-1 text-xs leading-5">
          The tutor can see your current draft (58 words).
        </Text>
      </View>
      <View className="gap-2">
        <View className="border-border-subtle bg-surface max-w-[82%] self-start rounded-lg rounded-bl-sm border px-4 py-3">
          <Text className="font-ui text-text-primary text-sm leading-6">
            I can see you've explained the phases part. What's making the second half tricky?
          </Text>
        </View>
        <View className="bg-brand max-w-[82%] self-end rounded-lg rounded-br-sm px-4 py-3">
          <Text className="font-ui text-sm leading-6" style={{ color: colors.textOnAccent }}>
            I don't get how the moon can rotate but we still see one side.
          </Text>
        </View>
        <View className="border-border-subtle bg-surface max-w-[82%] self-start rounded-lg rounded-bl-sm border px-4 py-3">
          <Text className="font-ui text-text-primary text-sm leading-6">
            Try this: walk in a circle around a chair while always facing it. By the time you're
            back — how many times did your body turn?
          </Text>
        </View>
      </View>
      <View className="border-border-strong bg-surface flex-row items-center gap-2 rounded-lg border px-4 py-2">
        <Text className="font-ui text-text-muted flex-1 text-sm">
          Ask anything about this question…
        </Text>
        <View className="bg-brand h-8 w-8 items-center justify-center rounded-full">
          <Icon name="arrow-up" size={16} color={colors.textOnAccent} />
        </View>
      </View>
    </View>
  );
}

export function HistoryDiscussPreview() {
  const bestRow = buildAttemptHistory(MULTI_ATTEMPT).rows.find((r) => r.isBest) ?? null;
  return (
    <ScrollView className="bg-surface-sunken flex-1" contentContainerClassName="gap-6 p-4 pb-16">
      <Text className="font-display text-text-primary pt-2 text-xl">Surface H · I preview</Text>

      <Section label="H · Attempt history (improving trend)">
        <AttemptHistory
          entry={MULTI_ATTEMPT}
          promptText="Explain why the moon shows phases, and why we always…"
          onOpenAttempt={() => {}}
          onTryAgain={() => {}}
        />
      </Section>

      <Section label="H · Degraded (single best result — today's backend reality)">
        <AttemptHistory entry={DEGRADED_SINGLE} onTryAgain={() => {}} />
      </Section>

      <Section label="H · Empty (no attempts yet)">
        <AttemptHistory entry={EMPTY} />
      </Section>

      {bestRow ? (
        <Section label="H · Attempt detail (answer + feedback)">
          <AttemptDetail attempt={bestRow} />
        </Section>
      ) : null}

      <Section label="I · Discuss drawer chrome">
        <DiscussChromePreview />
      </Section>
    </ScrollView>
  );
}
