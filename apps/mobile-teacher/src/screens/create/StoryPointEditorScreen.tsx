/**
 * StoryPointEditorScreen — create or edit a story point within a space.
 *
 * Route params: spaceId (required), storyPointId? (edit mode)
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSaveStoryPoint } from "@levelup/query";

import { Button, Divider, Icon, TextField } from "../../components";
import { colors } from "../../theme";

type SpType = "lesson" | "test" | "practice";

const TYPE_OPTIONS: { label: string; value: SpType; icon: string }[] = [
  { label: "Lesson", value: "lesson", icon: "book-open" },
  { label: "Test", value: "test", icon: "clipboard-check" },
  { label: "Practice", value: "practice", icon: "dumbbell" },
];

export default function StoryPointEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string; storyPointId?: string }>();
  const spaceId = params.spaceId ?? "";
  const storyPointId =
    typeof params.storyPointId === "string" && params.storyPointId
      ? params.storyPointId
      : undefined;

  const [title, setTitle] = useState("");
  const [type, setType] = useState<SpType>("lesson");
  const [description, setDescription] = useState("");
  const [passingScore, setPassingScore] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useSaveStoryPoint();

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({
        id: storyPointId,
        data: {
          spaceId,
          title: title.trim(),
          type,
          description: description.trim() || undefined,
          passingScore: passingScore ? Number(passingScore) : undefined,
          timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : undefined,
        },
      } as Record<string, unknown>);
      router.back();
    } catch {
      setError("Save failed. Please try again.");
    }
  }

  const isEditing = !!storyPointId;

  return (
    <View className="bg-canvas flex-1">
      <View className="bg-surface border-border-subtle flex-row items-center gap-3 border-b px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text className="font-display text-text-primary flex-1 text-lg font-bold">
          {isEditing ? "Edit story point" : "Add story point"}
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
          placeholder="e.g. Introduction to Algebra"
        />

        <View className="gap-1.5">
          <Text className="font-ui text-text-secondary text-sm font-semibold">Type</Text>
          <View className="flex-row gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setType(opt.value)}
                  className="flex-1 items-center justify-center gap-1 rounded-xl border py-3"
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
        </View>

        <TextField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Brief description of this story point"
          multiline
        />

        <Divider />

        {type === "test" && (
          <TextField
            label="Passing score (%)"
            value={passingScore}
            onChangeText={setPassingScore}
            keyboardType="numeric"
            placeholder="e.g. 70"
            hint="Minimum percentage to pass this test"
          />
        )}

        <TextField
          label="Time limit (minutes, optional)"
          value={timeLimitMinutes}
          onChangeText={setTimeLimitMinutes}
          keyboardType="numeric"
          placeholder="e.g. 60"
          hint="Leave blank for no time limit"
        />

        <Button variant="primary" block loading={save.isPending} onPress={() => void handleSave()}>
          {isEditing ? "Save changes" : "Create story point"}
        </Button>
      </ScrollView>
    </View>
  );
}
