import { useEffect, useRef } from "react";
import MetricsService from "../../services/metrics/MetricsService";

export function useTrackStoryPointView(
  courseId?: string,
  storyPointId?: string,
  userId?: string | null
) {
  const didRun = useRef(false);
  useEffect(() => {
    if (!storyPointId) return;
    if (didRun.current) return;
    didRun.current = true;
    void MetricsService.trackStoryPointView({ courseId, storyPointId, userId });
  }, [courseId, storyPointId, userId]);
}

export default useTrackStoryPointView;
