import { afterEach, describe, expect, it } from "vitest";
import {
  createSupabaseServerClient,
  isSupabaseTelemetryConfigured,
  resolveSupabaseServerConfig,
  resetSupabaseServerClientForTesting,
} from "./client.js";

afterEach(() => {
  resetSupabaseServerClientForTesting();
});

describe("Supabase server client", () => {
  it("resolves and normalizes server-only configuration", () => {
    expect(
      resolveSupabaseServerConfig({
        SUPABASE_URL: "https://project.supabase.co/",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      })
    ).toEqual({
      url: "https://project.supabase.co",
      serviceRoleKey: "service-role",
    });
  });

  it("does not consider a publishable key sufficient for telemetry writes", () => {
    expect(
      isSupabaseTelemetryConfigured({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "publishable",
      })
    ).toBe(false);
  });

  it("fails closed when the service-role key is missing", () => {
    expect(() =>
      resolveSupabaseServerConfig({
        SUPABASE_URL: "https://project.supabase.co",
      })
    ).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("rejects non-HTTPS endpoints", () => {
    expect(() =>
      resolveSupabaseServerConfig({
        SUPABASE_URL: "http://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      })
    ).toThrow("must use HTTPS");
  });

  it("creates a sessionless server client", () => {
    const client = createSupabaseServerClient({
      config: {
        url: "https://project.supabase.co",
        serviceRoleKey: "service-role",
      },
    });

    expect(client).toBeDefined();
    expect(client.from).toBeTypeOf("function");
  });
});
