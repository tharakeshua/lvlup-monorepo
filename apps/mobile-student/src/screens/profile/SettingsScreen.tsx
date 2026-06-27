/**
 * Settings — Profile lane (mobile-student).
 *
 * Lets the learner tune how Lyceum reaches them (notification channels +
 * categories), pick an appearance (placeholder, local-only for now), see their
 * account email, read the app version, and sign out.
 *
 * Data:
 *  - `useNotificationPreferences()`      → read current toggles (read defensively;
 *                                          server fills defaults — we also default
 *                                          locally so the screen still renders if
 *                                          the read errors).
 *  - `useSaveNotificationPreferences()`  → best-effort save on every toggle change
 *                                          (NEVER optimistic — a settings round-trip).
 *  - `useSession().logout()`             → sign out, then bounce to the login route.
 *
 * No firebase/firestore imports — data only via @levelup/query + the app session.
 * Loading → Skeleton rows. Error is tolerated: settings still render with defaults.
 */
import { useEffect, useRef, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useNotificationPreferences, useSaveNotificationPreferences } from "@levelup/query";

import {
  Button,
  Card,
  Divider,
  Icon,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  Skeleton,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";
import { useSession } from "../../sdk/session";

/* ------------------------------ constants ------------------------------ */

const APP_VERSION = "0.1.0";

// Lyceum token hexes for the RN <Switch> (native control, no className).
const SWITCH = {
  trackOn: "#423A82", // brand indigo
  trackOff: "#E4DFD2", // border-subtle / paper
  thumb: "#FFFFFF",
} as const;

/* ------------------------- defensive readers --------------------------- */

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

/* ---------------------------- prefs model ------------------------------ */

type PrefKey = "push" | "email" | "examResults" | "achievements" | "leaderboard" | "streak";

type Prefs = Record<PrefKey, boolean>;

const DEFAULT_PREFS: Prefs = {
  push: false,
  email: true,
  examResults: true,
  achievements: true,
  leaderboard: false,
  streak: true,
};

/** Map an (unknown) server prefs object onto our local model, defensively. */
function readPrefs(data: unknown): Prefs {
  const o = obj(data);
  return {
    push: bool(o.push, DEFAULT_PREFS.push),
    email: bool(o.email, DEFAULT_PREFS.email),
    examResults: bool(o.examResults, DEFAULT_PREFS.examResults),
    achievements: bool(o.achievements, DEFAULT_PREFS.achievements),
    leaderboard: bool(o.leaderboard, DEFAULT_PREFS.leaderboard),
    streak: bool(o.streak, DEFAULT_PREFS.streak),
  };
}

const CHANNELS: { key: PrefKey; label: string; desc: string }[] = [
  { key: "push", label: "Push notifications", desc: "A nudge right on your device." },
  { key: "email", label: "Email", desc: "Get updates in your inbox." },
];

const CATEGORIES: { key: PrefKey; label: string; desc: string }[] = [
  { key: "examResults", label: "Exam results", desc: "When your results are ready to view." },
  { key: "achievements", label: "Achievements", desc: "When you unlock a new badge." },
  { key: "leaderboard", label: "Leaderboard", desc: "When your rank moves." },
  { key: "streak", label: "Streak reminders", desc: "A friendly daily nudge to keep it alive." },
];

const THEMES: { key: ThemeChoice; label: string; icon: string }[] = [
  { key: "system", label: "System", icon: "monitor" },
  { key: "light", label: "Light", icon: "sun" },
  { key: "dark", label: "Dark", icon: "moon" },
];

type ThemeChoice = "system" | "light" | "dark";

/* ------------------------------ sub-views ------------------------------ */

/** A labelled preference row carrying a controlled RN Switch. */
function ToggleRow({
  label,
  desc,
  value,
  disabled,
  onToggle,
}: {
  label: string;
  desc: string;
  value: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <ListRow
      title={label}
      sub={desc}
      trailing={
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={onToggle}
          trackColor={{ true: SWITCH.trackOn, false: SWITCH.trackOff }}
          thumbColor={SWITCH.thumb}
          ios_backgroundColor={SWITCH.trackOff}
          accessibilityLabel={`${label} — ${value ? "on" : "off"}`}
        />
      }
    />
  );
}

/** Local-only appearance segmented control (placeholder — not yet persisted). */
function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeChoice;
  onChange: (t: ThemeChoice) => void;
}) {
  return (
    <View className="bg-surface-sunken flex-row gap-2 rounded-lg p-1">
      {THEMES.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-md px-2 py-2 ${
              active ? "bg-surface border-border-subtle border" : ""
            }`}
          >
            <Icon name={t.icon} size={15} color={active ? "#423A82" : "#756E61"} />
            <Text
              className={`font-ui text-sm ${
                active ? "text-text-primary font-semibold" : "text-text-secondary"
              }`}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View className="gap-6">
      {[0, 1, 2].map((s) => (
        <Card key={s} className="gap-4 p-4">
          <Skeleton width={140} height={18} />
          {[0, 1].map((r) => (
            <View key={r} className="flex-row items-center justify-between">
              <View className="gap-2">
                <Skeleton width={160} height={14} />
                <Skeleton width={220} height={10} />
              </View>
              <Skeleton width={44} height={26} variant="rect" />
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

/* ------------------------------- screen -------------------------------- */

export default function SettingsScreen() {
  const router = useRouter();
  const session = useSession();

  const prefsQuery = useNotificationPreferences();
  const savePrefs = useSaveNotificationPreferences();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [notice, setNotice] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Hydrate local toggle state from the server read once (don't clobber edits).
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    if (prefsQuery.data !== undefined) {
      setPrefs(readPrefs(prefsQuery.data));
      hydrated.current = true;
    }
  }, [prefsQuery.data]);

  // Auto-dismiss the transient notice banner.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(id);
  }, [notice]);

  const email = str(session.user?.email, "Not signed in");

  const handleToggle = (key: PrefKey) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Best-effort save; never optimistic on the cache (settings round-trip).
      savePrefs.mutate(next, {
        onError: () => setNotice("Couldn't save — we'll retry next change."),
      });
      return next;
    });
  };

  const handleChangePassword = () => {
    setNotice(`A password reset link will be sent to ${email}.`);
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await session.logout();
      router.replace(routes.login());
    } catch {
      setSigningOut(false);
      setNotice("Couldn't sign out — please try again.");
    }
  };

  return (
    <Screen>
      <TopBar
        title="Settings"
        left={
          <IconButton
            icon="arrow-left"
            label="Back"
            variant="ghost"
            onPress={() => router.back()}
          />
        }
      />

      <View className="gap-6 p-4 pb-12">
        {notice ? (
          <Card className="border-border-subtle bg-brand-subtle flex-row items-center gap-2 border p-3">
            <Icon name="info" size={16} color="#423A82" />
            <Text className="font-ui text-text-secondary flex-1 text-sm">{notice}</Text>
          </Card>
        ) : null}

        {prefsQuery.isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* NOTIFICATIONS */}
            <View className="gap-3">
              <SectionHeader title="Notifications" />
              <Card className="p-4">
                <Text className="font-ui text-text-muted mb-1 text-xs font-semibold uppercase tracking-wide">
                  Channels
                </Text>
                {CHANNELS.map((c) => (
                  <ToggleRow
                    key={c.key}
                    label={c.label}
                    desc={c.desc}
                    value={prefs[c.key]}
                    onToggle={() => handleToggle(c.key)}
                  />
                ))}

                <Divider className="my-3" />

                <Text className="font-ui text-text-muted mb-1 text-xs font-semibold uppercase tracking-wide">
                  What to notify me about
                </Text>
                {CATEGORIES.map((c) => (
                  <ToggleRow
                    key={c.key}
                    label={c.label}
                    desc={c.desc}
                    value={prefs[c.key]}
                    onToggle={() => handleToggle(c.key)}
                  />
                ))}
              </Card>
            </View>

            {/* APPEARANCE */}
            <View className="gap-3">
              <SectionHeader title="Appearance" />
              <Card className="gap-3 p-4">
                <View>
                  <Text className="font-ui text-text-primary text-base font-semibold">Theme</Text>
                  <Text className="font-ui text-text-muted text-xs">
                    Follows your device by default. Appearance is a placeholder — not saved yet.
                  </Text>
                </View>
                <ThemePicker value={theme} onChange={setTheme} />
              </Card>
            </View>

            {/* ACCOUNT */}
            <View className="gap-3">
              <SectionHeader title="Account" />
              <Card className="p-4">
                <ListRow title="Signed in as" sub={email} />
                <Divider className="my-2" />
                <ListRow
                  title="Change password"
                  sub="We'll email you a reset link."
                  trailing={<Icon name="chevron-right" size={18} color="#756E61" />}
                  onPress={handleChangePassword}
                />
              </Card>
            </View>

            {/* ABOUT */}
            <View className="gap-3">
              <SectionHeader title="About" />
              <Card className="p-4">
                <ListRow
                  title="Version"
                  trailing={
                    <Text className="text-text-secondary font-mono text-sm">{APP_VERSION}</Text>
                  }
                />
              </Card>
            </View>

            {/* SIGN OUT */}
            <Button
              variant="danger"
              block
              leadingIcon="log-out"
              loading={signingOut}
              disabled={signingOut}
              onPress={handleLogout}
            >
              {signingOut ? "Signing out…" : "Log out"}
            </Button>
          </>
        )}
      </View>
    </Screen>
  );
}
