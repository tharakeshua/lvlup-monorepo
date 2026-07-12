/**
 * `generateContent` (LVL-2, coordinator ruling "Option A") — AI-drafted content
 * items for a story point. Drafts ONLY: nothing is persisted; the teacher reviews
 * and saves through `saveItem` (which owns the answer-key split).
 *
 * Seam notes:
 *   • Uses `ctx.ai` gateway with promptKey "contentDraft" (registry §4.1).
 *   • sourcePdfPath: tenant-scoped storage path passed as an inline image ref;
 *     the gateway AiImageStore resolves bytes before the provider call (≤14MB;
 *     oversize surfaces as FAILED_PRECONDITION so the teacher knows to split).
 *   • Every model draft is validated against the contract `GeneratedItemSchema`;
 *     non-conforming drafts are DROPPED, never passed through raw.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { GeneratedItemSchema } from "@levelup/api-contract";
import { QUESTION_TYPES } from "@levelup/domain";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";

type Doc = Record<string, unknown>;

export async function generateContentService(
  input: ReqOf<"v1.levelup.generateContent">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.generateContent">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "item.write", input.spaceId ? { spaceId: input.spaceId, tenantId } : { tenantId });

  if (input.sourcePdfPath) {
    // Storage paths must be tenant-scoped — any other prefix means the caller
    // is trying to read outside their tenant's bucket namespace.
    if (!input.sourcePdfPath.startsWith(`tenants/${tenantId}/`)) {
      fail(
        "FAILED_PRECONDITION",
        "sourcePdfPath must be a tenant-scoped storage path: tenants/{tenantId}/..."
      );
    }
  }

  const storyPoint = await ctx.repos.storyPoints.get(tenantId, input.storyPointId);
  if (!storyPoint) fail("NOT_FOUND", "story point not found");
  const spaceId = input.spaceId ?? (storyPoint["spaceId"] as string | undefined);
  const space = spaceId ? await ctx.repos.spaces.get(tenantId, spaceId) : null;

  const ai = await ctx.ai.generate(
    {
      purpose: "content_draft",
      promptKey: "contentDraft",
      operation: "levelup.generateContent",
      variables: {
        spaceTitle: String(space?.["title"] ?? ""),
        subject: String(space?.["subject"] ?? ""),
        storyPointTitle: String(storyPoint["title"] ?? ""),
        storyPointDescription: String(storyPoint["description"] ?? ""),
        count: String(input.spec.count),
        types: input.spec.types.join(", "),
        difficulty: input.spec.difficulty ?? "medium",
        questionTypes: QUESTION_TYPES.join(", "),
      },
      ...(input.sourcePdfPath ? { images: [{ storagePath: input.sourcePdfPath }] } : {}),
      responseSchema: {
        type: "object",
        properties: { drafts: { type: "array" } },
        required: ["drafts"],
      },
    },
    {
      tenantId,
      uid: ctx.uid,
      role: ctx.role,
      resourceType: "storyPoint",
      resourceId: input.storyPointId,
      ...(spaceId ? { spaceId } : {}),
      now: ctx.now,
    }
  );

  const raw = (ai.json as Doc | undefined) ?? {};
  const candidates: unknown[] = Array.isArray(raw["drafts"])
    ? (raw["drafts"] as unknown[])
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];

  // Contract gate: only schema-valid drafts leave the server (never raw output).
  const drafts = candidates.flatMap((c) => {
    const r = GeneratedItemSchema.safeParse(c);
    return r.success ? [r.data] : [];
  });

  return { drafts } as unknown as ResOf<"v1.levelup.generateContent">;
}
