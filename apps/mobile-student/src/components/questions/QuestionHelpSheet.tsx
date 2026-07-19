/**
 * Question-scoped guidance. This deliberately owns no answer state: callers
 * provide a read-only draft snapshot, and closing it returns to the same draft
 * without submitting/evaluating/progress-writing anything.
 */
import { useCallback, useMemo } from "react";
import { Text, View } from "react-native";

import {
  useConversationController,
  useConversationOperations,
  type ConversationContext,
  type QuestionHelpDraftSnapshot,
} from "../../features/conversation";
import { Sheet } from "../overlays";
import { ConversationScaffold } from "../conversation";
import { Icon } from "../Icon";
import { colors } from "../../theme";

export interface QuestionHelpSheetProps {
  open: boolean;
  onClose: () => void;
  spaceId?: string;
  storyPointId?: string;
  itemId?: string;
  itemTitle?: string;
  draft: unknown;
  draftRevision: number;
}

function validContext(
  spaceId?: string,
  storyPointId?: string,
  itemId?: string
): ConversationContext | undefined {
  if (!spaceId || !storyPointId || !itemId) return undefined;
  return { kind: "question_help", spaceId, storyPointId, itemId };
}

function asDraftJson(value: unknown): QuestionHelpDraftSnapshot["answer"] | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const items = value.map(asDraftJson);
    return items.every((item) => item !== undefined) ? items : undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const output: Record<string, QuestionHelpDraftSnapshot["answer"]> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const json = asDraftJson(entry);
    if (json === undefined) return undefined;
    output[key] = json;
  }
  return output;
}

export function QuestionHelpSheet({
  open,
  onClose,
  spaceId,
  storyPointId,
  itemId,
  itemTitle,
  draft,
  draftRevision,
}: QuestionHelpSheetProps) {
  const operations = useConversationOperations();
  const context = useMemo(
    () => validContext(spaceId, storyPointId, itemId),
    [itemId, spaceId, storyPointId]
  );
  // Hook rules require a stable object even before an item context is available;
  // auto-start remains false in that state and the invalid-context notice is shown.
  const safeContext = context ?? {
    kind: "question_help" as const,
    spaceId: "",
    storyPointId: "",
    itemId: "",
  };
  const getDraft = useCallback(
    () => ({ revision: draftRevision, answer: asDraftJson(draft) ?? null }),
    [draft, draftRevision]
  );
  const controller = useConversationController({
    mode: "question_help",
    context: safeContext,
    operations,
    autoStart: open && Boolean(context),
    getQuestionHelpDraft: getDraft,
  });

  return (
    <Sheet open={open} onClose={onClose} title="Question help" className="max-h-[92%]">
      {context ? (
        <ConversationScaffold
          controller={controller}
          mode="question_help"
          title="Work it through"
          contextLabel={itemTitle ? `Guidance for ${itemTitle}` : "Guidance for this question"}
          publicConfig={{}}
          onClose={onClose}
          compact
        />
      ) : (
        <View className="items-center gap-2 py-8">
          <Icon name="triangle-alert" size={24} color={colors.warning} />
          <Text className="font-display text-text-primary text-base">
            Question context unavailable
          </Text>
          <Text className="font-ui text-text-muted px-5 text-center text-sm">
            Return to the lesson and open help from a question with a valid learning context.
          </Text>
        </View>
      )}
    </Sheet>
  );
}
