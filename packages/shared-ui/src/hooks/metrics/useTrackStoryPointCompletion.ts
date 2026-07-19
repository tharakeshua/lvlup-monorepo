import { useEffect, useRef } from "react";
import MetricsService from "../../services/metrics/MetricsService";

export function useTrackStoryPointCompletion(
  status?: "not_started" | "in_progress" | "completed",
  courseId?: string,
  storyPointId?: string,
  userId?: string | null
) {
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!storyPointId || !status) return;
    if (last.current === status) return;
    // Detect transition to completed
    if (status === "completed") {
      void MetricsService.trackStoryPointCompleted({ courseId, storyPointId, userId });
    }
    last.current = status;
  }, [status, courseId, storyPointId, userId]);
}

export default useTrackStoryPointCompletion;
