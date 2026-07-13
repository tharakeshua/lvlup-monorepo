import { useEffect, useRef } from "react";
import MetricsService from "../../services/metrics/MetricsService";

export function useTrackItemView(courseId?: string, itemId?: string, userId?: string | null) {
  const didRun = useRef(false);
  useEffect(() => {
    if (!itemId) return;
    if (didRun.current) return;
    didRun.current = true;
    void MetricsService.trackItemView({ courseId, itemId, userId });
  }, [courseId, itemId, userId]);
}

export default useTrackItemView;
