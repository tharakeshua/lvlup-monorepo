/**
 * TenantSettingsScreen — school information, branding & features.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/tenant-settings-branding.card.html
 * Route:  /admin/more/settings
 * Data:   useTenant() (read) + useSaveTenant() (save school info / brand / key).
 *         Note: the contract's `useSaveTenantSettings` is not exported by
 *         @levelup/query — `useSaveTenant` carries every mutation here.
 *         Reads soft-miss to empty until the tenant callable deploys.
 *
 * Asset upload (logo/brand assets) is heavy → "Continue on web" deep-link rather
 * than a native uploader.
 */
import { useEffect, useMemo, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSaveTenant, useTenant } from "@levelup/query";

import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  StatTile,
  TextField,
  TopBar,
} from "../../components";
import { isHardError } from "../../lib/query-status";
import { pickNum, pickStr } from "./_shared";

const WEB_SETTINGS_URL = "https://app.levelup.academy/admin/settings";

type Field = {
  key: string;
  label: string;
  aliases: string[];
  placeholder?: string;
  keyboard?: "email-address" | "phone-pad" | "url";
};

const FIELDS: Field[] = [
  {
    key: "name",
    label: "School name",
    aliases: ["name", "displayName", "schoolName"],
    placeholder: "Northwood Academy",
  },
  {
    key: "contactEmail",
    label: "Contact email",
    aliases: ["contactEmail", "email"],
    keyboard: "email-address",
  },
  {
    key: "contactPhone",
    label: "Contact phone",
    aliases: ["contactPhone", "phone"],
    keyboard: "phone-pad",
  },
  { key: "contactPerson", label: "Contact person", aliases: ["contactPerson", "contactName"] },
  { key: "website", label: "Website", aliases: ["website", "url"], keyboard: "url" },
  { key: "address", label: "Address", aliases: ["address", "location"] },
];

export default function TenantSettingsScreen() {
  const router = useRouter();
  const tenantQ = useTenant();
  const saveMut = useSaveTenant();

  const tenant = tenantQ.data;
  const tenantCode = pickStr(tenant, "tenantCode", "code") ?? "—";
  const plan = pickStr(tenant, "plan", "planName", "tier") ?? "Starter";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Seed the draft from the loaded tenant whenever it (re)loads.
  const seed = useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of FIELDS) out[f.key] = pickStr(tenant, ...f.aliases) ?? "";
    out.brandColor = pickStr(tenant, "brandColor", "primaryColor") ?? "";
    return out;
  }, [tenant]);

  useEffect(() => {
    if (!editing) setDraft(seed);
  }, [seed, editing]);

  const limits = [
    { label: "Max students", value: pickNum(tenant, "maxStudents", "studentLimit") },
    { label: "Max teachers", value: pickNum(tenant, "maxTeachers", "teacherLimit") },
    { label: "Max spaces", value: pickNum(tenant, "maxSpaces", "spaceLimit") },
  ];

  const hasKey =
    pickStr(tenant, "geminiApiKeyStatus") === "set" ||
    (pickStr(tenant, "geminiApiKey") ?? "").length > 0;
  const [apiKey, setApiKey] = useState("");

  const onSaveInfo = () => {
    const patch: Record<string, string> = {};
    for (const f of FIELDS) if (draft[f.key]?.trim()) patch[f.key] = draft[f.key].trim();
    if (draft.brandColor?.trim()) patch.brandColor = draft.brandColor.trim();
    saveMut.mutate(patch, {
      onSuccess: () => {
        setEditing(false);
        void tenantQ.refetch();
      },
    });
  };

  const onSaveKey = (remove: boolean) => {
    saveMut.mutate(
      { geminiApiKey: remove ? "" : apiKey.trim() },
      {
        onSuccess: () => {
          setApiKey("");
          void tenantQ.refetch();
        },
      }
    );
  };

  if (tenantQ.isLoading) {
    return (
      <Screen scroll>
        <TopBar title="Settings" subtitle="School information" onBack={() => router.back()} />
        <Card className="gap-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <TopBar
        title="Settings"
        subtitle="School information & branding"
        onBack={() => router.back()}
        right={<Badge variant="neutral">{tenantCode}</Badge>}
      />

      {isHardError(tenantQ) ? (
        <Alert variant="warning" title="Couldn't load your settings">
          The tenant service may be momentarily unavailable. You can still edit and save — changes
          apply once it reconnects.
        </Alert>
      ) : null}

      {/* School information */}
      <Card className="gap-3">
        <SectionHeader
          title="School information"
          action={
            editing ? (
              <View className="flex-row gap-2">
                <Button variant="ghost" size="sm" onPress={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={saveMut.isPending}
                  onPress={onSaveInfo}
                >
                  Save
                </Button>
              </View>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon="pencil"
                onPress={() => setEditing(true)}
              >
                Edit
              </Button>
            )
          }
        />

        <View>
          <Text className="text-2xs text-text-muted mb-1 font-semibold uppercase tracking-wide">
            Tenant code
          </Text>
          <Text className="text-text-secondary font-mono text-sm">{tenantCode}</Text>
        </View>

        {FIELDS.map((f) =>
          editing ? (
            <TextField
              key={f.key}
              label={f.label}
              value={draft[f.key] ?? ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
              placeholder={f.placeholder}
              keyboardType={f.keyboard}
              autoCapitalize={
                f.keyboard === "email-address" || f.keyboard === "url" ? "none" : "sentences"
              }
            />
          ) : (
            <View key={f.key}>
              <Text className="text-2xs text-text-muted mb-0.5 font-semibold uppercase tracking-wide">
                {f.label}
              </Text>
              <Text className="text-text-primary text-sm">
                {pickStr(tenant, ...f.aliases) ?? "—"}
              </Text>
            </View>
          )
        )}
      </Card>

      {/* Subscription */}
      <Card className="gap-3">
        <SectionHeader
          title="Subscription"
          subtitle="Plan limits are set by your platform provider"
        />
        <View className="flex-row items-center gap-2">
          <Badge variant="brand" icon={<Icon name="crown" size={12} />}>
            {plan}
          </Badge>
        </View>
        <View className="flex-row flex-wrap gap-3">
          {limits.map((l) => (
            <View key={l.label} className="min-w-[30%] flex-1">
              <StatTile label={l.label} value={l.value == null ? "—" : String(l.value)} />
            </View>
          ))}
        </View>
      </Card>

      {/* Logo & assets → web */}
      <Card className="gap-3">
        <SectionHeader title="Logo & assets" subtitle="Branding shown to students & staff" />
        <View className="border-border-strong bg-surface-sunken items-center gap-2 rounded-lg border border-dashed px-4 py-6">
          <Icon name="image" size={28} color="#94a3b8" />
          <Text className="text-text-secondary text-sm">Logo upload is available on the web</Text>
          <Text className="text-2xs text-text-muted max-w-[260px] text-center">
            PNG or SVG, up to 2 MB. Square works best.
          </Text>
        </View>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon="external-link"
          onPress={() => void Linking.openURL(WEB_SETTINGS_URL)}
        >
          Continue on web
        </Button>
        <Divider />
        <TextField
          label="Brand color"
          placeholder="#4f46e5"
          autoCapitalize="none"
          value={draft.brandColor ?? ""}
          onChangeText={(v) => setDraft((d) => ({ ...d, brandColor: v }))}
        />
        <Button
          variant="ghost"
          size="sm"
          loading={saveMut.isPending}
          disabled={!draft.brandColor?.trim()}
          onPress={onSaveInfo}
        >
          Save brand color
        </Button>
      </Card>

      {/* Tenant features — Gemini API key */}
      <Card className="gap-3">
        <SectionHeader
          title="Tenant features"
          subtitle="AI grading uses your Gemini API key"
          action={
            hasKey ? (
              <Badge variant="success">Key set</Badge>
            ) : (
              <Badge variant="neutral">Plan-gated</Badge>
            )
          }
        />
        <TextField
          label={hasKey ? "Update Gemini API key" : "Set Gemini API key"}
          placeholder="AIza…"
          autoCapitalize="none"
          secureTextEntry
          value={apiKey}
          onChangeText={setApiKey}
        />
        <View className="flex-row gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={saveMut.isPending}
            disabled={!apiKey.trim()}
            onPress={() => onSaveKey(false)}
          >
            {hasKey ? "Update key" : "Set key"}
          </Button>
          {hasKey ? (
            <Button
              variant="danger"
              size="sm"
              loading={saveMut.isPending}
              onPress={() => onSaveKey(true)}
            >
              Remove
            </Button>
          ) : null}
        </View>
      </Card>

      {saveMut.isError ? (
        <Text className="text-error px-1 text-xs">
          Couldn't save your changes. Please try again.
        </Text>
      ) : null}
      <Text className="text-2xs text-text-muted px-1 pb-2">
        You can change all of this later. Branding and assets propagate to students and staff.
      </Text>
    </Screen>
  );
}
