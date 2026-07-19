/**
 * AnswerPartStack — renders an `AnswerPart[]` as the `.parts` column, dispatching
 * each part to the audio or image card by kind. W1's composer owns the stack
 * SHELL and may render this directly or map parts itself; W3 provides it so the
 * per-kind card content + upload/error states live in one place.
 */
import { View } from "react-native";

import { AudioPartCard } from "./AudioPartCard";
import { ImagePartCard } from "./ImagePartCard";
import type { AnswerPart } from "../../../components/ai-question/answer-bundle";

export interface AnswerPartStackProps {
  parts: AnswerPart[];
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onView?: (part: AnswerPart) => void;
  disabled?: boolean;
}

export function AnswerPartStack({
  parts,
  onRemove,
  onRetry,
  onView,
  disabled,
}: AnswerPartStackProps) {
  if (parts.length === 0) return null;
  let imageIndex = -1;
  return (
    <View className="gap-2">
      {parts.map((part) => {
        if (part.kind === "audio") {
          return (
            <AudioPartCard
              key={part.id}
              part={part}
              onRemove={onRemove}
              onRetry={onRetry}
              disabled={disabled}
            />
          );
        }
        imageIndex += 1;
        return (
          <ImagePartCard
            key={part.id}
            part={part}
            index={imageIndex}
            onRemove={onRemove}
            onRetry={onRetry}
            onView={onView}
            disabled={disabled}
          />
        );
      })}
    </View>
  );
}
