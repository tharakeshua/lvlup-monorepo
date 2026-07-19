/**
 * Scoped, bounded tool dispatcher. Tool input never supplies tenant/user/path
 * authority; every handler derives its scope from the claimed session.
 */
import type {
  ConversationCompletionRecommendation,
  ConversationEvidenceDoc,
  ConversationSessionDoc,
  ConversationToolInvocation,
  ConversationToolName,
  ConversationTurnDoc,
  JsonValue,
} from "@levelup/domain";
import { z } from "zod";
import type { AuthContext } from "../../shared/context.js";
import { fail } from "../../shared/context.js";
import { canonicalHash, canonicalJson, conversationEvidenceId, toolInvocationId } from "../ids.js";
import { CONVERSATION_LIMITS, isConversationToolAllowed } from "../policy.js";
import {
  TOOL_DECLARATIONS,
  type ProviderToolDeclaration,
  EmptyArgsSchema,
  RecommendLearningContentArgsSchema,
  RecordEvidenceArgsSchema,
  RecordHintUsageArgsSchema,
  RecommendCompletionArgsSchema,
} from "./schemas.js";

type Doc = Record<string, unknown>;

export interface ConversationToolScope {
  ctx: AuthContext;
  tenantId: string;
  ownerUid: string;
  session: ConversationSessionDoc;
  turn: ConversationTurnDoc;
  messageSequences: ReadonlySet<number>;
  now: string;
}

export interface ToolStaging {
  evidence: ConversationEvidenceDoc[];
  completionRecommendation?: ConversationCompletionRecommendation;
  hintCategories: string[];
}

export interface ToolExecutionResult {
  invocation: ConversationToolInvocation;
  result: JsonValue;
  staging: ToolStaging;
}

interface ToolHandler<TArgs> {
  name: ConversationToolName;
  args: z.ZodType<TArgs>;
  execute(args: TArgs, scope: ConversationToolScope, staging: ToolStaging): Promise<JsonValue>;
}

const HANDLERS: Record<ConversationToolName, ToolHandler<unknown>> = {
  retrieve_scope_context: {
    name: "retrieve_scope_context",
    args: EmptyArgsSchema,
    async execute(_args, scope) {
      // Assessment mode never declares this tool, avoiding private context exposure.
      return learnerVisibleContext(scope.session.configurationSnapshot.context.interviewerContext);
    },
  },
  get_learner_visible_progress_summary: {
    name: "get_learner_visible_progress_summary",
    args: EmptyArgsSchema,
    async execute(_args, scope) {
      const progress = await scope.ctx.repos.progress.get(
        scope.tenantId,
        scope.ownerUid,
        scope.session.context.spaceId
      );
      return projectProgress(progress);
    },
  },
  recommend_learning_content: {
    name: "recommend_learning_content",
    args: RecommendLearningContentArgsSchema,
    async execute(args, scope) {
      const input = args as z.infer<typeof RecommendLearningContentArgsSchema>;
      const context = scope.session.context;
      // The model may only name the exact currently scoped item, never a URL/path.
      if (
        input.itemId &&
        (context.kind !== "tutor" || context.scope !== "item" || input.itemId !== context.itemId)
      ) {
        fail("PRECONDITION_FAILED", "Recommended content is outside the exact conversation scope");
      }
      return {
        ...(context.kind === "tutor" && context.scope === "item" ? { itemId: context.itemId } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      } as JsonValue;
    },
  },
  retrieve_item_context: {
    name: "retrieve_item_context",
    args: EmptyArgsSchema,
    async execute(_args, scope) {
      if (scope.session.context.kind !== "question_help") {
        fail("PRECONDITION_FAILED", "Item context is restricted to question-help sessions");
      }
      return learnerVisibleContext(scope.session.configurationSnapshot.context.interviewerContext);
    },
  },
  record_hint_usage: {
    name: "record_hint_usage",
    args: RecordHintUsageArgsSchema,
    async execute(args, _scope, staging) {
      const input = args as z.infer<typeof RecordHintUsageArgsSchema>;
      staging.hintCategories.push(input.category);
      return { accepted: true, category: input.category } as JsonValue;
    },
  },
  record_evidence: {
    name: "record_evidence",
    args: RecordEvidenceArgsSchema,
    async execute(args, scope, staging) {
      const input = args as z.infer<typeof RecordEvidenceArgsSchema>;
      if (scope.session.mode !== "agent_assessment") {
        fail("PRECONDITION_FAILED", "Evidence recording is restricted to assessment sessions");
      }
      const privateObjectives = privateObjectivesOf(scope.session);
      const objective = privateObjectives.get(input.objectiveId);
      if (!objective || objective.rubricDimensionId !== input.rubricDimensionId) {
        fail(
          "PRECONDITION_FAILED",
          "Evidence must reference a frozen assessment objective and dimension"
        );
      }
      if (
        input.messageSequences.some((sequence: number) => !scope.messageSequences.has(sequence))
      ) {
        fail("PRECONDITION_FAILED", "Evidence references a message outside this frozen transcript");
      }
      const ordinal = staging.evidence.length;
      staging.evidence.push({
        schemaVersion: 1,
        id: conversationEvidenceId(scope.turn.id, ordinal),
        tenantId: scope.tenantId as ConversationEvidenceDoc["tenantId"],
        sessionId: scope.session.id,
        turnId: scope.turn.id,
        objectiveId: input.objectiveId,
        rubricDimensionId: input.rubricDimensionId,
        messageSequences: [...input.messageSequences],
        note: input.note,
        confidence: input.confidence,
        recorder: {
          type: "interviewer_model",
          promptVersion: scope.turn.promptVersion,
          configurationFingerprint: scope.turn.configurationFingerprint,
        },
        createdAt: scope.now as ConversationEvidenceDoc["createdAt"],
      });
      return { accepted: true, objectiveId: input.objectiveId } as JsonValue;
    },
  },
  recommend_completion: {
    name: "recommend_completion",
    args: RecommendCompletionArgsSchema,
    async execute(args, scope, staging) {
      const input = args as z.infer<typeof RecommendCompletionArgsSchema>;
      if (scope.session.mode !== "agent_assessment") {
        fail(
          "PRECONDITION_FAILED",
          "Completion recommendations are restricted to assessment sessions"
        );
      }
      const allowed = new Set(publicObjectiveIds(scope.session));
      if (
        input.coveredObjectiveIds.some((id: string) => !allowed.has(id)) ||
        input.remainingObjectiveIds.some((id: string) => !allowed.has(id))
      ) {
        fail(
          "PRECONDITION_FAILED",
          "Completion recommendation references an unknown public objective"
        );
      }
      staging.completionRecommendation = {
        reasonCode: input.reason,
        coveredPublicObjectiveIds: [...input.coveredObjectiveIds],
        remainingPublicObjectiveIds: [...input.remainingObjectiveIds],
        hardLimitReached: false,
        recommendedAt: scope.now as ConversationCompletionRecommendation["recommendedAt"],
      };
      return { accepted: true, recommendation: input.reason } as JsonValue;
    },
  },
};

export function toolDeclarationsFor(
  mode: ConversationSessionDoc["mode"],
  toolsetVersion: string
): ProviderToolDeclaration[] {
  if (!toolsetVersion.startsWith("conversation.")) {
    fail("PRECONDITION_FAILED", "Unknown conversation toolset version");
  }
  return Object.values(TOOL_DECLARATIONS).filter((tool) =>
    isConversationToolAllowed(mode, tool.name)
  );
}

export async function executeConversationTool(input: {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  step: number;
  ordinal: number;
  scope: ConversationToolScope;
  staging: ToolStaging;
}): Promise<ToolExecutionResult> {
  const { scope } = input;
  if (!isConversationToolAllowed(scope.session.mode, input.name)) {
    fail("PRECONDITION_FAILED", "Tool is not allowlisted for this conversation mode");
  }
  const handler = HANDLERS[input.name];
  const parsed = handler.args.safeParse(input.args);
  if (!parsed.success) fail("VALIDATION_ERROR", "Model supplied invalid tool arguments");

  const sanitizedArgs = jsonValue(parsed.data);
  const startedAt = scope.now;
  const result = await withTimeout(
    handler.execute(parsed.data, scope, input.staging),
    CONVERSATION_LIMITS.toolTimeoutMs
  );
  const sanitizedResult = jsonValue(result);
  const resultBytes = Buffer.byteLength(canonicalJson(sanitizedResult), "utf8");
  if (resultBytes > CONVERSATION_LIMITS.maxToolResultBytes) {
    fail("PRECONDITION_FAILED", "Tool result exceeds the conversation result budget");
  }
  return {
    invocation: {
      id: toolInvocationId(scope.turn.id, input.step, input.ordinal),
      step: input.step,
      ordinal: input.ordinal,
      toolName: handler.name,
      status: "succeeded",
      argsHash: canonicalHash(sanitizedArgs),
      sanitizedArgs,
      sanitizedResult,
      resultBytes,
      startedAt: startedAt as ConversationToolInvocation["startedAt"],
      completedAt: scope.ctx.now() as ConversationToolInvocation["completedAt"],
    },
    result: sanitizedResult,
    staging: input.staging,
  };
}

export function emptyToolStaging(): ToolStaging {
  return { evidence: [], hintCategories: [] };
}

function privateObjectivesOf(
  session: ConversationSessionDoc
): Map<string, { rubricDimensionId: string }> {
  const context = session.configurationSnapshot.context.interviewerContext as Doc;
  const raw = Array.isArray(context["privateEvaluationObjectives"])
    ? context["privateEvaluationObjectives"]
    : [];
  const result = new Map<string, { rubricDimensionId: string }>();
  for (const value of raw) {
    const objective = asDoc(value);
    if (
      typeof objective?.["id"] === "string" &&
      typeof objective["rubricDimensionId"] === "string"
    ) {
      result.set(objective["id"], { rubricDimensionId: objective["rubricDimensionId"] });
    }
  }
  return result;
}

function publicObjectiveIds(session: ConversationSessionDoc): string[] {
  const objectives = session.publicConfig.publicLearningObjectives ?? [];
  return objectives.map((objective) => objective.id);
}

function learnerVisibleContext(value: unknown): JsonValue {
  // Context tools are only declared for modes whose snapshot packet is already
  // learner-safe. Convert through JSON to prevent accidental non-JSON objects.
  return jsonValue(value);
}

function projectProgress(progress: Record<string, unknown> | null): JsonValue {
  if (!progress) return { available: false };
  return jsonValue({
    available: true,
    completed: progress["completed"],
    pointsEarned: progress["pointsEarned"],
    totalPoints: progress["totalPoints"],
    percentage: progress["percentage"],
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("conversation tool timed out")), timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "conversation tool timed out") {
      fail("INTERNAL_ERROR", "A conversation tool timed out");
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function jsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object") {
    const result: Record<string, JsonValue> = {};
    for (const [key, nested] of Object.entries(value as Doc)) {
      if (nested !== undefined) result[key] = jsonValue(nested);
    }
    return result;
  }
  return null;
}

function asDoc(value: unknown): Doc | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Doc) : undefined;
}
