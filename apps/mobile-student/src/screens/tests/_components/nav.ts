/**
 * Navigation helpers for the tests lane.
 *
 * The shell lane owns `src/lib/routes.ts` (the builder map) and the expo-router
 * file tree; screens navigate via `useRouter().push(routes.x())` and read params
 * with `useLocalSearchParams()`. Dynamic param keys (confirmed with M-shell):
 * `storyPointId` (tests) and `examId` (exam results) — tests are keyed by
 * storyPointId, NOT a sessionId.
 */
import { useLocalSearchParams, useRouter } from "expo-router";

import { routes } from "../../../lib/routes";

export interface TestNav {
  toTests: () => void;
  toGate: (storyPointId: string) => void;
  toRun: (storyPointId: string) => void;
  toResults: (storyPointId: string) => void;
  toAnalytics: (storyPointId: string) => void;
  toExamResults: (examId: string) => void;
  back: () => void;
}

export function useTestNav(): TestNav {
  const router = useRouter();
  return {
    toTests: () => router.push(routes.tests()),
    toGate: (id) => router.push(routes.testGate(id)),
    toRun: (id) => router.push(routes.testRun(id)),
    toResults: (id) => router.push(routes.testResults(id)),
    toAnalytics: (id) => router.push(routes.testAnalytics(id)),
    toExamResults: (id) => router.push(routes.examResults(id)),
    back: () => (router.canGoBack() ? router.back() : router.push(routes.tests())),
  };
}

/** Read the `storyPointId` (+ optional `spaceId`) the tests routes carry. */
export function useStoryPointParams(): { storyPointId: string; spaceId?: string } {
  const params = useLocalSearchParams<{ storyPointId?: string; spaceId?: string }>();
  return { storyPointId: params.storyPointId ?? "", spaceId: params.spaceId };
}

/** Read the `examId` the exam-results route carries. */
export function useExamParams(): { examId: string } {
  const params = useLocalSearchParams<{ examId?: string }>();
  return { examId: params.examId ?? "" };
}
