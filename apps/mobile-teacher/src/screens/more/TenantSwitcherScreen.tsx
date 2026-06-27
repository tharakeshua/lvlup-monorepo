/**
 * TenantSwitcherScreen — switch active school / membership (mobile-teacher).
 *
 * Translated from `prototypes/teacher/tenant-switcher` (the web Popover →
 * a full sheet-style screen on mobile). Lists every membership from the
 * collapsed `me` view; tapping a non-active one switches the active tenant
 * (server re-stamps claims + the hook clears the whole query cache). A
 * join-by-code card lets a teacher add a school they've been invited to.
 *
 * Data (ALL via `@levelup/query`):
 *   - useMe()           → memberships + active tenant (read DEFENSIVELY; the
 *                         teacher callable may be NOT_FOUND on prod pre GATE-B →
 *                         we show the empty/soft state, never a red screen).
 *   - useSwitchTenant() → switch active tenant (⚷ never optimistic; resets cache).
 *   - useJoinTenant()   → join a school by code (⚷; invalidates the `me` view).
 */
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useMe, useSwitchTenant, useJoinTenant } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  TextField,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { useSession } from "../../sdk/session";

/* --------------------------- defensive readers -------------------------- */

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const bool = (v: unknown): boolean => v === true;

function roleLabel(role: string): string {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function codeMark(name: string, code: string): string {
  if (code) return code.slice(0, 2).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
}

interface Membership {
  tenantId: string;
  name: string;
  code: string;
  role: string;
  active: boolean;
}

/** Read the active tenant id from the `me` view, several shapes tolerated. */
function readActiveTenantId(me: unknown): string {
  const o = obj(me);
  return str(
    o.activeTenantId ?? o.tenantId ?? obj(o.tenant ?? o.activeTenant).id ?? obj(o.claims).tenantId
  );
}

function readMemberships(me: unknown): Membership[] {
  const o = obj(me);
  const raw = Array.isArray(o.memberships)
    ? (o.memberships as unknown[])
    : Array.isArray(o.tenants)
      ? (o.tenants as unknown[])
      : [];
  const activeId = readActiveTenantId(me);
  return raw.map((m, i) => {
    const r = obj(m);
    const tenant = obj(r.tenant);
    const tenantId = str(r.tenantId ?? tenant.id ?? r.id, `tenant-${i}`);
    return {
      tenantId,
      name: str(r.name ?? r.tenantName ?? tenant.name ?? tenant.tenantName, "School"),
      code: str(r.code ?? r.tenantCode ?? tenant.code ?? tenant.tenantCode),
      role: str(r.role ?? tenant.role, "member"),
      active: bool(r.isActive ?? r.active) || (!!activeId && tenantId === activeId),
    };
  });
}

/* -------------------------------- screen -------------------------------- */

export default function TenantSwitcherScreen(): React.JSX.Element {
  const router = useRouter();
  const session = useSession();
  const meQuery = useMe();
  const switchTenant = useSwitchTenant();
  const joinTenant = useJoinTenant();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const memberships = useMemo<Membership[]>(() => readMemberships(meQuery.data), [meQuery.data]);

  const onSwitch = useCallback(
    (m: Membership) => {
      if (m.active || switchTenant.isPending) return;
      setPendingId(m.tenantId);
      setNotice(null);
      switchTenant.mutate(m.tenantId, {
        onSuccess: () => {
          setPendingId(null);
          // Cache is cleared by the hook; land on Home in the new tenant.
          router.replace(routes.home());
        },
        onError: () => {
          setPendingId(null);
          setNotice("Couldn't switch schools — please try again.");
        },
      });
    },
    [switchTenant, router]
  );

  const onJoin = useCallback(() => {
    const code = joinCode.trim();
    if (!code) {
      setNotice("Enter a school code to join.");
      return;
    }
    setNotice(null);
    joinTenant.mutate(code, {
      onSuccess: () => {
        setJoinCode("");
        setNotice("Joined! Your new school is now in the list.");
      },
      onError: () => setNotice("That code didn't work — double-check it and try again."),
    });
  }, [joinCode, joinTenant]);

  /* ------------------------------- list body ------------------------------- */
  let listBody: React.JSX.Element;
  if (meQuery.isLoading) {
    listBody = (
      <Card className="gap-4 p-4">
        {[0, 1].map((i) => (
          <View key={i} className="flex-row items-center gap-3">
            <Skeleton variant="rect" width={40} height={40} radius={10} />
            <View className="flex-1 gap-2">
              <Skeleton width="55%" height={14} />
              <Skeleton width="35%" height={10} />
            </View>
          </View>
        ))}
      </Card>
    );
  } else if (isHardError(meQuery)) {
    listBody = (
      <Card className="items-center gap-2 p-6">
        <Icon name="alert-triangle" size={22} color="#B25E09" />
        <Text className="font-ui text-text-secondary text-sm">Couldn't load your schools.</Text>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon="rotate-ccw"
          loading={meQuery.isFetching}
          onPress={() => meQuery.refetch()}
        >
          Try again
        </Button>
      </Card>
    );
  } else if (memberships.length === 0) {
    listBody = (
      <Card className="p-2">
        <EmptyState
          icon="building-2"
          title="You're in one school"
          body={
            session.user?.email
              ? `Signed in as ${session.user.email}. Join another school with an invite code below.`
              : "Join another school with an invite code below."
          }
        />
      </Card>
    );
  } else {
    listBody = (
      <Card className="px-1 py-1">
        {memberships.map((m, i) => {
          const busy = pendingId === m.tenantId;
          return (
            <View key={m.tenantId}>
              {i > 0 ? <View className="bg-border-subtle h-px" /> : null}
              <View
                className={`flex-row items-center gap-3 px-3 py-3 ${
                  m.active ? "bg-surface-sunken rounded-md" : ""
                }`}
              >
                <View
                  className="bg-brand-subtle items-center justify-center rounded-md"
                  style={{ width: 40, height: 40 }}
                >
                  <Text className="font-display text-brand text-sm">
                    {codeMark(m.name, m.code)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-ui text-text-primary font-medium" numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text className="font-ui text-text-secondary text-xs">
                    {roleLabel(m.role)}
                    {m.code ? ` · ${m.code}` : ""}
                  </Text>
                </View>
                {m.active ? (
                  <Badge variant="success" icon="check">
                    Active
                  </Badge>
                ) : busy ? (
                  <ActivityIndicator size="small" color="#423A82" />
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={switchTenant.isPending}
                    onPress={() => onSwitch(m)}
                  >
                    Switch
                  </Button>
                )}
              </View>
            </View>
          );
        })}
      </Card>
    );
  }

  return (
    <Screen background="canvas">
      <TopBar title="Switch school" onBack={() => router.back()} />

      <View className="gap-6 p-4 pb-12">
        {notice ? (
          <Card className="border-border-subtle bg-brand-subtle flex-row items-center gap-2 border p-3">
            <Icon name="info" size={16} color="#423A82" />
            <Text className="font-ui text-text-secondary flex-1 text-sm">{notice}</Text>
          </Card>
        ) : null}

        <View className="gap-3">
          <SectionHeader
            title="Your schools"
            subtitle="Switching reloads your data for that school."
          />
          {listBody}
        </View>

        <View className="gap-3">
          <SectionHeader title="Join a school" />
          <Card className="gap-3 p-4">
            <TextField
              label="Invite code"
              placeholder="e.g. SUB001"
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              leadingIcon="ticket"
            />
            <Button
              variant="primary"
              leadingIcon="plus"
              loading={joinTenant.isPending}
              disabled={joinTenant.isPending || joinCode.trim().length === 0}
              onPress={onJoin}
            >
              Join school
            </Button>
          </Card>
        </View>

        <Divider />
        <Text className="font-ui text-text-muted px-1 text-center text-xs">
          Switching schools signs you into that tenant with the role you hold there.
        </Text>
      </View>
    </Screen>
  );
}
