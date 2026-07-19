import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LlmAttemptRecord,
  LlmRequestFinalization,
  LlmRequestRecord,
  LlmTelemetrySink,
} from "@levelup/ai";

type SupabaseResult = PromiseLike<{ error: { message: string } | null }>;

function requestRow(record: LlmRequestRecord): Record<string, unknown> {
  return {
    id: record.requestId,
    schema_version: record.schemaVersion,
    root_request_id: record.rootRequestId,
    parent_request_id: record.parentRequestId ?? null,
    trace_id: record.traceId,
    tenant_id: record.tenantId,
    actor_user_id: record.actorUserId,
    initiated_by_user_id: record.initiatedByUserId ?? null,
    subject_user_id: record.subjectUserId ?? null,
    billing_user_id: record.billingUserId ?? null,
    actor_role: record.actorRole,
    initiator_role: record.initiatorRole ?? null,
    purpose: record.purpose,
    feature: record.feature,
    operation: record.operation,
    prompt_key: record.promptKey,
    prompt_version: record.promptVersion,
    agent_id: record.agentId ?? null,
    resource_type: record.resourceType,
    resource_id: record.resourceId,
    related_resources: record.related,
    provider: record.provider,
    requested_model: record.requestedModel,
    credential_owner: record.credentialOwner,
    status: record.status,
    pricing_version: record.pricingVersion,
    created_at: record.createdAt,
  };
}

function attemptRow(record: LlmAttemptRecord): Record<string, unknown> {
  return {
    id: record.attemptId,
    schema_version: record.schemaVersion,
    request_id: record.requestId,
    root_request_id: record.rootRequestId,
    trace_id: record.traceId,
    attempt_number: record.attemptNumber,
    tenant_id: record.tenantId,
    actor_user_id: record.actorUserId,
    initiated_by_user_id: record.initiatedByUserId ?? null,
    subject_user_id: record.subjectUserId ?? null,
    billing_user_id: record.billingUserId ?? null,
    actor_role: record.actorRole,
    purpose: record.purpose,
    feature: record.feature,
    operation: record.operation,
    prompt_key: record.promptKey,
    prompt_version: record.promptVersion,
    agent_id: record.agentId ?? null,
    resource_type: record.resourceType,
    resource_id: record.resourceId,
    related_resources: record.related,
    provider: record.provider,
    model: record.model,
    provider_request_id: record.providerRequestId ?? null,
    status: record.status,
    retryable: record.retryable,
    tokens: record.tokens,
    cost: record.cost,
    provider_usage: record.providerUsage ?? null,
    timing: {
      providerLatencyMs: record.providerLatencyMs,
      totalAttemptMs: record.totalAttemptMs,
    },
    error: record.error ?? null,
    created_at: record.createdAt,
    completed_at: record.completedAt,
  };
}

function finalizationRow(record: LlmRequestFinalization): Record<string, unknown> {
  return {
    status: record.status,
    resolved_model: record.resolvedModel ?? null,
    attempt_count: record.attemptCount,
    successful_attempt_id: record.successfulAttemptId ?? null,
    token_usage: record.tokens,
    estimated_cost_usd: record.estimatedCostUsd,
    pricing_version: record.pricingVersion,
    latency_ms: record.latencyMs,
    error: record.error ?? null,
    completed_at: record.completedAt,
  };
}

async function assertWrite(result: SupabaseResult, operation: string): Promise<void> {
  const { error } = await result;
  if (error) throw new Error(`Supabase LLM telemetry ${operation} failed: ${error.message}`);
}

/**
 * Metadata-only Supabase adapter for the v2 request/attempt ledger. A failed
 * primary write is copied to the telemetry outbox when Supabase is reachable;
 * the error is still rethrown so the gateway's alert hook can report it.
 */
export function createSupabaseLlmTelemetrySink(client: SupabaseClient): LlmTelemetrySink {
  async function writeWithOutbox(
    operation: string,
    requestId: string,
    attemptId: string | undefined,
    payload: Record<string, unknown>,
    write: () => SupabaseResult
  ): Promise<void> {
    try {
      await assertWrite(write(), operation);
    } catch (error) {
      try {
        await assertWrite(
          client.from("llm_telemetry_outbox").insert({
            request_id: requestId,
            attempt_id: attemptId ?? null,
            event_type: operation,
            payload,
            last_error: "primary telemetry write failed",
          }),
          "outbox"
        );
      } catch {
        // The gateway alert hook remains the final delivery signal when the
        // database itself is unavailable.
      }
      throw error;
    }
  }

  return {
    async createRequest(record) {
      const row = requestRow(record);
      await writeWithOutbox("create_request", record.requestId, undefined, row, () =>
        client.from("llm_requests").insert(row)
      );
    },

    async recordAttempt(record) {
      const row = attemptRow(record);
      await writeWithOutbox("record_attempt", record.requestId, record.attemptId, row, () =>
        client.from("llm_call_attempts").insert(row)
      );
    },

    async finalizeRequest(record) {
      const row = finalizationRow(record);
      await writeWithOutbox("finalize_request", record.requestId, undefined, row, () =>
        client.from("llm_requests").update(row).eq("id", record.requestId)
      );
    },
  };
}

export const llmTelemetryRowMappers = {
  request: requestRow,
  attempt: attemptRow,
  finalization: finalizationRow,
};
