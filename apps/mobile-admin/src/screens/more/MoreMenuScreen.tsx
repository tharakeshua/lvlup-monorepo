/**
 * MoreMenuScreen — the "More" tab landing.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/* (sidebar "Configuration"
 *         group + account block) collapsed into a mobile menu list.
 * Route:  /admin/more
 * Data:   useMe() for the account header (admin identity callable — soft-misses to
 *         the live session snapshot until SDK-coord deploys it, per query-status),
 *         plus a static nav menu to the rest of the More section + root modals.
 *
 * Self-contained: navigates via expo-router + ../../lib/routes. The shell mounts
 * this default export under the More tab.
 */
import { useMemo } from "react";
import { Alert as RNAlert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMe } from "@levelup/query";

import {
  Avatar,
  Badge,
  Card,
  Divider,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";
import { useSession } from "../../sdk/session";
import { pickStr } from "./_shared";

type MenuItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  href: ReturnType<(typeof routes)[keyof typeof routes]>;
};

const COMMS: MenuItem[] = [
  {
    key: "announcements",
    title: "Announcements",
    subtitle: "Broadcast notices to your academy",
    icon: "megaphone",
    href: routes.announcements(),
  },
  {
    key: "notifications",
    title: "Notifications",
    subtitle: "Updates addressed to you",
    icon: "bell",
    href: routes.notifications(),
  },
];

const CONFIG: MenuItem[] = [
  {
    key: "settings",
    title: "Tenant settings",
    subtitle: "School info, branding & features",
    icon: "settings",
    href: routes.settings(),
  },
  {
    key: "data-export",
    title: "Data export",
    subtitle: "Export records as JSON or CSV",
    icon: "download",
    href: routes.dataExport(),
  },
  {
    key: "onboarding",
    title: "Onboarding wizard",
    subtitle: "Set up your academy step by step",
    icon: "sparkles",
    href: routes.onboarding(),
  },
];

function initialsOf(name: string | undefined, email: string | undefined): string {
  const base = name ?? email ?? "";
  const parts = base
    .replace(/@.*$/, "")
    .split(/[ ._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "AD";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return (first + second).toUpperCase() || "AD";
}

export default function MoreMenuScreen() {
  const router = useRouter();
  const { user, logout } = useSession();

  // useMe soft-misses to empty until the identity callable deploys; fall back
  // to the live auth snapshot so the header is always populated.
  const meQ = useMe();
  const me = meQ.data;

  const displayName = useMemo(
    () => pickStr(me, "displayName", "name", "fullName") ?? user?.displayName ?? undefined,
    [me, user?.displayName]
  );
  const email = useMemo(() => pickStr(me, "email") ?? user?.email ?? undefined, [me, user?.email]);
  const roleLabel = pickStr(me, "roleLabel", "role") ?? "Tenant Admin";

  const onSignOut = () => {
    RNAlert.alert("Sign out", "Sign out of this admin account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <TopBar title="More" subtitle="Settings & communications" />

      {/* Account header */}
      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <Avatar initials={initialsOf(displayName, email)} size="lg" />
          <View className="flex-1">
            <Text className="text-text-primary text-base font-bold" numberOfLines={1}>
              {displayName ?? email ?? "Tenant Admin"}
            </Text>
            {email ? (
              <Text className="text-text-muted text-xs" numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
          <Badge variant="brand" icon={<Icon name="shield" size={12} />}>
            {roleLabel}
          </Badge>
        </View>
        <Divider />
        <ListRow
          title="Switch tenant"
          subtitle="Change the active academy or role"
          leading={<Icon name="repeat" size={18} />}
          onPress={() => router.push(routes.switcher())}
        />
      </Card>

      {/* Communications */}
      <Card className="gap-1">
        <SectionHeader title="Communications" />
        {COMMS.map((m) => (
          <ListRow
            key={m.key}
            title={m.title}
            subtitle={m.subtitle}
            leading={<Icon name={m.icon} size={18} />}
            onPress={() => router.push(m.href)}
          />
        ))}
      </Card>

      {/* Configuration */}
      <Card className="gap-1">
        <SectionHeader title="Configuration" />
        {CONFIG.map((m) => (
          <ListRow
            key={m.key}
            title={m.title}
            subtitle={m.subtitle}
            leading={<Icon name={m.icon} size={18} />}
            onPress={() => router.push(m.href)}
          />
        ))}
      </Card>

      {/* Account actions */}
      <Card className="gap-1">
        <ListRow
          title="Sign out"
          subtitle={email ?? undefined}
          leading={<Icon name="log-out" size={18} />}
          chevron={false}
          onPress={onSignOut}
        />
      </Card>

      <Text className="text-2xs text-text-muted px-1 pb-2">
        Signed in to {pickStr(me, "tenantName", "tenant") ?? "this academy"}. Some sections require
        the admin identity service, which lights up as it deploys.
      </Text>
    </Screen>
  );
}
