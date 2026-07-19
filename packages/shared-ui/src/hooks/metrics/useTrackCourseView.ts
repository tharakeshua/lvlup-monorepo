import { useEffect, useRef } from "react";
import MetricsService from "../../services/metrics/MetricsService";

export function useTrackCourseView(courseId?: string, userId?: string | null) {
  const didRun = useRef(false);
  useEffect(() => {
    if (!courseId) return;
    if (didRun.current) return;
    didRun.current = true;
    void MetricsService.trackCourseView({ courseId, userId });
  }, [courseId, userId]);
}

export default useTrackCourseView;
