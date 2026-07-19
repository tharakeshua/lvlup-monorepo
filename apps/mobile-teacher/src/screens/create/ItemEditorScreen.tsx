/**
 * ItemEditorScreen — create or edit an item (question/material) within a story point.
 *
 * Route params: spaceId, storyPointId, itemId? (edit mode), questionType? (skip picker)
 *
 * Flow:
 *   • No itemId + no questionType → show 15-type picker
 *   • No itemId + questionType → create mode, jump straight to editor
 *   • itemId present → load via useItemForEdit, pre-populate state, edit mode
 */
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  QUESTION_TYPES,
  initialQuestionPayload,
  useSaveItem,
  useItemForEdit,
  validateQuestionPayload,
  type QuestionType,
} from "@levelup/query";

import { Button, Card, Divider, Icon, Screen } from "../../components";
import { CommonItemFields, QuestionPayloadEditor } from "../../components/item-editor";
import { colors } from "../../theme";
import { routes } from "../../lib/routes";

// ─── question type label map ─────────────────────────────────────────────────

const QT_LABELS: Record<string, string> = {
  mcq: "Multiple choice",
  mcaq: "Multiple correct answers",
  "true-false": "True / false",
  numerical: "Numerical",
  text: "Short answer",
  paragraph: "Long answer",
  code: "Code",
  "fill-blanks": "Fill in the blanks",
  "fill-blanks-dd": "Fill in the blanks (drag & drop)",
  matching: "Matching",
  jumbled: "Reorder",
  audio: "Audio response",
  image_evaluation: "Image evaluation",
  "group-options": "Group options",
  chat_agent_question: "Chat-agent question",
};

const QT_ICONS: Record<string, string> = {
  mcq: "list",
  mcaq: "check-square",
  "true-false": "toggle-left",
  numerical: "hash",
  text: "type",
  paragraph: "align-left",
  code: "code-2",
  "fill-blanks": "underline",
  "fill-blanks-dd": "move",
  matching: "git-compare",
  jumbled: "shuffle",
  audio: "mic",
  image_evaluation: "image",
  "group-options": "layers",
  chat_agent_question: "bot",
};

const MOBILE_AUTHORABLE_QUESTION_TYPES = QUESTION_TYPES.filter(
  (questionType) => questionType !== "chat_agent_question"
);

// ─── TypePicker ──────────────────────────────────────────────────────────────

function TypePicker({ onSelect }: { onSelect: (qt: QuestionType) => void }) {
  return (
    <Screen contentClassName="gap-3">
      <Text className="font-display text-text-primary text-xl font-bold">Choose question type</Text>
      <Text className="text-text-muted text-sm">Select the type of question to create.</Text>
      {MOBILE_AUTHORABLE_QUESTION_TYPES.map((qt) => (
        <Pressable
          key={qt}
          onPress={() => onSelect(qt)}
          className="bg-surface border-border-subtle active:bg-surface-sunken flex-row items-center gap-3 rounded-xl border p-4"
        >
          <View className="bg-brand-subtle h-10 w-10 items-center justify-center rounded-lg">
            <Icon name={QT_ICONS[qt] ?? "help-circle"} size={18} color={colors.brand} />
          </View>
          <View className="flex-1">
            <Text className="font-ui text-text-primary text-base font-semibold">
              {QT_LABELS[qt] ?? qt}
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>
      ))}
      <Card className="gap-1 border-amber-300 bg-amber-50">
        <Text className="text-text-primary text-sm font-semibold">Chat-agent assessments</Text>
        <Text className="text-text-secondary text-xs">
          Create and edit these in Teacher Web. Mobile keeps them read-only to protect their private
          answer-key schema.
        </Text>
      </Card>
    </Screen>
  );
}

// ─── ItemEditorScreen ────────────────────────────────────────────────────────

export default function ItemEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    spaceId?: string;
    storyPointId?: string;
    itemId?: string;
    questionType?: string;
  }>();

  const spaceId = params.spaceId ?? "";
  const storyPointId = params.storyPointId ?? "";
  const itemId = typeof params.itemId === "string" && params.itemId ? params.itemId : undefined;
  const initialType =
    typeof params.questionType === "string" &&
    QUESTION_TYPES.includes(params.questionType as QuestionType)
      ? (params.questionType as QuestionType)
      : null;

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [basePoints, setBasePoints] = useState(1);
  const [difficulty, setDifficulty] = useState("medium");
  const [explanation, setExplanation] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType | null>(initialType);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [populated, setPopulated] = useState(false);
  const [saveErrors, setSaveErrors] = useState<{ field: string; message: string }[]>([]);

  const saveItem = useSaveItem();

  const itemQuery = useItemForEdit(spaceId, storyPointId, itemId ?? "");

  // Pre-populate from loaded item (edit mode)
  if (itemId && !populated && itemQuery.data) {
    const d = itemQuery.data as Record<string, unknown>;
    setTitle((d.title as string) ?? "");
    setPrompt((d.prompt as string) ?? "");
    setBasePoints((d.basePoints as number) ?? 1);
    setDifficulty((d.difficulty as string) ?? "medium");
    setExplanation((d.explanation as string) ?? "");
    const qtValue =
      (d.questionType as string) ??
      ((d.payload as Record<string, unknown>)?.questionType as string) ??
      null;
    const qt =
      qtValue && QUESTION_TYPES.includes(qtValue as QuestionType)
        ? (qtValue as QuestionType)
        : null;
    setQuestionType(qt);
    setPayload((d.payload as Record<string, unknown>) ?? {});
    setPopulated(true);
  }

  // Loading state for edit mode
  if (itemId && itemQuery.isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
          <Text className="text-text-muted mt-2 text-sm">Loading item…</Text>
        </View>
      </Screen>
    );
  }

  // Error state for edit mode
  if (itemId && itemQuery.isError) {
    return (
      <Screen>
        <View className="gap-3 p-4">
          <Text className="text-text-primary font-semibold">Failed to load item</Text>
          <Button variant="secondary" onPress={() => void itemQuery.refetch()}>
            Retry
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            Go back
          </Button>
        </View>
      </Screen>
    );
  }

  // Type picker — shown when no type selected in create mode
  if (!questionType) {
    return (
      <View className="flex-1">
        <View className="bg-surface border-border-subtle flex-row items-center gap-3 border-b px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Icon name="arrow-left" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text className="font-display text-text-primary flex-1 text-lg font-bold">
            {itemId ? "Edit item" : "New item"}
          </Text>
        </View>
        <TypePicker
          onSelect={(qt) => {
            setQuestionType(qt);
            if (!itemId) {
              setPayload(initialQuestionPayload(qt));
            }
          }}
        />
      </View>
    );
  }

  async function handleSave() {
    if (!questionType) return;
    if (questionType === "chat_agent_question") {
      setSaveErrors([
        {
          field: "_",
          message: "Chat-agent assessments are read-only on mobile. Open Teacher Web to edit them.",
        },
      ]);
      return;
    }
    const errors = validateQuestionPayload(questionType, payload);
    if (errors.length > 0) {
      setSaveErrors(errors);
      return;
    }
    setSaveErrors([]);
    try {
      await saveItem.mutateAsync({
        id: itemId,
        data: {
          spaceId,
          storyPointId,
          type: "question",
          title,
          prompt,
          basePoints,
          difficulty,
          explanation,
          questionType,
          payload,
        },
      } as Record<string, unknown>);
      router.back();
    } catch {
      setSaveErrors([{ field: "_", message: "Save failed. Please try again." }]);
    }
  }

  const typeLabel = QT_LABELS[questionType] ?? questionType;
  const isChatAssessment = questionType === "chat_agent_question";
  const globalError = saveErrors.find((e) => e.field === "_");

  return (
    <View className="bg-canvas flex-1">
      <View className="bg-surface border-border-subtle flex-row items-center gap-3 border-b px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-display text-text-primary text-lg font-bold">
            {itemId ? "Edit item" : "New item"}
          </Text>
          <Text className="text-text-muted text-xs">{typeLabel}</Text>
        </View>
        <Button
          variant="primary"
          size="sm"
          loading={saveItem.isPending}
          disabled={isChatAssessment}
          onPress={() => void handleSave()}
        >
          {isChatAssessment ? "Web only" : "Save"}
        </Button>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {globalError && (
          <View className="bg-error-subtle border-error rounded-md border px-3 py-2">
            <Text className="text-error text-sm">{globalError.message}</Text>
          </View>
        )}

        {isChatAssessment ? (
          <Card className="gap-2 border-amber-300 bg-amber-50">
            <Text className="text-text-primary font-semibold">Read-only chat-agent assessment</Text>
            <Text className="text-text-secondary text-sm">
              Mobile cannot safely edit the public/private assessment split. Use Teacher Web to
              change this item; no changes from this screen will be saved.
            </Text>
          </Card>
        ) : (
          <>
            <CommonItemFields
              title={title}
              onTitleChange={setTitle}
              prompt={prompt}
              onPromptChange={setPrompt}
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              basePoints={basePoints}
              onPointsChange={setBasePoints}
              explanation={explanation}
              onExplanationChange={setExplanation}
            />

            <Divider />

            <View className="gap-3">
              <Text className="font-display text-text-primary text-base font-semibold">
                {typeLabel} settings
              </Text>
              <QuestionPayloadEditor
                questionType={questionType}
                payload={payload}
                onChange={setPayload}
              />
            </View>
          </>
        )}

        {saveErrors.filter((e) => e.field !== "_").length > 0 && (
          <Card className="gap-1 border-red-200 bg-red-50">
            <Text className="text-error text-sm font-semibold">Please fix these issues:</Text>
            {saveErrors
              .filter((e) => e.field !== "_")
              .map((e, i) => (
                <Text key={i} className="text-error text-xs">
                  • {e.message}
                </Text>
              ))}
          </Card>
        )}

        <Button
          variant="primary"
          block
          loading={saveItem.isPending}
          disabled={isChatAssessment}
          onPress={() => void handleSave()}
        >
          {isChatAssessment ? "Edit in Teacher Web" : itemId ? "Save changes" : "Create item"}
        </Button>
      </ScrollView>
    </View>
  );
}
