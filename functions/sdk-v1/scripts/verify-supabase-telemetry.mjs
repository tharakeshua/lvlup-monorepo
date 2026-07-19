#!/usr/bin/env node
/**
 * Production-safe Supabase telemetry smoke test.
 *
 * It writes one metadata-only logical request and provider attempt, finalizes
 * the request, reads both rows back, and deletes the synthetic request (the
 * attempt cascades). No prompt, response, answer, or media data is sent.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim();
  }
}

loadEnvFile(resolve("functions/sdk-v1/.env.lvlup-ff6fa"));

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Keep the service-role key in the process environment or Firebase Secret Manager."
  );
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function rest(path, init = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  const body = await response.text();
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(body);
      message = `${parsed.code ?? "SUPABASE_ERROR"}: ${parsed.message ?? message}`;
    } catch {
      // Keep the status-only message; never print credentials or response dumps.
    }
    throw new Error(message);
  }
  return body ? JSON.parse(body) : null;
}

const requestId = randomUUID();
const attemptId = randomUUID();
const now = new Date().toISOString();
const pricingVersion = "smoke-test-v1";

try {
  await rest("llm_requests", {
    method: "POST",
    body: JSON.stringify({
      id: requestId,
      schema_version: 2,
      root_request_id: requestId,
      trace_id: requestId,
      tenant_id: "__telemetry_smoke__",
      actor_user_id: "__system__",
      billing_user_id: "__system__",
      actor_role: "system",
      purpose: "other",
      feature: "other",
      operation: "telemetry.smoke",
      prompt_key: "smoke",
      prompt_version: "1",
      resource_type: "smoke_test",
      resource_id: requestId,
      provider: "stub",
      requested_model: "stub",
      credential_owner: "platform",
      status: "reserved",
      pricing_version: pricingVersion,
      created_at: now,
    }),
  });

  await rest("llm_call_attempts", {
    method: "POST",
    body: JSON.stringify({
      id: attemptId,
      schema_version: 2,
      request_id: requestId,
      root_request_id: requestId,
      trace_id: requestId,
      attempt_number: 1,
      tenant_id: "__telemetry_smoke__",
      actor_user_id: "__system__",
      billing_user_id: "__system__",
      actor_role: "system",
      purpose: "other",
      feature: "other",
      operation: "telemetry.smoke",
      prompt_key: "smoke",
      prompt_version: "1",
      resource_type: "smoke_test",
      resource_id: requestId,
      provider: "stub",
      model: "stub",
      status: "success",
      retryable: false,
      tokens: { input: 1, output: 1, total: 2, source: "estimated" },
      cost: {
        inputUsd: 0,
        outputUsd: 0,
        estimatedTotalUsd: 0,
        currency: "USD",
        pricingVersion,
      },
      timing: { providerLatencyMs: 1, totalAttemptMs: 1 },
      created_at: now,
      completed_at: now,
    }),
  });

  await rest(`llm_requests?id=eq.${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "succeeded",
      resolved_model: "stub",
      attempt_count: 1,
      successful_attempt_id: attemptId,
      token_usage: { input: 1, output: 1, total: 2, source: "estimated" },
      estimated_cost_usd: 0,
      latency_ms: 1,
      completed_at: now,
    }),
  });

  const [requests, attempts] = await Promise.all([
    rest(`llm_requests?id=eq.${requestId}&select=id,status,attempt_count`),
    rest(`llm_call_attempts?request_id=eq.${requestId}&select=id,status,attempt_number`),
  ]);
  if (
    requests?.length !== 1 ||
    requests[0]?.status !== "succeeded" ||
    attempts?.length !== 1 ||
    attempts[0]?.status !== "success"
  ) {
    throw new Error("Telemetry rows were not readable after write/finalize.");
  }

  console.log("Supabase LLM telemetry smoke test passed.");
} finally {
  await rest(`llm_requests?id=eq.${requestId}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch(() => undefined);
}
