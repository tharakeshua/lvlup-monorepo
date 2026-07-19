/**
 * Learner Profile (B2B school identity) — mobile-student.
 *
 * The learner's identity + at-a-glance momentum, school context, and account
 * basics. Translated from the web design prototype `mobile-family/_build/profile.viewjs`
 * to RN + NativeWind (Lyceum "Modern Scholarly").
 *
 * Data:
 *  - `useSession()`            → signed-in user (uid, displayName, email).
 *  - `useStudentSummary(uid)`  → cross-system progress summary (streak, spaces,
 *                                tenant) — `@levelup/query` (testsession-progress).
 *  - `useStudentLevel(uid)`    → level / XP / tier / achievement count — `@levelup/query`
 *                                (gamification).
 *  - `useSaveStudent()`        → optional best-effort persistence of an edited
 *                                display name (non-blocking; UI is optimistic).
 *
 * Hook `data` is typed `unknown`, so every field is read through small defensive
 * helpers. Renders explicit loading / error / empty / success states. The design's
 * "Other states (for review)" showcase blocks are intentionally NOT reproduced.
 */
import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useStudentSummary, useStudentLevel, useSaveStudent } from "@levelup/query";
import { asUserId } from "@levelup/domain";

import {
  Screen,
  Card,
  Button,
  Avatar,
  Badge,
  Chip,
  StatTile,
  ListRow,
  Sheet,
  TextField,
  Skeleton,
  EmptyState,
  Divider,
  Icon,
  colors,
} from "../../components";
import { routes } from "../../lib/routes";
import { useSession } from "../../sdk/session";
import { isHardError } from "../../lib/query-status";

// ── defensive readers ───────────────────────────────────────────────────────
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Initials for the avatar from a display name / email, max two letters. */
function initialsOf(name: string, email: string): string {
  const source = name.trim() || email.trim();
  if (!source) return "L";
  const parts = source
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return letters.join("") || source.charAt(0).toUpperCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const uid = asUserId(str(user?.uid));

  const summary = useStudentSummary(uid);
  const level = useStudentLevel(uid);

  // Best-effort persistence — wired but never blocks the optimistic UI.
  const saveStudent = useSaveStudent();

  // Edit sheet local state.
  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  // Optimistic override of the display name after a local save.
  const [nameOverride, setNameOverride] = useState<string | null>(null);

  const summaryData = obj(summary.data);
  const levelData = obj(level.data);
  const levelup = obj(summaryData.levelup);

  // ── identity (session-first, summary fallback) ────────────────────────────
  const name = useMemo(() => {
    if (nameOverride !== null) return nameOverride;
    return str(user?.displayName) || str(summaryData.studentName) || "Student";
  }, [nameOverride, user?.displayName, summaryData.studentName]);

  const email = str(user?.email) || str(summaryData.studentEmail);
  const initials = initialsOf(name, email);

  // ── at-a-glance stats (defensive) ─────────────────────────────────────────
  const levelNo = num(levelData.level, 1);
  const tier = str(levelData.tier);
  const xpToNext = num(levelData.xpToNextLevel);
  const badges = num(levelData.achievementCount);
  const streakDays = num(levelup.streakDays);
  const completedSpaces = num(levelup.completedSpaces);
  const totalSpaces = num(levelup.totalSpaces);

  // ── school context ────────────────────────────────────────────────────────
  const schoolName = str(summaryData.tenantName) || str(summaryData.schoolName);
  const tenantId = str(summaryData.tenantId);
  const schoolValue =
    schoolName && tenantId
      ? `${schoolName} · ${tenantId}`
      : schoolName || tenantId || "Your school";

  // ── state derivation ──────────────────────────────────────────────────────
  const isLoading = sessionLoading || (Boolean(uid) && (summary.isLoading || level.isLoading));
  // Fresh-account NOT_FOUND on the derived summary/level is a soft miss → render
  // the profile with defaulted fields, not an error. Only a real failure errors.
  const isError = Boolean(uid) && isHardError(summary) && isHardError(level);
  const isEmpty = !sessionLoading && !uid;

  const refetch = () => {
    void summary.refetch();
    void level.refetch();
  };

  const openEdit = () => {
    setDraftName(name === "Student" ? "" : name);
    setEditOpen(true);
  };

  const onSave = () => {
    const next = draftName.trim();
    if (!next) return;
    // Optimistic local update + close — no mutation required.
    setNameOverride(next);
    setEditOpen(false);
    // Best-effort, non-blocking persistence (ignore failures).
    try {
      saveStudent.mutate({ id: uid, displayName: next });
    } catch {
      /* non-blocking */
    }
  };

  // ── loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Screen>
        <View className="gap-4 p-4">
          <Card className="flex-row items-center gap-3">
            <Skeleton variant="circle" width={64} height={64} />
            <View className="flex-1 gap-2">
              <Skeleton width="60%" height={20} />
              <Skeleton width="80%" height={14} />
              <Skeleton width="45%" height={14} />
            </View>
          </Card>
          <View className="flex-row flex-wrap gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="min-w-[45%] flex-1 gap-2">
                <Skeleton width="55%" height={12} />
                <Skeleton width="40%" height={26} />
                <Skeleton width="70%" height={12} />
              </Card>
            ))}
          </View>
          <Card className="gap-3">
            <Skeleton width="40%" height={16} />
            <Skeleton width="90%" height={14} />
            <Skeleton width="70%" height={14} />
          </Card>
        </View>
      </Screen>
    );
  }

  // ── empty (no session) ────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center p-6">
          <EmptyState
            icon="user-round"
            title="You're not signed in"
            body="Sign in to see your profile, progress, and school details."
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
        </View>
      </Screen>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center p-6">
          <EmptyState
            icon="alert-triangle"
            title="We couldn't load your profile"
            body="Your progress is safe — give it another try."
            action={
              <Button variant="secondary" leadingIcon="rotate-cw" onPress={refetch}>
                Retry
              </Button>
            }
          />
        </View>
      </Screen>
    );
  }

  // ── success ───────────────────────────────────────────────────────────────
  const levelSub = tier
    ? `${tier}${xpToNext ? ` · ${xpToNext} XP to Lv. ${levelNo + 1}` : ""}`
    : xpToNext
      ? `${xpToNext} XP to Lv. ${levelNo + 1}`
      : "Keep going";

  return (
    <Screen>
      <View className="gap-4 p-4">
        {/* IDENTITY HEADER */}
        <Card className="gap-4">
          <View className="flex-row items-center gap-3">
            <Avatar initials={initials} size="lg" />
            <View className="flex-1">
              <Text
                className="font-display text-text-primary text-2xl font-semibold"
                numberOfLines={1}
              >
                {name}
              </Text>
              {email ? (
                <Text className="text-text-muted text-sm" numberOfLines={1}>
                  {email}
                </Text>
              ) : null}
              <View className="mt-2 flex-row items-center gap-2">
                <Chip leadingIcon="graduation-cap">Student</Chip>
                <Badge variant="success" icon="check-circle">
                  Active
                </Badge>
              </View>
            </View>
          </View>
          <Button
            variant="ghost"
            leadingIcon="pencil"
            trailingIcon="chevron-right"
            onPress={openEdit}
          >
            Edit profile
          </Button>
        </Card>

        {/* AT-A-GLANCE STATS */}
        <View className="flex-row flex-wrap gap-3">
          <View className="min-w-[45%] flex-1">
            <StatTile icon="award" label="Level" value={String(levelNo)} delta={levelSub} />
          </View>
          <View className="min-w-[45%] flex-1">
            <StatTile
              icon="flame"
              label="Day streak"
              value={String(streakDays)}
              delta={streakDays > 0 ? "Keep it lit" : "Light it up soon"}
            />
          </View>
          <View className="min-w-[45%] flex-1">
            <StatTile
              icon="medal"
              label="Badges earned"
              value={String(badges)}
              delta={badges > 0 ? "Achievements" : "None yet"}
            />
          </View>
          <View className="min-w-[45%] flex-1">
            <StatTile
              icon="check-circle"
              label="Spaces completed"
              value={String(completedSpaces)}
              delta={totalSpaces > 0 ? `of ${totalSpaces} enrolled` : "Get started"}
            />
          </View>
        </View>

        {/* MY PROGRESS — the Progress lane moved off the main tab bar */}
        <Card className="gap-1">
          <Text className="font-display text-text-primary mb-1 text-lg font-semibold">
            My progress
          </Text>
          <ListRow
            title="Progress & analytics"
            leading={<Icon name="bar-chart-3" size={18} color={colors.brand} />}
            onPress={() => router.push(routes.progress())}
          />
          <Divider />
          <ListRow
            title="Achievements"
            leading={<Icon name="award" size={18} color={colors.brand} />}
            onPress={() => router.push(routes.achievements())}
          />
          <Divider />
          <ListRow
            title="Leaderboard"
            leading={<Icon name="trophy" size={18} color={colors.brand} />}
            onPress={() => router.push(routes.leaderboard())}
          />
          <Divider />
          <ListRow
            title="Goals"
            leading={<Icon name="target" size={18} color={colors.brand} />}
            onPress={() => router.push(routes.goals())}
          />
        </Card>

        {/* YOUR SCHOOL */}
        <Card className="gap-1">
          <Text className="font-display text-text-primary mb-1 text-lg font-semibold">
            Your school
          </Text>
          <ListRow title="School" trailing={<RowValue value={schoolValue} />} />
          <Divider />
          <ListRow title="Role" trailing={<RowValue value="Student" />} />
          <Divider />
          <ListRow
            title="Joined"
            trailing={<RowValue value={schoolName || tenantId ? "Member" : "—"} />}
          />
        </Card>

        {/* ACCOUNT BASICS */}
        <Card className="gap-1">
          <Text className="font-display text-text-primary mb-1 text-lg font-semibold">
            Account basics
          </Text>
          <ListRow title="Display name" trailing={<RowValue value={name} />} />
          <Divider />
          <ListRow
            title="Email"
            trailing={<RowValue value={email || "Managed by your school"} muted />}
          />
          <View className="mt-3">
            <Button
              variant="ghost"
              leadingIcon="settings"
              trailingIcon="chevron-right"
              onPress={() => router.push(routes.settings())}
            >
              Manage settings
            </Button>
          </View>
        </Card>

        <View className="h-4" />
      </View>

      {/* EDIT PROFILE SHEET */}
      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit your profile">
        <View className="gap-4 p-4">
          <View className="flex-row items-center gap-3">
            <Avatar initials={initials} size="lg" />
            <View className="flex-1">
              <Text className="text-text-secondary text-sm">
                This is how your teacher and classmates see you.
              </Text>
            </View>
          </View>
          <TextField
            label="Display name"
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Your name"
            autoFocus
          />
          {email ? (
            <TextField
              label="Email"
              value={email}
              editable={false}
              hint="Managed by your school."
            />
          ) : null}
          <View className="mt-2 flex-row items-center gap-3">
            <View className="flex-1">
              <Button variant="ghost" block onPress={() => setEditOpen(false)}>
                Cancel
              </Button>
            </View>
            <View className="flex-1">
              <Button variant="primary" block disabled={!draftName.trim()} onPress={onSave}>
                Save
              </Button>
            </View>
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

/** Right-aligned value for a DefinitionList-style ListRow. */
function RowValue({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <Text
      className={`text-sm ${muted ? "text-text-muted" : "text-text-primary"}`}
      numberOfLines={1}
    >
      {value}
    </Text>
  );
}
