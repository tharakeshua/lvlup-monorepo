import { Stack } from "expo-router";

/** Profile tab stack — sub-routes push here and keep the tab bar. */
export default function ProfileStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
