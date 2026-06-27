/**
 * `logLLMCall` — append-only audit write of one LLM call to `llmCallLogs`
 * (server-shared.md §4.4). This is the cost-rollup source that the analytics
 * `aggregateDailyCost` scheduler reads. Writes go through `repos.llm` (the admin
 * adapter), NEVER `firebase-admin` directly (principle 3). Logging is best-effort:
 * an audit-write failure must not fail the user's AI call, but it is surfaced.
 */
import type { TenantId, UserId, ExamId, SpaceId } from "@levelup/domain";
import type { AiRepos, LogLlmCallParams } from "../repos-seam.js";
import type { CostBreakdown, TokenUsage } from "./cost-tracker.js";

export interface LogLLMCallParams {
  tenantId: TenantId;
  /** The calling capability, e.g. 'extractQuestions' / 'gradeQuestion'. */
  functionName: string;
  model: string;
  usage: TokenUsage;
  cost: CostBreakdown;
  latencyMs: number;
  status: "success" | "error";
  errorMessage?: string;
  userId?: UserId;
  examId?: ExamId;
  spaceId?: SpaceId;
}

export async function logLLMCall(repos: AiRepos, params: LogLLMCallParams): Promise<void> {
  const record: LogLlmCallParams = {
    tenantId: params.tenantId,
    functionName: params.functionName,
    model: params.model,
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
    totalTokens: params.usage.totalTokens,
    costUSD: params.cost.totalCostUsd,
    latencyMs: params.latencyMs,
    status: params.status,
    ...(params.errorMessage !== undefined ? { errorMessage: params.errorMessage } : {}),
    ...(params.userId !== undefined ? { userId: params.userId } : {}),
    ...(params.examId !== undefined ? { examId: params.examId } : {}),
    ...(params.spaceId !== undefined ? { spaceId: params.spaceId } : {}),
  };
  await repos.llm.log(record);
}
