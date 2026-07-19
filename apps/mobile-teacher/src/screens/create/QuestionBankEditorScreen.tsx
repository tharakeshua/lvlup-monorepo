/**
 * QuestionBankEditorScreen — create or edit a question bank item.
 *
 * Route params: bankItemId? (edit mode — no param = create)
 *
 * Create mode shows the 15-type picker first (same pattern as ItemEditorScreen).
 * Once a type is chosen, shows all fields + QuestionPayloadEditor.
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  QUESTION_TYPES,
  initialQuestionPayload,
  useSaveQuestionBankItem,
  validateQuestionPayload,
  type QuestionType,
} from "@levelup/query";

import { Button, Card, Divider, Icon, Screen, TextField } from "../../components";
import { QuestionPayloadEditor } from "../../components/item-editor";
import { colors } from "../../theme";

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

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_OPTIONS: { label: string; value: Difficulty }[] = [
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
];

function TypePicker({ onSelect }: { onSelect: (qt: QuestionType) => void }) {
  return (
    <Screen contentClassName="gap-3">
      <Text className="font-display text-text-primary text-xl font-bold">Choose question type</Text>
      <Text className="text-text-muted text-sm">Select the type to add to the bank.</Text>
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
          Author these in Teacher Web; mobile question-bank editing deliberately does not save a
          partial public/private assessment schema.
        </Text>
      </Card>
    </Screen>
  );
}

export default function QuestionBankEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bankItemId?: string; itemId?: string }>();
  const bankItemId =
    (typeof params.bankItemId === "string" && params.bankItemId ? params.bankItemId : null) ??
    (typeof params.itemId === "string" && params.itemId ? params.itemId : null) ??
    undefined;

  const [questionType, setQuestionType] = useState<QuestionType | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [basePoints, setBasePoints] = useState("1");
  const [explanation, setExplanation] = useState("");
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [saveErrors, setSaveErrors] = useState<{ field: string; message: string }[]>([]);

  const save = useSaveQuestionBankItem();

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
    if (!title.trim()) {
      setSaveErrors([{ field: "title", message: "Title is required." }]);
      return;
    }
    const payloadErrors = validateQuestionPayload(questionType, payload);
    if (payloadErrors.length > 0) {
      setSaveErrors(payloadErrors);
      return;
    }
    setSaveErrors([]);
    try {
      await save.mutateAsync({
        id: bankItemId,
        data: {
          questionType,
          title: title.trim(),
          content: content.trim() || undefined,
          subject: subject.trim() || undefined,
          difficulty,
          basePoints: Number(basePoints) || 1,
          explanation: explanation.trim() || undefined,
          questionData: payload,
        },
      } as Record<string, unknown>);
      router.back();
    } catch {
      setSaveErrors([{ field: "_", message: "Save failed. Please try again." }]);
    }
  }

  const isEditing = !!bankItemId;

  if (!questionType) {
    return (
      <View className="flex-1">
        <View className="bg-surface border-border-subtle flex-row items-center gap-3 border-b px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Icon name="arrow-left" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text className="font-display text-text-primary flex-1 text-lg font-bold">
            {isEditing ? "Edit bank question" : "New bank question"}
          </Text>
        </View>
        <TypePicker
          onSelect={(qt) => {
            setQuestionType(qt);
            if (!bankItemId) setPayload(initialQuestionPayload(qt));
          }}
        />
      </View>
    );
  }

  const typeLabel = QT_LABELS[questionType] ?? questionType;
  const isChatAssessment = questionType === "chat_agent_question";
  const globalError = saveErrors.find((e) => e.field === "_");
  const titleError = saveErrors.find((e) => e.field === "title");

  return (
    <View className="bg-canvas flex-1">
      <View className="bg-surface border-border-subtle flex-row items-center gap-3 border-b px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-display text-text-primary text-lg font-bold">
            {isEditing ? "Edit bank question" : "New bank question"}
          </Text>
          <Text className="text-text-muted text-xs">{typeLabel}</Text>
        </View>
        <Button
          variant="primary"
          size="sm"
          loading={save.isPending}
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
              Question-bank mobile editing cannot preserve a chat assessment’s private answer key.
              Use Teacher Web instead; this screen will not save changes.
            </Text>
          </Card>
        ) : (
          <>
            <TextField
              label="Title"
              required
              value={title}
              onChangeText={setTitle}
              placeholder="Enter question title"
              error={titleError?.message}
            />

            <TextField
              label="Prompt / Content (optional)"
              value={content}
              onChangeText={setContent}
              placeholder="Additional question text or context"
              multiline
            />

            <TextField
              label="Subject (optional)"
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Mathematics, Biology"
            />

            <View className="gap-1.5">
              <Text className="font-ui text-text-secondary text-sm font-semibold">Difficulty</Text>
              <View className="flex-row gap-2">
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const active = difficulty === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setDifficulty(opt.value)}
                      className="flex-1 items-center rounded-lg border py-2"
                      style={{
                        borderColor: active ? colors.brand : colors.textMuted,
                        backgroundColor: active ? `${colors.brand}12` : "transparent",
                      }}
                    >
                      <Text
                        className="text-sm font-semibold"
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
              label="Base points"
              value={basePoints}
              onChangeText={setBasePoints}
              keyboardType="numeric"
              placeholder="1"
            />

            <TextField
              label="Explanation (optional)"
              value={explanation}
              onChangeText={setExplanation}
              placeholder="Explanation shown after answering"
              multiline
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

        {saveErrors.filter((e) => e.field !== "_" && e.field !== "title").length > 0 && (
          <Card className="gap-1 border-red-200 bg-red-50">
            <Text className="text-error text-sm font-semibold">Please fix these issues:</Text>
            {saveErrors
              .filter((e) => e.field !== "_" && e.field !== "title")
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
          loading={save.isPending}
          disabled={isChatAssessment}
          onPress={() => void handleSave()}
        >
          {isChatAssessment ? "Edit in Teacher Web" : isEditing ? "Save changes" : "Add to bank"}
        </Button>
      </ScrollView>
    </View>
  );
}
