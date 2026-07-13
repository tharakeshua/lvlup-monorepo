import { useCallback } from "react";
import MetricsService from "../../services/metrics/MetricsService";

export function useTrackQuestionSubmission(
  courseId?: string,
  storyPointId?: string,
  itemId?: string,
  userId?: string | null
) {
  const trackSubmit = useCallback(
    async (isCorrect?: boolean) => {
      if (!itemId) return;
      await MetricsService.trackQuestionSubmitted({ courseId, storyPointId, itemId, userId });
      if (isCorrect === true) {
        await MetricsService.trackQuestionCompleted({ courseId, itemId, userId });
      } else if (isCorrect === false) {
        await MetricsService.trackWrongSubmission({ courseId, itemId, userId });
      }
    },
    [courseId, storyPointId, itemId, userId]
  );

  return { trackSubmit };
}

export default useTrackQuestionSubmission;
