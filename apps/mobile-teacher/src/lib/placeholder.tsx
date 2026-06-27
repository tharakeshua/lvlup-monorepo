/**
 * Screen placeholder factory (shell lane).
 *
 * The shell's route tree is authored ahead of (and in parallel with) the screen
 * lanes. Until a lane lands its real screen module, the corresponding route
 * mounts one of these placeholders — so the whole navigation shell (tabs, stacks,
 * modals, full-screen runner) is mountable and walkable on its own. Each
 * placeholder is wired to the real router context, so navigation between them
 * works exactly as it will with the real screens; only the body is a stub.
 *
 * Swap-in: replace the matching line in `src/lib/screens.tsx` with a re-export of
 * the real screen module — a one-line change per screen, no route-file edits.
 */
import { useRouter } from "expo-router";
import { Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function makePlaceholder(title: string, route: string, lane?: string) {
  function ScreenPlaceholder() {
    const router = useRouter();
    return (
      <SafeAreaView className="bg-canvas flex-1" edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <View className="rounded-pill bg-brand-subtle px-3 py-1">
            <Text className="text-2xs text-brand font-semibold uppercase tracking-wide">
              {lane ? `awaiting ${lane}` : "screen pending"}
            </Text>
          </View>
          <Text className="text-text-primary text-2xl font-bold">{title}</Text>
          <Text className="text-text-muted text-sm">{route}</Text>
          <Text className="text-text-muted max-w-[260px] text-center text-xs">
            Navigation shell is live. This screen mounts here once its lane lands the real module.
          </Text>
          {router.canGoBack() ? (
            <Pressable
              accessibilityRole="button"
              className="border-border-strong mt-2 rounded-md border px-5 py-2.5"
              onPress={() => router.back()}
            >
              <Text className="text-text-secondary font-semibold">Back</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }
  ScreenPlaceholder.displayName = `Placeholder(${title})`;
  return ScreenPlaceholder;
}
