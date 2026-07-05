/**
 * Entry gate.
 *
 * Resolves the session, then redirects: signed-in → the learner Home tab;
 * signed-out → the full-screen auth gate. Keeps no UI of its own beyond a brief
 * spinner while the firebase auth handle reports its first snapshot.
 *
 * (This replaces the throwaway GATE-0 smoke screen; the same end-to-end proof —
 * sign in as the seeded student → `useSpaces` → DSA space — now runs through the
 * real auth gate → Home/Learn tabs.)
 */
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { routes } from "../lib/routes";
import { useSession } from "../sdk/session";

export default function Index() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <View className="bg-canvas flex-1 items-center justify-center">
        <ActivityIndicator color="#423A82" />
      </View>
    );
  }

  return <Redirect href={user ? routes.spaces() : routes.login()} />;
}
