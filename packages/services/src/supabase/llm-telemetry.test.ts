import { describe, expect, it } from "vitest";
import type { LlmAttemptRecord, LlmRequestFinalization, LlmRequestRecord } from "@levelup/ai";
import { llmTelemetryRowMappers } from "./llm-telemetry.js";

const request: LlmRequestRecord = {
  schemaVersion: 2,
  requestId: "00000000-0000-4000-8000-000000000001",
  rootRequestId: "00000000-0000-4000-8000-000000000001",
  traceId: "trace-1",
  tenantId: "tenant-1",
  actorUserId: "<system>",
  initiatedByUserId: "teacher-1",
  subjectUserId: "student-1",
  billingUserId: "student-1",
  actorRole: "system",
  initiatorRole: "teacher",
  purpose: "answer_grading",
  feature: "autograde.answer_sheet",
  operation: "answer.grade",
  promptKey: "answerGrading",
  promptVersion: "answerGrading:1",
  resourceType: "questionSubmission",
  resourceId: "qs-1",
  related: { examId: "exam-1", submissionId: "sub-1", questionId: "question-1" },
  provider: "gemini",
  requestedModel: "gemini-2.5-pro",
  credentialOwner: "tenant",
  status: "reserved",
  pricingVersion: "pricing-1",
  createdAt: "2026-07-18T12:00:00.000Z",
};

describe("Supabase LLM telemetry row mapping", () => {
  it("maps request metadata to the migration's snake_case columns", () => {
    expect(llmTelemetryRowMappers.request(request)).toMatchObject({
      id: request.requestId,
      tenant_id: "tenant-1",
      actor_user_id: "<system>",
      initiated_by_user_id: "teacher-1",
      subject_user_id: "student-1",
      billing_user_id: "student-1",
      related_resources: {
        examId: "exam-1",
        submissionId: "sub-1",
        questionId: "question-1",
      },
    });
  });

  it("stores only bounded usage/cost metadata for attempts", () => {
    const attempt: LlmAttemptRecord = {
      ...request,
      attemptId: "00000000-0000-4000-8000-000000000002",
      attemptNumber: 1,
      model: "gemini-2.5-pro",
      status: "success",
      retryable: false,
      tokens: { input: 100, output: 20, total: 120, source: "provider" },
      cost: {
        inputUsd: 0.001,
        outputUsd: 0.002,
        estimatedTotalUsd: 0.003,
        currency: "USD",
        pricingVersion: "pricing-1",
      },
      providerLatencyMs: 120,
      totalAttemptMs: 125,
      completedAt: "2026-07-18T12:00:00.125Z",
    };
    const row = llmTelemetryRowMappers.attempt(attempt);

    expect(row).toMatchObject({
      id: attempt.attemptId,
      request_id: request.requestId,
      tokens: attempt.tokens,
      cost: attempt.cost,
      timing: { providerLatencyMs: 120, totalAttemptMs: 125 },
    });
    expect(row).not.toHaveProperty("prompt");
    expect(row).not.toHaveProperty("response");
    expect(row).not.toHaveProperty("answer");
  });

  it("maps terminal request state independently from the immutable attempt ledger", () => {
    const finalization: LlmRequestFinalization = {
      requestId: request.requestId,
      status: "succeeded",
      resolvedModel: "gemini-2.5-pro",
      attemptCount: 1,
      successfulAttemptId: "00000000-0000-4000-8000-000000000002",
      tokens: { input: 100, output: 20, total: 120, source: "provider" },
      estimatedCostUsd: 0.003,
      pricingVersion: "pricing-1",
      latencyMs: 130,
      completedAt: "2026-07-18T12:00:00.130Z",
    };

    expect(llmTelemetryRowMappers.finalization(finalization)).toMatchObject({
      status: "succeeded",
      attempt_count: 1,
      successful_attempt_id: finalization.successfulAttemptId,
      estimated_cost_usd: 0.003,
    });
  });
});
