/**
 * `generateContent` (LVL-2, coordinator ruling "Option A") — AI-drafted content
 * items for a story point. Drafts ONLY: nothing is persisted; the teacher reviews
 * and saves through `saveItem` (which owns the answer-key split).
 *
 * Seam notes:
 *   • Uses the EXISTING `ctx.ai` gateway seam with a raw prompt — no new
 *     prompt-registry key (that work is queued into the Teacher-content tree).
 *   • Every model draft is validated against the contract `GeneratedItemSchema`;
 *     non-conforming drafts are DROPPED, never passed through raw.
 *   • `sourcePdfPath` is NOT implemented (PDF ingestion needs AiImageStore work) —
 *     it fails loud rather than silently ignoring the source document.
 *   • Cost/telemetry flow through the ai seam like every other AI call.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { GeneratedItemSchema } from "@levelup/api-contract";
import { QUESTION_TYPES } from "@levelup/domain";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";

type Doc = Record<string, unknown>;

/**
 * TODO(teacher-content tree): lift into the `@levelup/ai` prompt registry as
 * `contentDraft` (with PDF-source support) — this constant is the interim raw
 * prompt so the future tree lifts it instead of re-inventing it.
 */
export const CONTENT_DRAFT_PROMPT_V0 = `You are an expert curriculum author drafting practice content for a learning platform.

Context:
- Space (course): {{spaceTitle}} — subject: {{subject}}
- Story point (lesson): {{storyPointTitle}}
- Lesson description: {{storyPointDescription}}

Task: draft exactly {{count}} item(s) of the requested kinds: {{types}}.
Difficulty target: {{difficulty}}.

Rules:
- Allowed questionType values (use ONLY these): {{questionTypes}}.
- Every draft MUST be a JSON object with this exact shape:
  {
    "itemType": "question" | "material",
    "questionType": "<one of the allowed values, question drafts only>",
    "title": "<short title>",
    "payload": <see below>,
    "bloomsLevel": "<optional: remember|understand|apply|analyze|evaluate|create>",
    "topics": ["<optional topic tags>"]
  }
- For a question draft, "payload" is:
  { "type": "question", "questionData": { "questionType": "<same value>", ...type-specific prompt fields } }
  e.g. an "mcq" question carries "options": [{ "id": "a", "text": "..." }, ...].
- For a material draft, "payload" is:
  { "type": "material", "materialData": { "materialType": "text", "body": "<markdown body>" } }
- Do NOT include correct answers, answer keys, or grading guidance in any field.
- Respond with ONLY a JSON object: { "drafts": [ ...the draft objects... ] }.`;

/** Fill the {{var}} slots of the V0 prompt (plain string substitution). */
function fillPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
}

export async function generateContentService(
  input: ReqOf<"v1.levelup.generateContent">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.generateContent">> {
  const tenantId = requireTenant(ctx);
  // Drafting content is a content-authoring capability (same gate as saveItem).
  authorize(ctx, "item.write", input.spaceId ? { spaceId: input.spaceId, tenantId } : { tenantId });

  if (input.sourcePdfPath) {
    // Honest signal, not a silent ignore (coordinator ruling, LVL-2 Option A).
    // (The contract has no UNIMPLEMENTED code; FAILED_PRECONDITION → the
    // canonical PRECONDITION_FAILED via map-error, same alias siblings use.)
    fail("FAILED_PRECONDITION", "PDF-sourced generation lands with the AI-authoring milestone");
  }

  // Resolve lesson context (best-effort — the prompt degrades gracefully).
  const storyPoint = await ctx.repos.storyPoints.get(tenantId, input.storyPointId);
  if (!storyPoint) fail("NOT_FOUND", "story point not found");
  const spaceId = input.spaceId ?? (storyPoint["spaceId"] as string | undefined);
  const space = spaceId ? await ctx.repos.spaces.get(tenantId, spaceId) : null;

  const prompt = fillPrompt(CONTENT_DRAFT_PROMPT_V0, {
    spaceTitle: String(space?.["title"] ?? ""),
    subject: String(space?.["subject"] ?? ""),
    storyPointTitle: String(storyPoint["title"] ?? ""),
    storyPointDescription: String(storyPoint["description"] ?? ""),
    count: String(input.spec.count),
    types: input.spec.types.join(", "),
    difficulty: input.spec.difficulty ?? "medium",
    questionTypes: QUESTION_TYPES.join(", "),
  });

  const ai = await ctx.ai.generate(
    {
      prompt,
      operation: "levelup.generateContent",
      variables: { storyPointId: input.storyPointId, spec: input.spec },
      // Structured output: the gateway only populates `json` when a
      // responseSchema is set (same requirement as practice.ts grading).
      responseSchema: { type: "object" },
    },
    { tenantId, uid: ctx.uid, ...(spaceId ? { spaceId } : {}), now: ctx.now }
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
