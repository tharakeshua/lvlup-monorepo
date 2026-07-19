/**
 * Dev-only route for eyeballing / screenshotting Surface H (attempt history) and
 * the Surface I discuss chrome. Not linked from any user flow — open directly at
 * /dev/history-preview. Owned by W5 (AIQ discuss/history); renders the kit from
 * src/components/ai-question/history.
 */
import { HistoryDiscussPreview } from "../../components/ai-question/history/preview";

export default function HistoryPreviewRoute() {
  return <HistoryDiscussPreview />;
}
