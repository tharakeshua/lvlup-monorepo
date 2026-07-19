/**
 * Server-only Supabase client used by the LLM telemetry persistence adapter.
 *
 * The product continues to authenticate users with Firebase. Supabase is a
 * backend data store for telemetry, so this client deliberately does not persist
 * or refresh Supabase Auth sessions and requires the service-role key. Never
 * import this module from a browser/mobile package.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseServerConfig {
  url: string;
  serviceRoleKey: string;
}

export interface CreateSupabaseServerClientOptions {
  env?: NodeJS.ProcessEnv;
  config?: SupabaseServerConfig;
}

let singleton: SupabaseClient | undefined;

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(
      `Missing ${name}. Configure it only in the server runtime; never expose the service-role key to a client bundle.`
    );
  }
  return normalized;
}

export function resolveSupabaseServerConfig(
  env: NodeJS.ProcessEnv = process.env
): SupabaseServerConfig {
  const url = required(env["SUPABASE_URL"], "SUPABASE_URL");
  const serviceRoleKey = required(env["SUPABASE_SERVICE_ROLE_KEY"], "SUPABASE_SERVICE_ROLE_KEY");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("SUPABASE_URL must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("SUPABASE_URL must use HTTPS.");
  }

  return { url: parsed.toString().replace(/\/$/, ""), serviceRoleKey };
}

export function isSupabaseTelemetryConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env["SUPABASE_URL"]?.trim() && env["SUPABASE_SERVICE_ROLE_KEY"]?.trim());
}

export function createSupabaseServerClient(
  options: CreateSupabaseServerClientOptions = {}
): SupabaseClient {
  const config = options.config ?? resolveSupabaseServerConfig(options.env);

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "auto-levelup-llm-telemetry",
      },
    },
  });
}

/** Lazily create one connection-safe client per Cloud Functions process. */
export function getSupabaseServerClient(
  options: CreateSupabaseServerClientOptions = {}
): SupabaseClient {
  singleton ??= createSupabaseServerClient(options);
  return singleton;
}

/** Test-only reset for process-global client state. */
export function resetSupabaseServerClientForTesting(): void {
  singleton = undefined;
}
