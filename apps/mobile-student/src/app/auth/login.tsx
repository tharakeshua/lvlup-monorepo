/**
 * Learner authentication (full-screen gate, no tab bar).
 *
 * Owned by the shell lane: auth is the entry seam, not a tab screen, and it wires
 * directly to the session context (the one client auth handle). On success the
 * session snapshot flips and we redirect into the Home tab.
 *
 * GATE-0 support: prefilled with the seeded student and an opt-in auto-login
 * (`EXPO_PUBLIC_SMOKE_AUTOLOGIN=true`) so the prod proof can capture the flow
 * with no manual tap.
 */
import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { routes } from "../../lib/routes";
import { useSession } from "../../sdk/session";

const SEED_EMAIL = "nandini@learner.dev";
const SEED_PASSWORD = "Student@123";

const AUTO_LOGIN = (process.env.EXPO_PUBLIC_SMOKE_AUTOLOGIN ?? "").toLowerCase() === "true";

export default function LoginScreen() {
  const { user, loading, error, login, clearError } = useSession();
  const [email, setEmail] = useState(SEED_EMAIL);
  const [password, setPassword] = useState(SEED_PASSWORD);
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    setBusy(true);
    clearError();
    try {
      await login(email.trim(), password);
    } catch {
      // surfaced via session.error
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (AUTO_LOGIN && !loading && !user && !busy) {
      void doLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  // Already authenticated → leave the gate.
  if (!loading && user) {
    return <Redirect href={routes.spaces()} />;
  }

  return (
    <SafeAreaView className="bg-canvas flex-1" edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#423A82" />
        </View>
      ) : (
        <View className="flex-1 justify-center gap-6 px-8">
          <View className="gap-2">
            <Text className="font-display text-text-primary text-3xl font-bold">LevelUp</Text>
            <Text className="text-text-muted text-base">Sign in to continue learning.</Text>
          </View>

          <View className="gap-3">
            <View className="gap-1.5">
              <Text className="text-text-muted text-xs font-semibold uppercase tracking-wide">
                Email
              </Text>
              <TextInput
                className="border-border-strong bg-surface text-text-primary rounded-md border px-4 py-3 text-base"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#9A9486"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View className="gap-1.5">
              <Text className="text-text-muted text-xs font-semibold uppercase tracking-wide">
                Password
              </Text>
              <TextInput
                className="border-border-strong bg-surface text-text-primary rounded-md border px-4 py-3 text-base"
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#9A9486"
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          {error ? <Text className="text-error text-sm">{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            className="bg-brand items-center rounded-md px-6 py-3.5 active:opacity-90"
            disabled={busy}
            onPress={doLogin}
          >
            <Text className="text-text-on-accent text-base font-semibold">
              {busy ? "Signing in…" : "Sign in"}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
