/**
 * P0-E pin: trigger registration paths must resolve through the SAME
 * `LVLUP_COLLECTION_PREFIX` source the repos use (repo-admin `collectionPrefix()`),
 * or deployed triggers listen on dead unprefixed roots while data lives at
 * `v2_tenants/…`. The prefix is baked at `makeTrigger` call time (deploy-time
 * discovery), so these tests re-import the module per env permutation.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { paths } from "@levelup/services/repo-admin";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function importAdapter() {
  return await import("./on-document.js");
}

describe("prefixTriggerDocument", () => {
  it("returns the document unchanged when no prefix is set (emulator/dev)", async () => {
    vi.stubEnv("LVLUP_COLLECTION_PREFIX", "");
    const { prefixTriggerDocument } = await importAdapter();
    expect(prefixTriggerDocument("tenants/{tenantId}/submissions/{submissionId}")).toBe(
      "tenants/{tenantId}/submissions/{submissionId}"
    );
  });

  it("prefixes ONLY the first path segment (subcollections inherit via the root)", async () => {
    vi.stubEnv("LVLUP_COLLECTION_PREFIX", "v2_");
    const { prefixTriggerDocument } = await importAdapter();
    expect(prefixTriggerDocument("tenants/{tenantId}/submissions/{submissionId}")).toBe(
      "v2_tenants/{tenantId}/submissions/{submissionId}"
    );
    expect(prefixTriggerDocument("users/{uid}/memberships/{tenantId}")).toBe(
      "v2_users/{uid}/memberships/{tenantId}"
    );
    expect(prefixTriggerDocument("tenants/{tenantId}")).toBe("v2_tenants/{tenantId}");
  });

  it("tolerates a leading slash", async () => {
    vi.stubEnv("LVLUP_COLLECTION_PREFIX", "v2_");
    const { prefixTriggerDocument } = await importAdapter();
    expect(prefixTriggerDocument("/tenants/{t}/exams/{e}")).toBe("v2_tenants/{t}/exams/{e}");
  });

  it("stays mirrored with repo-admin topLevel() — the ONE prefix source", async () => {
    vi.stubEnv("LVLUP_COLLECTION_PREFIX", "v2_");
    const { prefixTriggerDocument } = await importAdapter();
    // The first segment of a prefixed trigger path must equal the repo layer's
    // prefixed top-level collection name for the same root.
    expect(prefixTriggerDocument("tenants/{t}").split("/")[0]).toBe(paths.topLevel("tenants"));
    expect(prefixTriggerDocument("users/{uid}").split("/")[0]).toBe(paths.topLevel("users"));
  });
});

describe("makeTrigger registration", () => {
  it("bakes the prefixed document path into the deployed endpoint", async () => {
    vi.stubEnv("LVLUP_COLLECTION_PREFIX", "v2_");
    const { makeTrigger } = await importAdapter();
    const fn = makeTrigger(
      {
        document: "tenants/{tenantId}/submissions/{submissionId}",
        eventType: "updated",
        tenantParam: "tenantId",
      },
      async () => {}
    ) as unknown as {
      __endpoint: {
        eventTrigger: { eventFilterPathPatterns: { document: string } };
      };
    };
    expect(fn.__endpoint.eventTrigger.eventFilterPathPatterns.document).toBe(
      "v2_tenants/{tenantId}/submissions/{submissionId}"
    );
  });

  it("registers the verbatim path when unprefixed", async () => {
    vi.stubEnv("LVLUP_COLLECTION_PREFIX", "");
    const { makeTrigger } = await importAdapter();
    const fn = makeTrigger(
      { document: "tenants/{t}/exams/{e}", eventType: "created" },
      async () => {}
    ) as unknown as {
      __endpoint: { eventTrigger: { eventFilterPathPatterns: { document: string } } };
    };
    expect(fn.__endpoint.eventTrigger.eventFilterPathPatterns.document).toBe(
      "tenants/{t}/exams/{e}"
    );
  });
});
