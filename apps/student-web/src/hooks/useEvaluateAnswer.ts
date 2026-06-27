import { useEvaluateAnswer as useEvaluateAnswerMutation } from "@levelup/query";
import { asSpaceId, asStoryPointId, asItemId } from "@levelup/domain";
import type { UnifiedEvaluationResult } from "@levelup/shared-types";

/**
 * Practice/quiz single-answer evaluation.
 *
 * Migrated to the `@levelup/query` `useEvaluateAnswer` mutation (callable
 * `v1.levelup.evaluateAnswer`). The query mutation resolves to the contract
 * envelope `{ evaluation, progressRecorded }`; this adapter UNWRAPS `.evaluation`
 * (a compact `StoredEvaluation`) so callers keep receiving a
 * `UnifiedEvaluationResult` — preserving the legacy signature/return shape that
 * `PracticeModePage` and `StoryPointViewerPage` (another lane) depend on.
 *
 * Note: the new contract drops the client-supplied `mode` (server defaults it)
 * and derives the tenant from the authenticated session, so `tenantId`/`mode`
 * params are accepted for signature compat but no longer forwarded.
 */
export function useEvaluateAnswer() {
  const mutation = useEvaluateAnswerMutation();

  const mutateAsync = async (params: {
    tenantId: string;
    spaceId: string;
    storyPointId: string;
    itemId: string;
    answer: unknown;
    mode: "practice" | "quiz";
  }): Promise<UnifiedEvaluationResult> => {
    const result = await mutation.mutateAsync({
      spaceId: asSpaceId(params.spaceId),
      storyPointId: asStoryPointId(params.storyPointId),
      itemId: asItemId(params.itemId),
      answer: params.answer,
    });
    return result.evaluation as unknown as UnifiedEvaluationResult;
  };

  return { ...mutation, mutateAsync };
}
