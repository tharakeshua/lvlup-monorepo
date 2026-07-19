/**
 * ai-question/history — Surface H (attempt history) barrel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * W1 WIRING CONTRACT (replaces the ContentViewerScreen inline history block):
 *
 *   import { AttemptHistorySheet } from "../../components/ai-question/history";
 *
 *   const [historyOpen, setHistoryOpen] = useState(false);
 *   const entry = progress?.items?.[itemId];   // StoryPointProgressView.items[itemId]
 *
 *   <AttemptHistorySheet
 *     open={historyOpen}
 *     onClose={() => setHistoryOpen(false)}
 *     entry={entry}
 *     promptText={itemPrompt}                  // the question prompt/title
 *     onTryAgain={() => { setHistoryOpen(false); resetComposerToLastAnswer(); }}
 *   />
 *
 * The "History" button just calls setHistoryOpen(true). The sheet owns list↔detail
 * state internally. For an INLINE (non-sheet) presentation, mount <AttemptHistory>
 * directly with the same `entry`.
 *
 * DATA REALITY: the backend currently persists a single best-score evaluation per
 * item (no attempts[] — see model.ts). AttemptHistory renders attempts[] when
 * present and degrades to one "best result" row otherwise. Tracked backend
 * follow-up: append AttemptRecord[] in repo-admin/progress.ts applyUpdates().
 * ─────────────────────────────────────────────────────────────────────────────
 */
export { AttemptHistory, type AttemptHistoryProps } from "./AttemptHistory";
export { AttemptDetail, type AttemptDetailProps } from "./AttemptDetail";
export { AttemptHistorySheet, type AttemptHistorySheetProps } from "./AttemptHistorySheet";
export {
  buildAttemptHistory,
  verdictOf,
  evaluationToFeedback,
  answerToText,
  type AttemptRow,
  type AttemptHistoryModel,
  type ItemProgressEntryLike,
  type AttemptRecordLike,
  type StoredEvaluationLike,
} from "./model";
