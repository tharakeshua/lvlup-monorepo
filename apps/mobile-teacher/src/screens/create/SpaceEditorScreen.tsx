/**
 * SpaceEditorScreen — create or edit a space (course / assessment / practice).
 *
 * Route params: spaceId? (edit mode — no param = create)
 */
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSaveSpace } from "@levelup/query";

import { Button, Divider, Icon, TextField } from "../../components";
import { colors } from "../../theme";

type SpaceType = "course" | "assessment" | "practice";
type AccessType = "class_assigned" | "tenant_wide";

const SPACE_TYPES: { label: string; value: SpaceType; icon: string }[] = [
  { label: "Course", value: "course", icon: "book" },
  { label: "Assessment", value: "assessment", icon: "clipboard" },
  { label: "Practice", value: "practice", icon: "dumbbell" },
];

const ACCESS_TYPES: { label: string; value: AccessType; description: string }[] = [
  {
    label: "Class assigned",
    value: "class_assigned",
    description: "Visible only to assigned classes",
  },
  {
    label: "Tenant-wide",
    value: "tenant_wide",
    description: "Available to all students in the school",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wide">
      {children}
    </Text>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="font-ui text-text-secondary text-sm font-semibold">{label}</Text>
      {children}
    </View>
  );
}

function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <Text className="font-ui text-text-primary text-sm font-semibold">{label}</Text>
        {hint && <Text className="text-text-muted text-xs">{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.textMuted, true: colors.brand }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

export default function SpaceEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string }>();
  const spaceId = typeof params.spaceId === "string" && params.spaceId ? params.spaceId : undefined;

  const [title, setTitle] = useState("");
  const [type, setType] = useState<SpaceType>("course");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [accessType, setAccessType] = useState<AccessType>("class_assigned");
  const [allowRetakes, setAllowRetakes] = useState(false);
  const [maxRetakes, setMaxRetakes] = useState("");
  const [defaultTimeLimitMinutes, setDefaultTimeLimitMinutes] = useState("");
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useSaveSpace();

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({
        id: spaceId,
        data: {
          title: title.trim(),
          type,
          description: description.trim() || undefined,
          subject: subject.trim() || undefined,
          accessType,
          allowRetakes,
          maxRetakes: allowRetakes && maxRetakes ? Number(maxRetakes) : undefined,
          defaultTimeLimitMinutes: defaultTimeLimitMinutes
            ? Number(defaultTimeLimitMinutes)
            : undefined,
          showCorrectAnswers,
        },
      } as Record<string, unknown>);
      router.back();
    } catch {
      setError("Save failed. Please try again.");
    }
  }

  const isEditing = !!spaceId;

  return (
    <View className="bg-canvas flex-1">
      <View className="bg-surface border-border-subtle flex-row items-center gap-3 border-b px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text className="font-display text-text-primary flex-1 text-lg font-bold">
          {isEditing ? "Edit space" : "Create space"}
        </Text>
        <Button
          variant="primary"
          size="sm"
          loading={save.isPending}
          onPress={() => void handleSave()}
        >
          Save
        </Button>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View className="bg-error-subtle border-error rounded-md border px-3 py-2">
            <Text className="text-error text-sm">{error}</Text>
          </View>
        )}

        <TextField
          label="Title"
          required
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Grade 10 Mathematics"
        />

        <FieldRow label="Space type">
          <View className="flex-row gap-2">
            {SPACE_TYPES.map((opt) => {
              const active = type === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setType(opt.value)}
                  className="flex-1 items-center gap-1 rounded-xl border py-3"
                  style={{
                    borderColor: active ? colors.brand : colors.textMuted,
                    backgroundColor: active ? `${colors.brand}12` : "transparent",
                  }}
                >
                  <Icon
                    name={opt.icon}
                    size={18}
                    color={active ? colors.brand : colors.textSecondary}
                  />
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: active ? colors.brand : colors.textSecondary }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FieldRow>

        <TextField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Brief description of this space"
          multiline
        />

        <TextField
          label="Subject (optional)"
          value={subject}
          onChangeText={setSubject}
          placeholder="e.g. Mathematics, Physics, History"
        />

        <Divider />

        <SectionLabel>Access</SectionLabel>
        {ACCESS_TYPES.map((opt) => {
          const active = accessType === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setAccessType(opt.value)}
              className="flex-row items-center gap-3 rounded-xl border p-4"
              style={{
                borderColor: active ? colors.brand : colors.textMuted,
                backgroundColor: active ? `${colors.brand}08` : "transparent",
              }}
            >
              <View
                className="h-5 w-5 items-center justify-center rounded-full border"
                style={{ borderColor: active ? colors.brand : colors.textMuted }}
              >
                {active && (
                  <View
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colors.brand }}
                  />
                )}
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: active ? colors.brand : colors.textPrimary }}
                >
                  {opt.label}
                </Text>
                <Text className="text-text-muted text-xs">{opt.description}</Text>
              </View>
            </Pressable>
          );
        })}

        <Divider />

        <SectionLabel>Settings</SectionLabel>

        <SwitchRow
          label="Allow retakes"
          hint="Students can retake this space"
          value={allowRetakes}
          onValueChange={setAllowRetakes}
        />

        {allowRetakes && (
          <TextField
            label="Max retakes"
            value={maxRetakes}
            onChangeText={setMaxRetakes}
            keyboardType="numeric"
            placeholder="e.g. 3 (blank = unlimited)"
          />
        )}

        <TextField
          label="Default time limit (minutes, optional)"
          value={defaultTimeLimitMinutes}
          onChangeText={setDefaultTimeLimitMinutes}
          keyboardType="numeric"
          placeholder="e.g. 90"
          hint="Applied to all tests in this space unless overridden"
        />

        <SwitchRow
          label="Show correct answers"
          hint="Students see correct answers after completing"
          value={showCorrectAnswers}
          onValueChange={setShowCorrectAnswers}
        />

        <Button variant="primary" block loading={save.isPending} onPress={() => void handleSave()}>
          {isEditing ? "Save changes" : "Create space"}
        </Button>
      </ScrollView>
    </View>
  );
}
