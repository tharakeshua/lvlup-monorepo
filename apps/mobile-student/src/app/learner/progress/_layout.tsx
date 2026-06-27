import { Stack } from "expo-router";

/** Progress tab stack — sub-routes push here and keep the tab bar. */
export default function ProgressStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
