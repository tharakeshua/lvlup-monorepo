/**
 * Consumer (B2C) Profile — "Your plan" account screen.
 *
 * The personal-account variant of the learner profile, scoped to a self-serve
 * consumer (no tenant/school). It surfaces the signed-in identity, a "Your plan"
 * summary (plan tier, spaces enrolled, lifetime invested), a few KPI stat tiles,
 * a spark CTA into the store, and a tappable row into account/settings.
 *
 * Data:
 *  - `useSession()` (app SDK)            → signed-in identity { uid, email, displayName, emailVerified }.
 *  - `useStudentSummary(uid)` (@levelup/query) → cross-domain learner summary (typed `unknown`).
 *
 * The summary is read defensively: every field has a fallback and nothing crashes
 * on undefined. The screen renders loading / error / empty / success states.
 */
import { useRouter } from "expo-router";
import { useStudentSummary } from "@levelup/query";
import { asUserId } from "@levelup/domain";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  ListRow,
  Screen,
  Skeleton,
  StatTile,
} from "../../components";
import { Text, View } from "react-native";

import { routes } from "../../lib/routes";
import { useSession } from "../../sdk/session";
import { isHardError } from "../../lib/query-status";

/* ---------------- defensive readers ---------------- */
const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Pull the first present numeric/string value across candidate keys. */
function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (source[k] !== undefined && source[k] !== null) return source[k];
  }
  return undefined;
}

type PlanTier = "Pro" | "Premium" | "Free";

function readPlan(summary: Record<string, unknown>): PlanTier {
  const raw = pick(summary, ["plan", "planTier", "tier", "subscriptionTier"]);
  const s = str(raw).toLowerCase();
  if (s.includes("premium")) return "Premium";
  if (s.includes("pro")) return "Pro";
  if (pick(summary, ["isPro", "pro"]) === true) return "Pro";
  return "Free";
}

function formatSpend(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw;
  const n = num(raw, 0);
  if (n <= 0) return "₹0";
  return "₹" + n.toLocaleString("en-IN");
}

function initialsFrom(name: string, email: string): string {
  const base = name.trim() || email.trim();
  if (!base) return "You";
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase() || base.slice(0, 2).toUpperCase();
}

/* ---------------- plan badge ---------------- */
function PlanBadge({ tier }: { tier: PlanTier }) {
  if (tier === "Pro") {
    return (
      <Badge variant="spark" icon="crown">
        Pro
      </Badge>
    );
  }
  if (tier === "Premium") {
    return (
      <Badge variant="brand" icon="gem">
        Premium
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" icon="user">
      Free
    </Badge>
  );
}

/* ---------------- loading skeleton (matches geometry) ---------------- */
function LoadingState() {
  return (
    <View className="gap-4">
      {/* identity */}
      <Card className="flex-row items-center gap-4 p-4">
        <Skeleton variant="circle" width={64} height={64} />
        <View className="flex-1 gap-2">
          <Skeleton width="55%" height={20} />
          <Skeleton width="70%" height={14} />
        </View>
      </Card>
      {/* your plan */}
      <Card className="gap-3 p-4">
        <Skeleton width="40%" height={16} />
        <Skeleton width="30%" height={26} />
        <Divider />
        <Skeleton width="80%" height={14} />
        <Skeleton width="65%" height={14} />
      </Card>
      {/* stat tiles */}
      <View className="flex-row gap-3">
        {[0, 1].map((i) => (
          <View key={i} className="flex-1">
            <Card className="gap-2 p-4">
              <Skeleton width="60%" height={12} />
              <Skeleton width="45%" height={24} />
            </Card>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------------- screen ---------------- */
export default function ConsumerProfileScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const uid = asUserId(user?.uid ?? "");

  const summaryQuery = useStudentSummary(uid);
  const summary = obj(summaryQuery.data);

  const displayName = str(user?.displayName) || str(user?.email) || "Your account";
  const email = str(user?.email);
  const verified = user?.emailVerified === true;
  const initials = initialsFrom(str(user?.displayName), email);

  const plan = readPlan(summary);
  const enrolledSpaces = num(
    pick(summary, ["enrolledSpaces", "spacesEnrolled", "spaceCount", "spaces"]),
    0
  );
  const totalSpent = formatSpend(
    pick(summary, ["totalSpend", "totalSpent", "lifetimeSpend", "invested"])
  );
  const memberSince = str(pick(summary, ["memberSince", "joinedAt", "createdAt"]));

  const isLoading = sessionLoading || (Boolean(uid) && summaryQuery.isLoading);
  // A fresh account's summary may not exist yet (NOT_FOUND) — soft miss, render
  // defaulted fields rather than an error. Only a genuine failure errors out.
  const isError = isHardError(summaryQuery);

  /* --- error state --- */
  if (isError) {
    return (
      <Screen>
        <EmptyState
          icon="alert-triangle"
          title="We couldn't load your account"
          body="Your data is safe — let's try again."
          action={
            <Button
              variant="secondary"
              leadingIcon="rotate-cw"
              onPress={() => summaryQuery.refetch()}
            >
              Try again
            </Button>
          }
        />
      </Screen>
    );
  }

  /* --- loading state --- */
  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  /* --- empty state (signed out / no identity resolved) --- */
  if (!uid) {
    return (
      <Screen>
        <EmptyState
          icon="user"
          title="You're signed out"
          body="Sign in to see your plan, your spaces and every receipt."
          action={
            <Button
              variant="primary"
              leadingIcon="log-in"
              onPress={() => router.push(routes.login())}
            >
              Sign in
            </Button>
          }
        />
      </Screen>
    );
  }

  /* --- success --- */
  return (
    <Screen>
      <View className="gap-5">
        {/* PAGE HEADER */}
        <View className="gap-1">
          <Text className="font-display text-text-primary text-2xl font-semibold">My account</Text>
          <Text className="text-text-muted text-sm">
            Your identity, plan and learning — always with you.
          </Text>
        </View>

        {/* IDENTITY CARD */}
        <Card className="flex-row items-center gap-4 p-4">
          <Avatar initials={initials} size="lg" />
          <View className="flex-1 gap-1">
            <Text
              className="font-display text-text-primary text-lg font-semibold"
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <View className="flex-row flex-wrap items-center gap-2">
              {email ? (
                <Text className="text-text-secondary text-sm" numberOfLines={1}>
                  {email}
                </Text>
              ) : null}
              {verified ? (
                <Badge variant="success" icon="check-circle">
                  Verified
                </Badge>
              ) : null}
            </View>
          </View>
        </Card>

        {/* YOUR PLAN */}
        <Card className="gap-4 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-display text-text-primary text-lg font-semibold">Your plan</Text>
            <PlanBadge tier={plan} />
          </View>
          <Divider />
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon name="book-open" size={16} />
                <Text className="text-text-secondary text-sm">Spaces enrolled</Text>
              </View>
              <Text className="text-text-primary font-mono text-base font-semibold">
                {String(enrolledSpaces)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon name="wallet" size={16} />
                <Text className="text-text-secondary text-sm">Total invested</Text>
              </View>
              <Text className="text-text-primary font-mono text-base font-semibold">
                {totalSpent}
              </Text>
            </View>
            {memberSince ? (
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Icon name="calendar" size={16} />
                  <Text className="text-text-secondary text-sm">Member since</Text>
                </View>
                <Text className="text-text-primary text-sm">{memberSince}</Text>
              </View>
            ) : null}
          </View>
          <Button
            variant="spark"
            block
            leadingIcon="compass"
            onPress={() => router.push(routes.store())}
          >
            Explore the store
          </Button>
        </Card>

        {/* STAT TILES */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <StatTile icon="layers" label="Spaces enrolled" value={String(enrolledSpaces)} />
          </View>
          <View className="flex-1">
            <StatTile icon="receipt" label="Lifetime invested" value={totalSpent} />
          </View>
        </View>

        {/* ACCOUNT / SETTINGS */}
        <Card className="p-0">
          <ListRow
            title="Account & settings"
            sub="Profile, notifications, sign out"
            leading={<Icon name="settings" size={18} />}
            onPress={() => router.push(routes.settings())}
          />
        </Card>

        <View className="h-6" />
      </View>
    </Screen>
  );
}
