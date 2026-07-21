/**
 * Key takeaway — the one-line headline insight (summary.keyTakeaway), visually
 * distinct with a spark left-rule. The overall comment renders as a plain
 * paragraph beneath. Both hide when absent.
 */
import { Text, View } from "react-native";

import { tone } from "./tone";

export function KeyTakeaway({ text }: { text: string }) {
  return (
    <View
      style={{ borderLeftWidth: 3, borderLeftColor: tone.spark, backgroundColor: tone.sparkSubtle }}
      className="rounded-r-md py-3 pl-4 pr-4"
    >
      <Text
        style={{ color: tone.sparkHover, letterSpacing: 0.6 }}
        className="text-2xs font-mono uppercase"
      >
        Key takeaway
      </Text>
      <Text className="font-display text-text-primary mt-1 text-base leading-6">{text}</Text>
    </View>
  );
}

export function OverallComment({ text }: { text: string }) {
  return <Text className="font-ui text-text-primary text-sm leading-6">{text}</Text>;
}
