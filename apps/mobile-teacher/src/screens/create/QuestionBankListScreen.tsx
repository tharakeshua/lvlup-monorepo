/**
 * QuestionBankListScreen — browse and manage the question bank.
 *
 * Filters: questionType (top 5 + All), difficulty (Easy / Medium / Hard / All), search text.
 * Each row navigates to QuestionBankEditorScreen for editing.
 * FAB in bottom-right navigates to a new question.
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuestionBank } from "@levelup/query";

import {
  Badge,
  EmptyState,
  FilterChips,
  Icon,
  ListRow,
  Screen,
  SearchField,
  Skeleton,
} from "../../components";
import { colors } from "../../theme";
import { routes } from "../../lib/routes";

const QT_LABELS: Record<string, string> = {
  mcq: "Multiple choice",
  mcaq: "Multiple correct",
  "true-false": "True / false",
  numerical: "Numerical",
  text: "Short answer",
  paragraph: "Long answer",
  code: "Code",
  "fill-blanks": "Fill blanks",
  "fill-blanks-dd": "Fill blanks DD",
  matching: "Matching",
  jumbled: "Reorder",
  audio: "Audio",
  image_evaluation: "Image eval",
  "group-options": "Group options",
  chat_agent_question: "Chat agent",
};

const TOP_TYPES = ["mcq", "mcaq", "true-false", "numerical", "text"];

const DIFFICULTY_CHIPS = [
  { label: "All", key: "" },
  { label: "Easy", key: "easy" },
  { label: "Medium", key: "medium" },
  { label: "Hard", key: "hard" },
];

const TYPE_CHIPS = [
  { label: "All", key: "" },
  ...TOP_TYPES.map((t) => ({ label: QT_LABELS[t] ?? t, key: t })),
];

function difficultyVariant(d?: string) {
  if (d === "easy") return "success" as const;
  if (d === "hard") return "error" as const;
  return "neutral" as const;
}

export default function QuestionBankListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");

  const filter = {
    questionType: selectedType || undefined,
    difficulty: selectedDifficulty || undefined,
    search: search || undefined,
  };

  const query = useQuestionBank(filter);
  const items =
    (query.data as
      | { id?: string; title?: string; questionType?: string; difficulty?: string }[]
      | undefined) ?? [];

  return (
    <View className="bg-canvas flex-1">
      <View className="bg-surface border-border-subtle border-b px-4 pb-3 pt-4">
        <Text className="font-display text-text-primary mb-3 text-xl font-bold">Question Bank</Text>
        <SearchField value={search} onChangeText={setSearch} placeholder="Search questions…" />
      </View>

      <Screen scroll={false} contentClassName="flex-1 gap-0 px-0 py-0">
        <View className="gap-2 px-4 py-3">
          <Text className="text-text-muted text-xs font-semibold uppercase tracking-wide">
            Type
          </Text>
          <FilterChips options={TYPE_CHIPS} value={selectedType} onChange={setSelectedType} />
          <Text className="text-text-muted text-xs font-semibold uppercase tracking-wide">
            Difficulty
          </Text>
          <FilterChips
            options={DIFFICULTY_CHIPS}
            value={selectedDifficulty}
            onChange={setSelectedDifficulty}
          />
        </View>

        <View className="flex-1">
          {query.isLoading ? (
            <View className="gap-2 px-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </View>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Icon name="database" size={28} color={colors.textMuted} />}
              title="No questions yet"
              body={
                search || selectedType || selectedDifficulty
                  ? "No questions match your filters. Try clearing them."
                  : "Create your first question to build your bank."
              }
            />
          ) : (
            <View className="gap-1 px-4">
              {items.map((item, idx) => (
                <ListRow
                  key={item.id ?? idx}
                  title={item.title ?? "Untitled question"}
                  subtitle={
                    <View className="mt-0.5 flex-row items-center gap-2">
                      <Badge variant="neutral">
                        {QT_LABELS[item.questionType ?? ""] ?? item.questionType ?? "—"}
                      </Badge>
                      {item.difficulty && (
                        <Badge variant={difficultyVariant(item.difficulty)}>
                          {item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}
                        </Badge>
                      )}
                    </View>
                  }
                  trailing={<Icon name="chevron-right" size={16} color={colors.textMuted} />}
                  onPress={() => item.id && router.push(routes.questionBankEditor(item.id))}
                />
              ))}
            </View>
          )}
        </View>
      </Screen>

      {/* FAB */}
      <Pressable
        onPress={() => router.push(routes.questionBankEditor())}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full shadow-lg"
        style={{ backgroundColor: colors.brand }}
      >
        <Icon name="plus" size={26} color={colors.textOnAccent} />
      </Pressable>
    </View>
  );
}
