import { Stack } from "expo-router";

/** B2C store flow: browse → space detail → checkout (modal). Root-level (no tab bar). */
export default function StoreStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[spaceId]" />
      <Stack.Screen name="checkout" options={{ presentation: "modal" }} />
    </Stack>
  );
}
