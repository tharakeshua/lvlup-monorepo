import { Stack } from "expo-router";

/** Tests tab stack — sub-routes push here and keep the tab bar. */
export default function TestsStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
