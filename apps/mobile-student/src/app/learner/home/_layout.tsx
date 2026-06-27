import { Stack } from "expo-router";

/** Home tab stack — sub-routes push here and keep the tab bar. */
export default function HomeStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
