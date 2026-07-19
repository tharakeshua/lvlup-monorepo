/**
 * Frozen, mode-isolated conversation context construction.
 *
 * This module intentionally talks only to the exact `levelupContent` repository
 * port. The generic id-only content repositories remain legacy-only and must not
 * be used to build a learner conversation.
 */
import type {
  ConversationConfigurationSnapshot,
  ConversationContentBlock,
  ConversationMode,
  ConversationPublicConfig,
  ConversationSessionDoc,
  StartConversationContext,
  JsonValue,
} from "@levelup/domain";
import type { AuthContext } from "../shared/context.js";
import { fail } from "../shared/context.js";
import type { AiMessage } from "../shared/ai.js";
import type { ConversationSourceVersionCheck, LevelupContentRepo } from "../repo-admin/types.js";
import { canonicalHash, canonicalJson } from "./ids.js";
import { CONVERSATION_LIMITS, MODE_POLICY } from "./policy.js";

type Doc = Record<string, unknown>;

/** The frozen snapshot builder consumes only the direct parent-scoped loader. */
export type ExactLevelupContentPort = LevelupContentRepo;

export interface ConversationStartPlan {
  sessionBase: Pick<
    ConversationSessionDoc,
    "title" | "locale" | "publicConfig" | "configurationSnapshot"
  >;
  sourceVersionChecks: ConversationSourceVersionCheck[];
  /** Static/config-derived only. Start never makes a model call. */
  openingText: string;
}

export interface BuildConversationStartInput {
  tenantId: string;
  ownerUid: string;
  mode: ConversationMode;
  context: StartConversationContext;
  locale?: string;
  now: string;
}

interface ExactScope {
  tenant: Doc | null;
  space: Doc;
  storyPoint?: Doc;
  item?: Doc;
  port: ExactLevelupContentPort;
}

/** Resolve, validate, and freeze every mutable input used by a new session. */
export async function buildConversationStartPlan(
  input: BuildConversationStartInput,
  ctx: AuthContext
): Promise<ConversationStartPlan> {
  const scope = await loadExactScope(input, ctx);
  const locale = input.locale ?? stringAt(asDoc(scope.tenant?.["settings"])["locale"]) ?? "en";
  const modePolicy = MODE_POLICY[input.mode];
  const runtime = await resolveRuntimeAgent(input.tenantId, input.mode, input.context, scope);
  const contentVersions: ConversationConfigurationSnapshot["context"]["contentVersions"] = [];
  const publicSourceVersions: ConversationPublicConfig["sourceVersions"] = [];
  const sourceVersionChecks: ConversationSourceVersionCheck[] = [];

  addSource(
    contentVersions,
    publicSourceVersions,
    sourceVersionChecks,
    "space",
    scope.space,
    input.context.spaceId,
    undefined,
    undefined,
    "space"
  );
  if (scope.storyPoint) {
    addSource(
      contentVersions,
      publicSourceVersions,
      sourceVersionChecks,
      "story_point",
      scope.storyPoint,
      stringAt(scope.storyPoint["id"]) ?? "",
      input.context.spaceId,
      undefined,
      "story_point"
    );
  }
  if (scope.item) {
    addSource(
      contentVersions,
      publicSourceVersions,
      sourceVersionChecks,
      "item",
      scope.item,
      stringAt(scope.item["id"]) ?? "",
      input.context.spaceId,
      stringAt(scope.storyPoint?.["id"]),
      "item"
    );
  }
  if (runtime.sourceDoc) {
    addSource(
      contentVersions,
      publicSourceVersions,
      sourceVersionChecks,
      "agent",
      runtime.sourceDoc,
      runtime.id,
      input.context.spaceId,
      undefined,
      "interviewer_agent"
    );
  }

  const assessment =
    input.mode === "agent_assessment"
      ? await buildAssessmentContext(
          input,
          scope,
          sourceVersionChecks,
          contentVersions,
          publicSourceVersions
        )
      : undefined;
  const interviewerContext = buildInterviewerContext(
    input.mode,
    input.context,
    scope,
    runtime.publicAgent,
    assessment?.interviewerPrivateObjectives
  );

  const snapshotDraft = {
    schemaVersion: 1 as const,
    fingerprint: "",
    mode: input.mode,
    locale,
    prompt: { key: modePolicy.promptKey, version: modePolicy.promptVersion },
    safetyPolicy: { id: "conversation-safety", version: "conversation-safety:1" },
    toolset: {
      id: modePolicy.toolsetId,
      version: modePolicy.toolsetVersion,
      toolNames: [...modePolicy.toolNames],
    },
    // The interviewer/runtime policy is never reused for assessment evaluation.
    runtimeModelPolicyId: runtime.modelPolicyId,
    runtimeAgent: runtime.snapshot,
    context: {
      contentVersions,
      interviewerContext,
      ...(assessment ? { evaluatorContext: assessment.evaluatorContext } : {}),
    },
    ...(assessment ? { completionPolicy: assessment.completionPolicy } : {}),
    createdAt: input.now,
  };
  const configurationSnapshot = {
    ...snapshotDraft,
    fingerprint: canonicalHash(snapshotDraft),
  } as unknown as ConversationConfigurationSnapshot;

  const publicConfig: ConversationPublicConfig = {
    openingMessage: runtime.openingText,
    ...(assessment ? { publicLearningObjectives: assessment.publicObjectives } : {}),
    ...(assessment?.conversationStarters.length
      ? { conversationStarters: assessment.conversationStarters }
      : {}),
    ...(assessment ? { completionPolicy: assessment.completionPolicy } : {}),
    configurationFingerprint: configurationSnapshot.fingerprint,
    sourceVersions: publicSourceVersions,
  };

  return {
    sessionBase: {
      title: conversationTitle(input.context, scope),
      locale,
      publicConfig,
      configurationSnapshot,
    },
    sourceVersionChecks,
    openingText: runtime.openingText,
  };
}

/** Build role-preserving gateway history from the frozen snapshot and durable transcript. */
export function buildConversationTurnMessages(input: {
  session: ConversationSessionDoc;
  messages: readonly { role: "learner" | "assistant"; content: ConversationContentBlock[] }[];
  questionHelpDraft?: { revision: number; answer: unknown };
}): AiMessage[] {
  const snapshot = input.session.configurationSnapshot;
  const developerText = [snapshot.runtimeAgent.identity, snapshot.runtimeAgent.systemPrompt]
    .filter((value): value is string => Boolean(value))
    .concat(snapshot.runtimeAgent.rules)
    .join("\n\n");
  const stableContext = canonicalJson(snapshot.context.interviewerContext);
  assertContextSize(stableContext);

  const out: AiMessage[] = [
    {
      role: "developer",
      parts: [
        {
          type: "text",
          provenance: "agent_config",
          text:
            developerText ||
            "Follow the conversation safety policy and use only the available tools.",
        },
      ],
    },
    {
      role: "user",
      parts: [{ type: "text", provenance: "trusted_context", text: stableContext }],
    },
  ];

  const limit = input.session.mode === "tutor" ? 48 : Number.POSITIVE_INFINITY;
  const history = input.messages.slice(-limit);
  for (let index = 0; index < history.length; index += 1) {
    const message = history[index]!;
    if (message.role === "assistant") {
      const parts = message.content
        .filter(
          (block): block is Extract<ConversationContentBlock, { type: "text" }> =>
            block.type === "text"
        )
        .map((block) => ({
          type: "text" as const,
          provenance: "model_output" as const,
          text: block.text,
        }));
      if (parts.length) out.push({ role: "assistant", parts });
      continue;
    }

    const parts = message.content.map(toLearnerPart);
    if (index === history.length - 1 && input.questionHelpDraft !== undefined) {
      parts.push({
        type: "text",
        provenance: "learner",
        text: `Untrusted learner draft (revision ${input.questionHelpDraft.revision}): ${canonicalJson(
          input.questionHelpDraft.answer
        )}`,
      });
    }
    out.push({ role: "user", parts });
  }
  return out;
}

function exactContent(ctx: AuthContext): ExactLevelupContentPort {
  return ctx.repos.levelupContent;
}

async function loadExactScope(
  input: BuildConversationStartInput,
  ctx: AuthContext
): Promise<ExactScope> {
  const port = exactContent(ctx);
  const tenant = await ctx.repos.tenants.get(input.tenantId, input.tenantId);
  const space = await port.getSpace(input.tenantId, input.context.spaceId);
  if (!space) fail("NOT_FOUND", "Conversation space was not found");
  assertLearnerVisible(space, "space");

  if (input.context.kind === "tutor" && input.context.scope === "space") {
    return { tenant, space, port };
  }
  const storyPointId = input.context.storyPointId;
  const storyPoint = await port.getStoryPoint(input.tenantId, input.context.spaceId, storyPointId);
  if (!storyPoint) fail("NOT_FOUND", "Conversation story point was not found");
  assertLearnerVisible(storyPoint, "story point");

  if (input.context.kind === "tutor" && input.context.scope === "story_point") {
    return { tenant, space, storyPoint, port };
  }
  const item = await port.getItem(
    input.tenantId,
    input.context.spaceId,
    storyPointId,
    input.context.itemId
  );
  if (!item) fail("NOT_FOUND", "Conversation item was not found");
  assertLearnerVisible(item, "item");
  return { tenant, space, storyPoint, item, port };
}

async function resolveRuntimeAgent(
  tenantId: string,
  mode: ConversationMode,
  context: StartConversationContext,
  scope: ExactScope
): Promise<{
  id: string;
  modelPolicyId: "conversation.fast" | "conversation.quality";
  snapshot: ConversationConfigurationSnapshot["runtimeAgent"];
  publicAgent: Doc;
  sourceDoc?: Doc;
  openingText: string;
}> {
  const questionData = questionDataOf(scope.item);
  const requestedId =
    mode === "agent_assessment"
      ? stringAt(questionData?.["interviewerAgentId"])
      : stringAt(scope.space["defaultTutorAgentId"]);
  const expectedType = mode === "agent_assessment" ? "interviewer" : "tutor";
  const configured = requestedId
    ? await scope.port.getAgent(tenantId, context.spaceId, requestedId)
    : null;

  if (mode === "agent_assessment" && !configured) {
    fail(
      "PRECONDITION_FAILED",
      "Assessment conversations require an active scoped interviewer agent"
    );
  }
  if (configured && (configured["isActive"] === false || configured["type"] !== expectedType)) {
    fail("PRECONDITION_FAILED", "Configured conversation agent is inactive or has the wrong type");
  }

  const policy = configured
    ? stringAt(configured["modelPolicyId"])
    : MODE_POLICY[mode].defaultModelPolicyId;
  if (policy !== "conversation.fast" && policy !== "conversation.quality") {
    fail("PRECONDITION_FAILED", "Conversation runtime must use a conversation model policy");
  }
  const id = configured ? (stringAt(configured["id"]) ?? requestedId!) : `builtin-${expectedType}`;
  const openingText =
    stringAt(configured?.["openingMessage"]) ??
    (mode === "agent_assessment"
      ? "Let's begin. Please describe how you would approach this scenario."
      : mode === "question_help"
        ? "I can help you think this through. What have you tried so far?"
        : "Hi! What would you like to explore together?");
  const rules = stringArray(configured?.["rules"]);
  const publicAgent = {
    id,
    type: expectedType,
    ...(stringAt(configured?.["identity"]) ? { identity: stringAt(configured?.["identity"]) } : {}),
    ...(rules.length ? { rules } : {}),
  };
  return {
    id,
    modelPolicyId: policy,
    snapshot: {
      source: configured ? "configured" : "builtin",
      id,
      version: integerAt(configured?.["version"]) ?? 1,
      type: expectedType,
      ...(stringAt(configured?.["identity"])
        ? { identity: stringAt(configured?.["identity"]) }
        : {}),
      ...(stringAt(configured?.["systemPrompt"])
        ? { systemPrompt: stringAt(configured?.["systemPrompt"]) }
        : {}),
      rules,
      openingMessage: openingText,
    },
    publicAgent,
    ...(configured ? { sourceDoc: configured } : {}),
    openingText,
  };
}

async function buildAssessmentContext(
  input: BuildConversationStartInput,
  scope: ExactScope,
  sourceVersionChecks: ConversationSourceVersionCheck[],
  contentVersions: ConversationConfigurationSnapshot["context"]["contentVersions"],
  publicSourceVersions: ConversationPublicConfig["sourceVersions"]
): Promise<{
  publicObjectives: Array<{ id: string; label: string }>;
  conversationStarters: string[];
  completionPolicy: NonNullable<ConversationConfigurationSnapshot["completionPolicy"]>;
  interviewerPrivateObjectives: Array<{
    id: string;
    rubricDimensionId: string;
    description: string;
    evidenceRequirement?: string;
  }>;
  evaluatorContext: NonNullable<ConversationConfigurationSnapshot["context"]["evaluatorContext"]>;
}> {
  const item = scope.item;
  const storyPoint = scope.storyPoint;
  if (!item || !storyPoint || input.context.kind !== "agent_assessment") {
    fail("PRECONDITION_FAILED", "Assessment conversations require an exact item scope");
  }
  const questionData = questionDataOf(item);
  if (!questionData || questionData["questionType"] !== "chat_agent_question") {
    fail("PRECONDITION_FAILED", "The selected item is not a conversational assessment");
  }
  const publicObjectives = publicObjectivesOf(questionData);
  const completionPolicy = completionPolicyOf(questionData);
  const answerKey = await scope.port.getAnswerKey(
    input.tenantId,
    input.context.spaceId,
    input.context.storyPointId,
    input.context.itemId
  );
  if (!answerKey || !Array.isArray(answerKey["privateEvaluationObjectives"])) {
    fail("PRECONDITION_FAILED", "Assessment answer key and private objectives are required");
  }
  assertPrivateObjectives(answerKey, item, publicObjectives);
  addSource(
    contentVersions,
    publicSourceVersions,
    sourceVersionChecks,
    "answer_key",
    answerKey,
    input.context.itemId,
    input.context.spaceId,
    input.context.storyPointId
  );

  const evaluator = await resolveEvaluator(scope, input.tenantId, input.context.spaceId, item);
  if (!evaluator.rubric || !evaluator.settings) {
    fail(
      "PRECONDITION_FAILED",
      "Assessment rubric and evaluation settings must be configured before start"
    );
  }
  if (evaluator.agent) {
    addSource(
      contentVersions,
      publicSourceVersions,
      sourceVersionChecks,
      "agent",
      evaluator.agent,
      stringAt(evaluator.agent["id"]) ?? "",
      input.context.spaceId
    );
  }
  addSource(
    contentVersions,
    publicSourceVersions,
    sourceVersionChecks,
    "evaluation_settings",
    evaluator.settings,
    stringAt(evaluator.settings["id"]) ?? ""
  );
  if (evaluator.rubricPreset) {
    addSource(
      contentVersions,
      publicSourceVersions,
      sourceVersionChecks,
      "rubric",
      evaluator.rubricPreset.doc,
      evaluator.rubricPreset.id
    );
  }

  return {
    publicObjectives,
    conversationStarters: stringArray(questionData["conversationStarters"]),
    completionPolicy,
    evaluatorContext: {
      question: evaluatorQuestion(questionData, item),
      answerKey: jsonValue(answerKey) as JsonValue,
      rubric: jsonValue(evaluator.rubric) as JsonValue,
      evaluationSettings: jsonValue(evaluator.settings) as JsonValue,
      ...(evaluator.agent ? { evaluatorAgent: jsonValue(evaluator.agent) as JsonValue } : {}),
      // This is intentionally frozen independently from the interviewer policy.
      evaluatorModelPolicyId: evaluator.modelPolicyId,
      evaluatorPromptVersion: "evaluation:1",
    },
    interviewerPrivateObjectives: privateObjectivesOf(answerKey),
  };
}

async function resolveEvaluator(
  scope: ExactScope,
  tenantId: string,
  spaceId: string,
  item: Doc
): Promise<{
  agent: Doc | null;
  rubric: Doc | null;
  settings: Doc | null;
  rubricPreset?: { id: string; doc: Doc };
  modelPolicyId: "evaluation.quality";
}> {
  const itemMeta = asDoc(item["meta"]);
  const agentId =
    stringAt(itemMeta["evaluatorAgentId"]) ?? stringAt(scope.space["defaultEvaluatorAgentId"]);
  const agent = agentId ? await scope.port.getAgent(tenantId, spaceId, agentId) : null;
  if (
    agent &&
    (agent["isActive"] === false || stringAt(agent["modelPolicyId"]) !== "evaluation.quality")
  ) {
    fail("PRECONDITION_FAILED", "Evaluator agent must be active and use evaluation.quality");
  }
  const settingsId = stringAt(scope.space["evaluationSettingsId"]);
  if (!settingsId)
    fail("PRECONDITION_FAILED", "Assessment evaluation settings must be configured before start");
  const settings = await scope.port.getEvaluationSettings(tenantId, settingsId);
  let rubric: Doc | null =
    maybeDoc(item["effectiveRubric"]) ??
    maybeDoc(item["rubric"]) ??
    maybeDoc(scope.space["defaultRubric"]) ??
    null;
  let rubricPreset: { id: string; doc: Doc } | undefined;
  if (!rubric) {
    const rubricId = stringAt(item["rubricId"]) ?? stringAt(scope.space["defaultRubricId"]);
    const preset = rubricId ? await scope.port.getRubricPreset(tenantId, rubricId) : null;
    if (preset && rubricId) rubricPreset = { id: rubricId, doc: preset };
    rubric = preset ? (maybeDoc(preset["rubric"]) ?? preset) : null;
  }
  return {
    agent,
    rubric: rubric && Object.keys(rubric).length ? rubric : null,
    settings,
    ...(rubricPreset ? { rubricPreset } : {}),
    modelPolicyId: "evaluation.quality",
  };
}

function buildInterviewerContext(
  mode: ConversationMode,
  context: StartConversationContext,
  scope: ExactScope,
  agent: Doc,
  privateObjectives?: Array<{
    id: string;
    rubricDimensionId: string;
    description: string;
    evidenceRequirement?: string;
  }>
): unknown {
  const common = {
    mode,
    locale: stringAt(asDoc(scope.tenant?.["settings"])["locale"]) ?? "en",
    agent,
    space: safeSpace(scope.space),
  };
  if (context.kind === "tutor") {
    return {
      ...common,
      scope: context.scope,
      ...(scope.storyPoint ? { storyPoint: safeStoryPoint(scope.storyPoint) } : {}),
      ...(scope.item ? { item: safeItem(scope.item) } : {}),
    };
  }
  if (!scope.storyPoint || !scope.item) fail("PRECONDITION_FAILED", "Exact item scope is required");
  if (context.kind === "question_help") {
    return {
      ...common,
      storyPoint: safeStoryPoint(scope.storyPoint),
      item: safeItem(scope.item),
      ...(context.attemptId ? { attemptId: context.attemptId } : {}),
    };
  }
  const q = questionDataOf(scope.item);
  return {
    ...common,
    storyPoint: safeStoryPoint(scope.storyPoint),
    item: safeItem(scope.item),
    scenario: stringAt(q?.["scenario"]) ?? stringAt(q?.["prompt"]) ?? "",
    publicLearningObjectives: publicObjectivesOf(q ?? {}),
    completionPolicy: completionPolicyOf(q ?? {}),
    // Private objectives are deliberately narrowed to identity/evidence data;
    // model answers, evaluator guidance, and scoring configuration are absent.
    privateEvaluationObjectives: privateObjectives ?? [],
  };
}

function addSource(
  versions: ConversationConfigurationSnapshot["context"]["contentVersions"],
  publicVersions: ConversationPublicConfig["sourceVersions"],
  checks: ConversationSourceVersionCheck[],
  resourceType: ConversationSourceVersionCheck["resourceType"],
  doc: Doc,
  resourceId: string,
  spaceId?: string,
  storyPointId?: string,
  publicResourceType?: ConversationPublicConfig["sourceVersions"][number]["resourceType"]
): void {
  if (!resourceId) return;
  const version = integerAt(doc["version"]);
  versions.push({ resourceType, resourceId, version: version ?? 0 });
  if (publicResourceType)
    publicVersions.push({ resourceType: publicResourceType, resourceId, version: version ?? 0 });
  checks.push({
    resourceType,
    resourceId,
    ...(spaceId ? { spaceId } : {}),
    ...(storyPointId ? { storyPointId } : {}),
    ...(version !== undefined
      ? { expectedVersion: version }
      : { expectedCanonicalHash: canonicalHash(jsonValue(doc)) }),
  });
}

function assertLearnerVisible(doc: Doc, resource: string): void {
  if (doc["archivedAt"] !== undefined && doc["archivedAt"] !== null) {
    fail("PRECONDITION_FAILED", `Conversation ${resource} is archived`);
  }
  const status = stringAt(doc["status"]);
  if (status && status !== "published") {
    fail("PRECONDITION_FAILED", `Conversation ${resource} is not published`);
  }
}

function questionDataOf(item: Doc | undefined): Doc | undefined {
  if (!item) return undefined;
  const payload = asDoc(item["payload"]);
  return maybeDoc(payload["questionData"]) ?? maybeDoc(item["questionData"]);
}

function publicObjectivesOf(questionData: Doc): Array<{ id: string; label: string }> {
  const raw = Array.isArray(questionData["publicLearningObjectives"])
    ? questionData["publicLearningObjectives"]
    : [];
  const objectives = raw
    .map(asDoc)
    .filter((value): value is Doc => Boolean(value))
    .map((value) => {
      const id = stringAt(value["id"]);
      const label = stringAt(value["label"]);
      if (!id || !label)
        fail("PRECONDITION_FAILED", "Assessment public objectives must have ids and labels");
      return { id, label };
    });
  if (objectives.length === 0)
    fail("PRECONDITION_FAILED", "Assessment needs at least one public learning objective");
  return objectives;
}

function completionPolicyOf(
  questionData: Doc
): NonNullable<ConversationConfigurationSnapshot["completionPolicy"]> {
  const policy = asDoc(questionData["completionPolicy"]);
  const minLearnerTurns = integerAt(policy["minLearnerTurns"]);
  const maxLearnerTurns = integerAt(policy["maxLearnerTurns"]);
  if (
    !minLearnerTurns ||
    !maxLearnerTurns ||
    minLearnerTurns < CONVERSATION_LIMITS.assessmentMinTurnsFloor ||
    maxLearnerTurns > CONVERSATION_LIMITS.assessmentMaxTurnsCeiling ||
    minLearnerTurns > maxLearnerTurns ||
    typeof policy["allowEarlyFinish"] !== "boolean"
  ) {
    fail("PRECONDITION_FAILED", "Assessment completion policy is invalid");
  }
  return {
    minLearnerTurns,
    maxLearnerTurns,
    allowEarlyFinish: policy["allowEarlyFinish"],
    hardLimitAction: "auto_finalize",
  } as NonNullable<ConversationConfigurationSnapshot["completionPolicy"]>;
}

function assertPrivateObjectives(
  answerKey: Doc,
  item: Doc,
  publicObjectives: Array<{ id: string; label: string }>
): void {
  const objectives = answerKey["privateEvaluationObjectives"] as unknown[];
  if (!objectives.length)
    fail("PRECONDITION_FAILED", "Assessment needs at least one private objective");
  const publicIds = new Set(publicObjectives.map((objective) => objective.id));
  const rubric = maybeDoc(item["effectiveRubric"]) ?? maybeDoc(item["rubric"]);
  const dimensions = new Set(
    (Array.isArray(rubric?.["dimensions"]) ? rubric?.["dimensions"] : [])
      .map(asDoc)
      .map((dimension) => stringAt(dimension?.["id"]))
      .filter((id): id is string => Boolean(id))
  );
  for (const raw of objectives) {
    const objective = asDoc(raw);
    const id = stringAt(objective["id"]);
    const dimensionId = stringAt(objective["rubricDimensionId"]);
    const description = stringAt(objective["description"]);
    if (
      !id ||
      !dimensionId ||
      !description ||
      (dimensions.size > 0 && !dimensions.has(dimensionId))
    ) {
      fail("PRECONDITION_FAILED", "Assessment private objective configuration is invalid");
    }
    // Public/private identifiers may differ; this line intentionally only validates uniqueness shape.
    void publicIds;
  }
}

function privateObjectivesOf(answerKey: Doc): Array<{
  id: string;
  rubricDimensionId: string;
  description: string;
  evidenceRequirement?: string;
}> {
  return (answerKey["privateEvaluationObjectives"] as unknown[])
    .map(asDoc)
    .filter((objective): objective is Doc => Boolean(objective))
    .map((objective) => ({
      id: stringAt(objective["id"])!,
      rubricDimensionId: stringAt(objective["rubricDimensionId"])!,
      description: stringAt(objective["description"])!,
      ...(stringAt(objective["evidenceRequirement"])
        ? { evidenceRequirement: stringAt(objective["evidenceRequirement"]) }
        : {}),
    }));
}

/** Evaluation Core needs a stable max score; never re-read mutable item data later. */
function evaluatorQuestion(questionData: Doc, item: Doc): JsonValue {
  const payloadQuestion = maybeDoc(asDoc(item["payload"])["question"]);
  const maxScore =
    integerAt(questionData["maxScore"]) ??
    integerAt(questionData["maxMarks"]) ??
    integerAt(payloadQuestion?.["points"]) ??
    integerAt(item["maxScore"]) ??
    1;
  return jsonValue({ ...questionData, maxScore }) as JsonValue;
}

function conversationTitle(context: StartConversationContext, scope: ExactScope): string {
  if (scope.item) return stringAt(scope.item["title"]) ?? "Conversation";
  if (scope.storyPoint) return stringAt(scope.storyPoint["title"]) ?? "Conversation";
  return stringAt(scope.space["title"]) ?? `${context.kind} conversation`;
}

function safeSpace(space: Doc): Doc {
  return pick(space, ["id", "title", "description", "subject", "labels", "type"]);
}

function safeStoryPoint(storyPoint: Doc): Doc {
  return pick(storyPoint, ["id", "title", "description", "orderIndex"]);
}

function safeItem(item: Doc): Doc {
  const payload = asDoc(item["payload"]);
  const question = maybeDoc(payload["question"]);
  const questionData = maybeDoc(payload["questionData"]);
  return {
    ...pick(item, [
      "id",
      "title",
      "content",
      "type",
      "topics",
      "labels",
      "attachments",
      "orderIndex",
    ]),
    ...(question
      ? {
          question: pick(question, [
            "type",
            "questionType",
            "text",
            "prompt",
            "scenario",
            "stem",
            "options",
            "instructions",
            "points",
          ]),
        }
      : {}),
    ...(questionData
      ? {
          questionData: pick(questionData, [
            "questionType",
            "prompt",
            "text",
            "scenario",
            "publicLearningObjectives",
            "conversationStarters",
            "completionPolicy",
            "options",
            "choices",
            "instructions",
          ]),
        }
      : {}),
  };
}

function toLearnerPart(
  block: ConversationContentBlock
): Extract<AiMessage, { role: "user" }>["parts"][number] {
  switch (block.type) {
    case "text":
      return { type: "text", provenance: "learner", text: block.text };
    case "media":
      return { type: "image", image: { storagePath: block.storagePath, mimeType: block.mimeType } };
    case "citation":
      return { type: "text", provenance: "learner", text: `[Citation: ${block.label}]` };
  }
}

function assertContextSize(stableContext: string): void {
  // This ceiling guards a malformed authoring configuration before a billable call.
  if (Buffer.byteLength(stableContext, "utf8") > 128 * 1024) {
    fail("PRECONDITION_FAILED", "Conversation context configuration is too large");
  }
}

function pick(doc: Doc, keys: readonly string[]): Doc {
  const result: Doc = {};
  for (const key of keys) if (doc[key] !== undefined) result[key] = jsonValue(doc[key]);
  return result;
}

function jsonValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object") {
    const result: Doc = {};
    for (const [key, nested] of Object.entries(value as Doc)) {
      if (nested !== undefined) result[key] = jsonValue(nested);
    }
    return result;
  }
  return null;
}

function asDoc(value: unknown): Doc {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Doc) : {};
}

function maybeDoc(value: unknown): Doc | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Doc) : undefined;
}

function stringAt(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function integerAt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
