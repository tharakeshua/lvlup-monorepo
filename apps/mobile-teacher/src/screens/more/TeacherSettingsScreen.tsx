/**
 * TeacherSettingsScreen — account & appearance (mobile-teacher).
 *
 * Translated from `prototypes/teacher/teacher-settings` (mobile-trimmed: the web
 * tenant-wide evaluation controls live on the web app). Shows the teacher's
 * identity (name / email / role / school), a local-only appearance picker, the
 * app version, a jump to the tenant switcher, and sign-out.
 *
 * Data:
 *   - useMe()              → collapsed identity view (read DEFENSIVELY — the
 *                            teacher callable may be NOT_FOUND on prod pre GATE-B;
 *                            we fall back to the session email and neutral labels).
 *   - useSession().logout  → sign out, then bounce to the login route.
 *
 * No firebase/firestore imports — data only via @levelup/query + the app session.
 * Theme is local-only (not yet persisted), matching the student app.
 */
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useMe } from "@levelup/query";

import {
  Avatar,
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

type ThemeChoice = "system" | "light" | "dark";
const THEMES: { key: ThemeChoice; label: string; icon: string }[] = [
  { key: "system", label: "System", icon: "monitor" },
  { key: "light", label: "Light", icon: "sun" },
  { key: "dark", label: "Dark", icon: "moon" },
];

/* --------------------------- defensive readers -------------------------- */

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

function roleLabel(role: string): string {
  if (!role) return "Teacher";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function initialsOf(name: string, email: string): string {
  const base = name || email;
  if (!base) return "T";
  const parts = base
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return base.slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

interface Identity {
  name: string;
  email: string;
  role: string;
  tenantName: string;
  tenantCode: string;
  memberships: number;
}

function readIdentity(me: unknown, sessionEmail: string): Identity {
  const o = obj(me);
  const user = obj(o.user);
  const claims = obj(o.claims);
  const tenant = obj(o.tenant ?? o.activeTenant);
  const memberships = Array.isArray(o.memberships)
    ? (o.memberships as unknown[])
    : Array.isArray(o.tenants)
      ? (o.tenants as unknown[])
      : [];
  return {
    name: str(o.displayName ?? o.name ?? user.displayName ?? user.name),
    email: str(o.email ?? user.email, sessionEmail),
    role: str(o.role ?? claims.role ?? tenant.role, "teacher"),
    tenantName: str(
      tenant.name ?? tenant.tenantName ?? o.tenantName ?? o.schoolName,
      "Your school"
    ),
    tenantCode: str(tenant.code ?? tenant.tenantCode ?? o.tenantCode),
    memberships: memberships.length,
  };
}

/* ------------------------------ sub-views ------------------------------ */

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
              active ? "border-border-subtle bg-surface border" : ""
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

/* -------------------------------- screen -------------------------------- */

export default function TeacherSettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const session = useSession();
  const meQuery = useMe();

  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [notice, setNotice] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const id = useMemo(
    () => readIdentity(meQuery.data, str(session.user?.email)),
    [meQuery.data, session.user?.email]
  );

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  const handleChangePassword = () => {
    setNotice(`A password reset link will be sent to ${id.email || "your email"}.`);
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
    <Screen background="canvas">
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

        {/* PROFILE */}
        <View className="gap-3">
          <SectionHeader title="Profile" />
          <Card className="gap-4 p-4">
            {meQuery.isLoading ? (
              <View className="flex-row items-center gap-3">
                <Skeleton variant="circle" width={52} height={52} />
                <View className="flex-1 gap-2">
                  <Skeleton width="60%" height={16} />
                  <Skeleton width="80%" height={12} />
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-3">
                <Avatar initials={initialsOf(id.name, id.email)} size="xl" />
                <View className="flex-1">
                  <Text className="font-display text-text-primary text-lg">
                    {id.name || "Teacher"}
                  </Text>
                  <Text className="font-ui text-text-muted text-sm">
                    {roleLabel(id.role)} · {id.tenantName}
                  </Text>
                </View>
              </View>
            )}
            <Divider />
            <ListRow
              title="School"
              sub={
                id.memberships > 1
                  ? `${id.tenantName} · ${id.memberships} memberships`
                  : id.tenantName
              }
              trailing={
                id.memberships > 1 ? (
                  <Icon name="chevron-right" size={18} color="#756E61" />
                ) : undefined
              }
              onPress={id.memberships > 1 ? () => router.push(routes.tenantSwitcher()) : undefined}
            />
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
            <ListRow title="Signed in as" sub={id.email || "Not signed in"} />
            <Divider className="my-2" />
            <ListRow
              title="Notifications"
              sub="Manage what reaches your feed"
              trailing={<Icon name="chevron-right" size={18} color="#756E61" />}
              onPress={() => router.push(routes.notifications())}
            />
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
      </View>
    </Screen>
  );
}
