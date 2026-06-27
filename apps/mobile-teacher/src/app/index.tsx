/**
 * Entry gate.
 *
 * Resolves the session, then redirects: signed-in → the teacher Home tab;
 * signed-out → the full-screen auth gate. Env-gated autologin (see src/sdk/session)
 * signs in the test teacher in dev/sim builds.
 */
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { routes } from "../lib/routes";
import { useSession } from "../sdk/session";

export default function Index() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FBF8F3",
        }}
      >
        <ActivityIndicator color="#423A82" />
      </View>
    );
  }

  return <Redirect href={user ? routes.home() : routes.login()} />;
}
