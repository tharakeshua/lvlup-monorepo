/** Idempotent learner abandonment; no transcript deletion or fabricated result. */
import {
  AbandonConversationRequestSchema,
  type AbandonConversationRequest,
  type AbandonConversationResponse,
} from "@levelup/api-contract";
import type { ConversationSessionDoc } from "@levelup/domain";
import type { AuthContext } from "../shared/context.js";
import { fail, requireTenant } from "../shared/context.js";
import { projectConversationSession, projectGrading } from "./projections.js";
import { assertConversationOwner } from "./reads.js";

export async function abandonConversationService(
  request: AbandonConversationRequest,
  ctx: AuthContext
): Promise<AbandonConversationResponse> {
  const parsed = AbandonConversationRequestSchema.safeParse(request);
  if (!parsed.success) fail("VALIDATION_ERROR", "Invalid abandon conversation request");
  const input = parsed.data;
  const tenantId = requireTenant(ctx);
  const existing = await ctx.repos.conversations.getSession(tenantId, input.sessionId);
  if (!existing) fail("NOT_FOUND", "Conversation session was not found");
  assertConversationOwner(existing, ctx);

  const raw = await ctx.repos.conversations.abandon({
    tenantId,
    ownerUid: ctx.uid,
    sessionId: existing.id,
    clientRequestId: input.clientRequestId,
    now: ctx.now(),
  });
  const outcome = normalizeAbandonOutcome(raw);
  const submissionId = outcome.session.finalization?.submissionId;
  const submission = submissionId
    ? await ctx.repos.itemSubmissions.get(tenantId, submissionId)
    : undefined;
  return {
    session: projectConversationSession(
      outcome.session,
      undefined,
      projectGrading(outcome.session, submission, ctx.now())
    ),
    replayed: outcome.replayed,
  };
}

function normalizeAbandonOutcome(raw: unknown): {
  session: ConversationSessionDoc;
  replayed: boolean;
} {
  if (raw && typeof raw === "object" && "session" in raw) {
    const outcome = raw as { session: ConversationSessionDoc; replayed?: unknown };
    return { session: outcome.session, replayed: outcome.replayed === true };
  }
  return { session: raw as ConversationSessionDoc, replayed: false };
}
