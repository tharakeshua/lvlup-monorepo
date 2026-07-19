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
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Icon, TextField } from "../../components";
import { colors } from "../../theme";
import { routes } from "../../lib/routes";
import { useSession } from "../../sdk/session";

const SEED_EMAIL = "latha.krishnan@demo.levelup.academy";
const SEED_PASSWORD = "Demo@12345";

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
    return <Redirect href={routes.home()} />;
  }

  return (
    <SafeAreaView className="bg-canvas flex-1" edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <View className="relative flex-1 justify-center overflow-hidden px-6">
          <View className="border-brand-muted absolute -right-24 -top-20 h-72 w-72 rounded-full border" />
          <View className="border-marigold-200 absolute -bottom-32 -left-24 h-72 w-72 rounded-full border" />

          <View className="gap-7">
            <View className="gap-5">
              <View className="bg-brand h-12 w-12 items-center justify-center rounded-xl shadow-sm">
                <Text className="font-display text-text-on-accent text-2xl">L</Text>
              </View>
              <View className="gap-2">
                <Text className="font-ui text-brand tracking-caps text-2xs font-semibold uppercase">
                  Lyceum for teachers
                </Text>
                <Text className="font-display text-text-primary text-3xl leading-[42px]">
                  Your teaching studio, wherever you are.
                </Text>
                <Text className="font-ui text-text-secondary text-base leading-6">
                  Plan, teach, review, and understand every class from one calm workspace.
                </Text>
              </View>
            </View>

            <View className="border-border-subtle bg-surface gap-4 rounded-xl border p-5 shadow-sm">
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="teacher@school.com"
                leadingIcon="mail"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                leadingIcon="lock"
              />

              {error ? (
                <View className="flex-row items-center gap-2 rounded-lg border border-red-200 bg-red-200/40 p-3">
                  <Icon name="alert-circle" size={16} color={colors.error} />
                  <Text className="font-ui text-error flex-1 text-sm">{error}</Text>
                </View>
              ) : null}

              <Button block loading={busy} onPress={doLogin} trailingIcon="arrow-right">
                {busy ? "Opening your workspace…" : "Sign in"}
              </Button>
            </View>

            <View className="flex-row items-center justify-center gap-1.5">
              <Icon name="shield-check" size={13} color={colors.textMuted} />
              <Text className="font-ui text-text-muted text-xs">
                Secure access to your school workspace
              </Text>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
