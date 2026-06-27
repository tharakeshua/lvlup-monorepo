/**
 * MoreMenuScreen — TAB 5 "More" hub (mobile-teacher).
 *
 * A static menu surface: an identity header (name + role/tenant pill that opens
 * the tenant switcher) followed by grouped navigation rows linking to
 * Announcements, Notifications, Settings, and the Insights sub-screens, plus a
 * sign-out affordance. The only data it touches is the collapsed `me` view
 * (`useMe`) — read DEFENSIVELY (the teacher callable may be NOT_FOUND on prod
 * until GATE-B) — and the app session (email fallback + logout).
 *
 * No data read can hard-fail this screen: every field defaults, and a missing
 * `me` doc just renders the session email + a neutral role/tenant pill.
 */
import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useMe } from "@levelup/query";

import {
  Avatar,
  Card,
  Icon,
  ListRow,
  RoleTenantPill,
  Screen,
  SectionHeader,
} from "../../components";
import { routes } from "../../lib/routes";
import { useSession } from "../../sdk/session";

/* ----------------------------- defensive readers ----------------------------- */

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

/** Title-case a role token (e.g. "teacher" → "Teacher"). */
function roleLabel(role: string): string {
  if (!role) return "Teacher";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

/** Best-effort initials from a display name / email. */
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
  /** number of memberships → drives the "switchable" affordance */
  memberships: number;
}

/** Map the (unknown) `me` view + session onto a flat identity, all defensive. */
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

/* --------------------------------- menu model -------------------------------- */

interface MenuItem {
  key: string;
  icon: string;
  label: string;
  sub: string;
  go: () => void;
}

/* --------------------------------- screen ----------------------------------- */

export default function MoreMenuScreen(): React.JSX.Element {
  const router = useRouter();
  const session = useSession();
  const meQuery = useMe();
  const [signingOut, setSigningOut] = useState(false);

  const id = useMemo(
    () => readIdentity(meQuery.data, str(session.user?.email)),
    [meQuery.data, session.user?.email]
  );

  const onSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await session.logout();
      router.replace(routes.login());
    } catch {
      setSigningOut(false);
    }
  }, [session, router]);

  const communicate: MenuItem[] = [
    {
      key: "announcements",
      icon: "megaphone",
      label: "Announcements",
      sub: "Compose & publish to your classes",
      go: () => router.push(routes.announcements()),
    },
    {
      key: "notifications",
      icon: "bell",
      label: "Notifications",
      sub: "Grading, at-risk alerts & updates",
      go: () => router.push(routes.notifications()),
    },
  ];

  const insights: MenuItem[] = [
    {
      key: "class-insights",
      icon: "line-chart",
      label: "Class insights",
      sub: "Performance & learning analytics",
      go: () => router.push(routes.insights()),
    },
    {
      key: "at-risk",
      icon: "life-buoy",
      label: "At-risk students",
      sub: "Who needs attention right now",
      go: () => router.push(routes.atRisk()),
    },
  ];

  const account: MenuItem[] = [
    {
      key: "settings",
      icon: "settings",
      label: "Settings",
      sub: "Appearance, account & about",
      go: () => router.push(routes.settings()),
    },
    {
      key: "tenant",
      icon: "building-2",
      label: "Switch school",
      sub: id.memberships > 1 ? `${id.memberships} memberships` : id.tenantName,
      go: () => router.push(routes.tenantSwitcher()),
    },
  ];

  const renderGroup = (title: string, items: MenuItem[]) => (
    <View className="gap-2">
      <SectionHeader title={title} />
      <Card className="px-1 py-1">
        {items.map((m, i) => (
          <View key={m.key}>
            {i > 0 ? <View className="bg-border-subtle h-px" /> : null}
            <ListRow
              title={m.label}
              sub={m.sub}
              leading={
                <View
                  className="bg-brand-subtle items-center justify-center rounded-full"
                  style={{ width: 38, height: 38 }}
                >
                  <Icon name={m.icon} size={18} color="#423A82" />
                </View>
              }
              trailing={<Icon name="chevron-right" size={18} color="#756E61" />}
              onPress={m.go}
            />
          </View>
        ))}
      </Card>
    </View>
  );

  return (
    <Screen background="canvas" contentClassName="gap-6 p-4 pb-12">
      {/* identity header */}
      <View className="gap-4 pt-2">
        <View className="flex-row items-center gap-3">
          <Avatar initials={initialsOf(id.name, id.email)} size="lg" />
          <View className="flex-1">
            <Text className="font-display text-text-primary text-2xl">
              {id.name || "Welcome back"}
            </Text>
            {id.email ? <Text className="font-ui text-text-muted text-sm">{id.email}</Text> : null}
          </View>
        </View>
        <RoleTenantPill
          tenant={id.tenantName}
          role={roleLabel(id.role)}
          code={id.tenantCode || id.tenantName.slice(0, 2).toUpperCase()}
          switchable={id.memberships > 1}
          onPress={() => router.push(routes.tenantSwitcher())}
        />
      </View>

      {renderGroup("Communicate", communicate)}
      {renderGroup("Insights", insights)}
      {renderGroup("Account", account)}

      {/* sign out */}
      <Card className="px-1 py-1">
        <ListRow
          title={
            <Text className="font-ui text-error font-semibold">
              {signingOut ? "Signing out…" : "Log out"}
            </Text>
          }
          leading={
            <View
              className="bg-surface-sunken items-center justify-center rounded-full"
              style={{ width: 38, height: 38 }}
            >
              <Icon name="log-out" size={18} color="#B42318" />
            </View>
          }
          chevron={false}
          onPress={signingOut ? undefined : onSignOut}
        />
      </Card>

      <Text className="text-2xs text-text-muted px-1 text-center font-mono">
        Lyceum for Teachers · v0.1.0
      </Text>
    </Screen>
  );
}
