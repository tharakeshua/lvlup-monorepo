/**
 * QuestionHelpSheet — Surface I ("Discuss" / "Talk it through").
 *
 * The always-available, help-not-submission tutor sheet. Opened from the AI
 * question top bar (the message-circle affordance, rendered by the host); this
 * component owns the SHEET CHROME and framing (the "help — not your submission"
 * guidance chip, the visible question context, and the draft-visibility banner),
 * then embeds W4's `ConversationScaffold` for the actual conversation mechanics.
 *
 * It deliberately owns no answer state: callers provide a read-only draft
 * snapshot, and closing returns to the same draft without submitting /
 * evaluating / progress-writing anything. The restyle is VISUAL ONLY — the
 * `useConversationController` logic and the scaffold's bubbles/composer are
 * untouched (`hideHeader` lets this sheet own the header cleanly).
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

/** Extract the free-text portion of a draft for a "the tutor can see…" count. */
function draftText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(draftText).join(" ");
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const text = o.text ?? o.answer ?? o.value ?? o.response;
    if (typeof text === "string") return text;
  }
  return "";
}

function wordCount(value: unknown): number {
  const words = draftText(value).trim();
  return words ? words.split(/\s+/).length : 0;
}

/** The sheet header: message-circle · "Talk it through" · help-not-submission chip. */
function DiscussHeader() {
  return (
    <View className="flex-row items-center gap-2">
      <Icon name="message-circle" size={18} color={colors.brand} />
      <Text className="font-display text-text-primary flex-1 text-base font-semibold">
        Talk it through
      </Text>
      <View className="bg-sky-500/12 rounded-pill flex-row items-center gap-1 px-2.5 py-1">
        <Icon name="info" size={12} color={colors.info} />
        <Text className="font-ui text-2xs font-semibold" style={{ color: colors.info }}>
          Help — not your submission
        </Text>
      </View>
    </View>
  );
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

  const words = useMemo(() => wordCount(draft), [draft]);

  return (
    <Sheet open={open} onClose={onClose} title={<DiscussHeader />} className="max-h-[88%]">
      {context ? (
        <View className="gap-3">
          {/* Question context stays visible — you never "leave" your work. */}
          {itemTitle ? (
            <View className="border-border-subtle flex-row items-center gap-2 border-b pb-3">
              <Text className="text-brand text-2xs tracking-caps font-mono uppercase">
                This question
              </Text>
              <Text className="font-display text-text-secondary flex-1 text-sm" numberOfLines={1}>
                {itemTitle}
              </Text>
            </View>
          ) : null}

          {/* Draft visibility — the tutor reasons over your current draft. */}
          <View className="border-border-subtle bg-surface-sunken flex-row items-center gap-2 rounded-md border px-3 py-2">
            <Icon name="eye" size={15} color={colors.brand} />
            <Text className="font-ui text-text-secondary flex-1 text-xs leading-5">
              {words > 0
                ? `The tutor can see your current draft (${words} ${words === 1 ? "word" : "words"}).`
                : "No draft yet — the tutor can see this question and will help you reason it out."}
            </Text>
          </View>

          <ConversationScaffold
            controller={controller}
            mode="question_help"
            hideHeader
            contextLabel={itemTitle ? `Guidance for ${itemTitle}` : "Guidance for this question"}
            publicConfig={{}}
            compact
          />
        </View>
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
