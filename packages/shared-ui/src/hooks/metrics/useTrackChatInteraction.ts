import { useCallback } from "react";
import MetricsService from "../../services/metrics/MetricsService";

export function useTrackChatInteraction(
  courseId?: string,
  storyPointId?: string,
  itemId?: string,
  userId?: string | null
) {
  const trackChat = useCallback(async () => {
    if (!itemId || !userId) return;
    await MetricsService.trackChatInteraction({ courseId, storyPointId, itemId, userId });
  }, [courseId, storyPointId, itemId, userId]);
  return { trackChat };
}

export default useTrackChatInteraction;
