/**
 * People-lane shared helpers + presentation (M-admin-people).
 *
 * Thin compositions over the stable component barrel + tiny defensive
 * normalizers for the identity reads. EVERY identity read here can soft-miss to
 * empty (NOT_FOUND/UNAUTHENTICATED/PERMISSION_DENIED) while the admin callables
 * deploy — so all accessors guard nested fields and return zero state, never
 * throw. Response shapes may also drift from the domain TS types, hence the
 * loose `Record`-style access everywhere.
 */
import { View, Text, Pressable } from "react-native";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  ListRow,
  Screen,
  Skeleton,
  type BadgeProps,
} from "../../../components";

// ── list / count normalizers (lists come back as T[] OR { items: T[] }) ──────
export function listOf<T = Record<string, unknown>>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown[] } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export function countOf(res: unknown): number | null {
  if (res == null) return null;
  if (Array.isArray(res)) return res.length;
  const items = (res as { items?: unknown[] }).items;
  return Array.isArray(items) ? items.length : null;
}

// ── person field accessors (defensive) ───────────────────────────────────────
/** Loose view of any identity entity (student/teacher/parent/staff). */
export interface PersonLike {
  id?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: string;
  rollNumber?: string;
  grade?: string;
  section?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  subjects?: string[];
  classIds?: string[];
  studentIds?: string[];
  parentIds?: string[];
  linkedStudentNames?: string[];
  role?: string;
  [key: string]: unknown;
}

export function fullName(p: PersonLike | null | undefined): string {
  if (!p) return "Unnamed";
  const joined = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return p.displayName?.trim() || joined || p.email || "Unnamed";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Map an entity status string onto a Badge variant + label. Unknown → neutral. */
export function statusMeta(status?: string): { variant: BadgeProps["variant"]; label: string } {
  const s = (status ?? "").toLowerCase();
  if (s === "active") return { variant: "success", label: "Active" };
  if (s === "invited" || s === "pending")
    return { variant: "warning", label: s === "invited" ? "Invited" : "Pending" };
  if (s === "suspended") return { variant: "error", label: "Suspended" };
  if (s === "archived" || s === "inactive" || s === "deactivated")
    return { variant: "neutral", label: s === "archived" ? "Archived" : "Inactive" };
  if (!s) return { variant: "neutral", label: "—" };
  return { variant: "neutral", label: status as string };
}

// ── presentation ─────────────────────────────────────────────────────────────
/** A roster row: avatar · name · subtitle meta · status badge · chevron. */
export function PersonRow({
  person,
  subtitle,
  onPress,
}: {
  person: PersonLike;
  subtitle?: string;
  onPress?: () => void;
}) {
  const name = fullName(person);
  const st = statusMeta(person.status);
  return (
    <ListRow
      title={name}
      subtitle={subtitle ?? person.email ?? undefined}
      leading={<Avatar initials={initialsOf(name)} size="md" />}
      trailing={<Badge variant={st.variant}>{st.label}</Badge>}
      onPress={onPress}
    />
  );
}

/** A horizontal segmented control (Students / Teachers / Parents …). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; count?: number | null }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} className="flex-1">
            <View
              className={`flex-row items-center justify-center gap-1.5 rounded-md border px-3 py-2 ${
                on ? "border-brand bg-brand-subtle" : "border-border-subtle bg-surface"
              }`}
            >
              <Text className={`text-sm font-medium ${on ? "text-brand" : "text-text-secondary"}`}>
                {o.label}
              </Text>
              {o.count != null ? (
                <Text className={`text-2xs font-mono ${on ? "text-brand" : "text-text-muted"}`}>
                  {o.count}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Vertical stack of shimmer rows for a roster list. */
export function RosterSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View className="gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          className="border-border-subtle bg-surface flex-row items-center gap-3 rounded-lg border p-3"
        >
          <Skeleton variant="circle" width={40} height={40} />
          <View className="flex-1 gap-2">
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={11} />
          </View>
          <Skeleton width={56} height={20} radius={999} />
        </View>
      ))}
    </View>
  );
}

/** A small stat pill (label over mono value) — parent-linking / roster headers. */
export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="min-w-[88px] flex-1 gap-0.5 py-2.5">
      <Text className="text-2xs text-text-muted uppercase tracking-wide">{label}</Text>
      <Text className="text-text-primary font-mono text-lg">{value}</Text>
    </Card>
  );
}

/** Full-screen "callables not deployed yet" gentle footer note. */
export function PendingNote({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row items-start gap-2 px-1 pb-2 pt-1">
      <Icon name="info" size={13} color="#9A9384" />
      <Text className="text-2xs text-text-muted flex-1">{children}</Text>
    </View>
  );
}

/** Reusable "couldn't load" inline card with a retry. */
export function LoadError({ onRetry }: { onRetry?: () => void }) {
  return (
    <Card className="items-center gap-3 py-8">
      <Icon name="cloud-off" size={26} color="#756E61" />
      <Text className="font-display text-text-primary text-base">Couldn’t load</Text>
      <Text className="text-text-muted px-6 text-center text-sm">
        This one’s on us — give it another go.
      </Text>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Icon name="rotate-cw" size={15} />}
          onPress={onRetry}
        >
          Try again
        </Button>
      ) : null}
    </Card>
  );
}

/** Convenience wrapper so screens share one Screen shell. */
export function PeopleScreen({ children }: { children: React.ReactNode }) {
  return (
    <Screen scroll contentClassName="p-5 gap-4">
      {children}
    </Screen>
  );
}
