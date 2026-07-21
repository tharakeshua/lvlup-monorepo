/**
 * Growth sections — "What you did well" (strengths), "Where to grow"
 * (weaknesses), and "Worth revisiting" (missingConcepts), merged into one warm
 * growth card with a per-item icon. When only strengths are present the card
 * reads purely as praise ("What you did well"); otherwise it frames forward.
 */
import { Text, View } from "react-native";

import { Icon } from "../../Icon";
import { FeedbackCard } from "./section";
import { tone } from "./tone";

interface GrowthEntry {
  text: string;
  icon: string;
  color: string;
}

export function GrowthSections({
  strengths,
  weaknesses,
  missingConcepts,
}: {
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
}) {
  const entries: GrowthEntry[] = [
    ...strengths.map((t) => ({ text: t, icon: "check", color: tone.success })),
    ...weaknesses.map((t) => ({ text: t, icon: "move-up-right", color: tone.warning })),
    ...missingConcepts.map((t) => ({
      text: `Worth revisiting: ${t}`,
      icon: "bookmark",
      color: tone.brand,
    })),
  ];
  if (!entries.length) return null;
  const praiseOnly = weaknesses.length === 0 && missingConcepts.length === 0;
  return (
    <FeedbackCard icon="sprout" title={praiseOnly ? "What you did well" : "Growth"}>
      <View className="mt-1 gap-0.5">
        {entries.map((e, i) => (
          <View key={i} className="flex-row items-start gap-2 py-1.5">
            <View className="mt-0.5">
              <Icon name={e.icon} size={15} color={e.color} />
            </View>
            <Text className="font-ui text-text-primary flex-1 text-sm leading-5">{e.text}</Text>
          </View>
        ))}
      </View>
    </FeedbackCard>
  );
}
