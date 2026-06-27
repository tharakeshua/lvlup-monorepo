import { Stack } from "expo-router";

/** Learn tab stack — sub-routes push here and keep the tab bar. */
export default function LearnStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
