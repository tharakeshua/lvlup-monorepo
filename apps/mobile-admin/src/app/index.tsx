/**
 * Entry gate.
 *
 * Resolves the session, then redirects: signed-in → the admin Home tab;
 * signed-out → the full-screen auth gate. Keeps no UI of its own beyond a brief
 * spinner while the firebase auth handle reports its first snapshot.
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

  return <Redirect href={user ? routes.home() : routes.login()} />;
}
