/**
 * Dev-only route for eyeballing / screenshotting Surface G (feedback result).
 * Not linked from any user flow — open directly at /dev/feedback-preview
 * (optionally ?state=partial|correct|incorrect|legacy). Owned by W2 (AIQ
 * feedback); renders the kit from src/components/ai-question/feedback.
 */
import { useLocalSearchParams } from "expo-router";

import { FeedbackPreview } from "../../components/ai-question/feedback/preview";

export default function FeedbackPreviewRoute() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  return <FeedbackPreview state={typeof state === "string" ? state : "all"} />;
}
