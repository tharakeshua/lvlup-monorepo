/**
 * `answer-media` upload kind — the STUDENT-usable Storage grant for attaching
 * audio/image answer media to a levelup item (W3 MEDIA seam). This is the ONLY
 * `requestUploadUrl` kind a learner is authorized for; the authoring/scanner
 * kinds (item-media / content-source / answer-sheet) deny a student, which is
 * exactly why captured media never reached the grader before (live Issue4b).
 *
 * Proves: (1) a student gets a grant + a uid-scoped path under the item;
 * (2) audio content-types resolve to an in-table extension (round-trips through
 * the server's `guessMediaMime`); (3) a non-student (teacher) is PERMISSION_DENIED;
 * (4) spaceId + itemId are required.
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { localSeedId } from "../../../../tests/sdk/harness/fixtures-ids";
import { requestUploadUrlService } from "./request-upload-url";

const spaceId = localSeedId("space", "dsa");
const itemId = localSeedId("item", "arrays.q1");

describe("requestUploadUrl · answer-media (student answer media)", () => {
  it("grants a student a uid-scoped path under the item's answers/ prefix", async () => {
    const ctx = makeAuthContext("student");
    const res = await requestUploadUrlService(
      { kind: "answer-media", spaceId, itemId, contentType: "image/jpeg" },
      ctx
    );
    const prefix = `tenants/${ctx.tenantId}/spaces/${spaceId}/items/${itemId}/answers/${ctx.uid}/`;
    expect(res.path.startsWith(prefix)).toBe(true);
    expect(res.path.endsWith(".jpg")).toBe(true);
    expect(typeof res.uploadUrl).toBe("string");
    expect(res.uploadUrl.length).toBeGreaterThan(0);
  });

  it("gives an audio content-type an in-table extension (server mime round-trip)", async () => {
    const ctx = makeAuthContext("student");
    const res = await requestUploadUrlService(
      { kind: "answer-media", spaceId, itemId, contentType: "audio/mp4" },
      ctx
    );
    // .m4a → server guessMediaMime → audio/mp4 (never mis-tagged as image/jpeg).
    expect(res.path.endsWith(".m4a")).toBe(true);
  });

  it("⚷ denies a non-student (teacher) — answer media is learner-self only", async () => {
    const ctx = makeAuthContext("teacher");
    await expect(
      requestUploadUrlService(
        { kind: "answer-media", spaceId, itemId, contentType: "image/jpeg" },
        ctx
      )
    ).rejects.toBeDefined();
  });

  it("requires spaceId and itemId", async () => {
    const ctx = makeAuthContext("student");
    await expect(
      requestUploadUrlService({ kind: "answer-media", itemId, contentType: "image/jpeg" }, ctx)
    ).rejects.toBeDefined();
    await expect(
      requestUploadUrlService({ kind: "answer-media", spaceId, contentType: "image/jpeg" }, ctx)
    ).rejects.toBeDefined();
  });
});
