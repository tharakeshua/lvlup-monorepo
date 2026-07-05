/**
 * REGRESSION (Issue4b — "questions take audio/image as input AND evaluate").
 *
 * Issue4 let a learner attach an image/recording to an answer (normalized to
 * `{ text, mediaUrls }` client-side), but that media NEVER reached the grader:
 * the frontend runner passed only `answer`, and the backend `scoreOne` dropped
 * media entirely — so Gemini graded blind and audio/image answers were never
 * actually evaluated.
 *
 * This proves the wired path end-to-end at the service seam:
 *   1. evaluateAnswer — top-level `mediaUrls` (the contract field) is attached to
 *      the AI grading call as gateway `images` parts.
 *   2. recordItemAttempt — media riding INSIDE the `{ text, mediaUrls }` answer
 *      (the practice path, whose strict contract has no top-level field) is
 *      unwrapped and attached too.
 *   3. ⚷ a cross-tenant media path is rejected / dropped (never sent to the model).
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { localSeedId } from "../../../../tests/sdk/harness/fixtures-ids";
import { makeItem } from "../../../../tests/sdk/fakes/entity-factories";
import { evaluateAnswerService, recordItemAttemptService } from "../index";

/** The last generate() call the fake gateway recorded, with its images. */
function lastCall(ctx: ReturnType<typeof makeAuthContext>) {
  const calls = ctx.ai.calls as Array<{
    promptKey?: string;
    // FIX-1 P0-B: media rides as `{ storagePath }` refs; the ai GATEWAY resolves
    // paths → inline bytes (services never smuggle a path in `base64`).
    images?: Array<{ storagePath: string; mimeType: string }>;
  }>;
  return calls[calls.length - 1];
}

async function seedSubjectiveItem(ctx: ReturnType<typeof makeAuthContext>) {
  // long_answer → routes through the AI grader (not deterministic / not key-matched).
  await ctx.repos.items.upsert(
    ctx.tenantId!,
    makeItem({ type: "long_answer", maxScore: 10 }),
    ctx.now()
  );
}

describe("media eval seam (captured audio/image reaches the AI grader)", () => {
  it("evaluateAnswer attaches top-level mediaUrls to ctx.ai.generate as image/audio parts", async () => {
    const ctx = makeAuthContext("student");
    await seedSubjectiveItem(ctx);
    const imgPath = `tenants/${ctx.tenantId}/exams/it1/answer-sheets/s1/abc.jpg`;
    const audioPath = `tenants/${ctx.tenantId}/exams/it1/answer-sheets/s1/take.m4a`;

    await evaluateAnswerService(
      {
        spaceId: localSeedId("space", "dsa"),
        storyPointId: localSeedId("sp", "arrays"),
        itemId: localSeedId("item", "arrays.q1"),
        // Runner keeps sending the normalized object AND lifts mediaUrls top-level.
        answer: { text: "My spoken + drawn answer.", mediaUrls: [imgPath, audioPath] },
        mediaUrls: [imgPath, audioPath],
      },
      ctx
    );

    const call = lastCall(ctx);
    expect(call.promptKey).toBe("answerGrading");
    const paths = (call.images ?? []).map((i) => i.storagePath);
    // BEFORE the fix: `images` was undefined — the model never saw the media.
    expect(paths).toContain(imgPath);
    expect(paths).toContain(audioPath);
    // Audio gets an audio/* mime; image gets image/*.
    const byPath = new Map((call.images ?? []).map((i) => [i.storagePath, i.mimeType]));
    expect(byPath.get(audioPath)).toMatch(/^audio\//);
    expect(byPath.get(imgPath)).toMatch(/^image\//);
  });

  it("recordItemAttempt unwraps media from the answer object (no top-level field)", async () => {
    const ctx = makeAuthContext("student");
    await seedSubjectiveItem(ctx);
    const imgPath = `tenants/${ctx.tenantId}/exams/it1/answer-sheets/s1/pic.png`;

    await recordItemAttemptService(
      {
        spaceId: localSeedId("space", "dsa"),
        storyPointId: localSeedId("sp", "arrays"),
        itemId: localSeedId("item", "arrays.q1"),
        answer: { text: "", mediaUrls: [imgPath] },
      },
      ctx
    );

    const paths = (lastCall(ctx).images ?? []).map((i) => i.storagePath);
    expect(paths).toContain(imgPath);
  });

  it("⚷ drops / rejects a cross-tenant media path", async () => {
    const ctx = makeAuthContext("student");
    await seedSubjectiveItem(ctx);
    const foreign = "tenants/tenant_other/exams/it1/answer-sheets/s1/steal.jpg";

    // Explicit contract field → hard PERMISSION_DENIED (mirrors autograde ⚷).
    await expect(
      evaluateAnswerService(
        {
          spaceId: localSeedId("space", "dsa"),
          storyPointId: localSeedId("sp", "arrays"),
          itemId: localSeedId("item", "arrays.q1"),
          answer: { text: "x", mediaUrls: [foreign] },
          mediaUrls: [foreign],
        },
        ctx
      )
    ).rejects.toBeDefined();

    // Fallback path (answer object only) → foreign path is silently dropped.
    await recordItemAttemptService(
      {
        spaceId: localSeedId("space", "dsa"),
        storyPointId: localSeedId("sp", "arrays"),
        itemId: localSeedId("item", "arrays.q1"),
        answer: { text: "x", mediaUrls: [foreign] },
      },
      ctx
    );
    const paths = (lastCall(ctx).images ?? []).map((i) => i.storagePath);
    expect(paths).not.toContain(foreign);
  });
});
