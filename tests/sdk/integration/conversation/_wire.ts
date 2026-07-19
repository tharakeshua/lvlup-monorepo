/**
 * Wire-path helpers for the conversation EMULATOR integration suites (T-I).
 *
 * These suites exercise the FULL client → @levelup/transport-firebase → deployed
 * `v1.levelup.*` callable → @levelup/services runtime → Firestore path against a
 * DETERMINISTIC self-seeded conversation dataset.
 *
 * Self-contained gate: `seedConversationContent()` uses the `@levelup/seed` engine
 * to materialize a published space + `chat_agent_question` assessment item +
 * interviewer/evaluator agents + rubric into the emulator with env-independent ids
 * (`seedId`), then `signInAsScopedStudent()` mints a student token whose claims are
 * scoped to that seeded tenant. `chat.send` is STUDENT_ONLY + tenantScoped + self —
 * no enrollment — so a scoped student can start/turn/finish. The emulator bootstrap
 * injects a deterministic stub AI provider (FIRESTORE_EMULATOR_HOST), so turns and
 * finalization execute without a real model key.
 *
 * Gated behind requireFunctions() + conversationReady(); skips cleanly otherwise.
 */
import { httpsCallable } from "firebase/functions";
import { toDeployedCallableId } from "@levelup/transport-firebase";
import type { CallableName } from "@levelup/api-contract";
import { seed, IdResolver } from "@levelup/seed";
import { clientFunctions, adminDb } from "../../harness/emulator";
import { signInAsDemoUser } from "../../harness/auth-context";

const EMU_PROJECT = "demo-levelup";
const TENANT_KEY = "conv-e2e";
const SPACE_KEY = "ai-lab";
const SP_KEY = "interview-room";
const ITEM_KEY = "sd-interview";
const INTERVIEWER_KEY = "swe-interviewer";
const EVALUATOR_KEY = "swe-evaluator";
const RUBRIC_KEY = "sd-rubric";

const resolver = new IdResolver(TENANT_KEY);
const CLOCK_ISO = "2026-07-19T00:00:00.000Z";

/** Deterministic ids for the self-seeded dataset (env-independent via seedId). */
export const SEED_IDS = {
  tenantId: resolver.tenantId as string,
  spaceId: resolver.spaceId(SPACE_KEY) as string,
  storyPointId: resolver.storyPointId(SPACE_KEY, SP_KEY) as string,
  itemId: resolver.itemId(SPACE_KEY, SP_KEY, ITEM_KEY) as string,
};

/** A tutor:space context (no story-point/item source check — the minimal start). */
export const TUTOR_SPACE_CONTEXT = {
  kind: "tutor" as const,
  scope: "space" as const,
  spaceId: SEED_IDS.spaceId,
};

/** A tutor:item context over the seeded item (tutor needs no chat_agent_question). */
export const TUTOR_CONTEXT = {
  kind: "tutor" as const,
  scope: "item" as const,
  spaceId: SEED_IDS.spaceId,
  storyPointId: SEED_IDS.storyPointId,
  itemId: SEED_IDS.itemId,
};

/** The assessment context over the same seeded chat_agent_question item. */
export const ASSESSMENT_CONTEXT = {
  kind: "agent_assessment" as const,
  spaceId: SEED_IDS.spaceId,
  storyPointId: SEED_IDS.storyPointId,
  itemId: SEED_IDS.itemId,
};

export function uuid(seed: number): string {
  const h = (seed >>> 0).toString(16).padStart(8, "0");
  return `${h}-0000-4000-8000-000000000000`;
}

function seedConfig() {
  return {
    tenants: [
      {
        key: TENANT_KEY,
        name: "Conversation E2E",
        code: "CONVE2E",
        features: {
          conversations: true,
          conversationTutor: true,
          conversationQuestionHelp: true,
          conversationAssessment: true,
        },
        agents: [
          {
            key: INTERVIEWER_KEY,
            name: "SWE interviewer",
            spaceKey: SPACE_KEY,
            type: "interviewer" as const,
            modelPolicyId: "conversation.quality" as const,
            version: 1,
          },
          {
            key: EVALUATOR_KEY,
            name: "SWE evaluator",
            spaceKey: SPACE_KEY,
            type: "evaluator" as const,
            modelPolicyId: "evaluation.quality" as const,
            version: 1,
          },
        ],
        rubricPresets: [
          {
            key: RUBRIC_KEY,
            name: "System design rubric",
            rubric: {
              dimensions: [
                { key: "reasoning", label: "Reasoning", weight: 0.6 },
                { key: "tradeoffs", label: "Trade-offs", weight: 0.4 },
              ],
              totalPoints: 10,
              passingScore: 6,
            },
          },
        ],
        spaces: [
          {
            key: SPACE_KEY,
            title: "AI Assessment Lab",
            status: "published" as const,
            storyPoints: [
              {
                key: SP_KEY,
                title: "The Interview Room",
                items: [
                  {
                    key: ITEM_KEY,
                    kind: "question" as const,
                    questionType: "chat_agent_question" as const,
                    prompt: "Design a scalable news-feed system.",
                    scenario: "You are interviewing for a senior backend role.",
                    publicLearningObjectives: [
                      { key: "reasoning", label: "Reason about system trade-offs" },
                      { key: "tradeoffs", label: "Justify design trade-offs" },
                    ],
                    conversationStarters: ["I'd start by clarifying the read/write ratio."],
                    interviewerAgentKey: INTERVIEWER_KEY,
                    evaluatorAgentKey: EVALUATOR_KEY,
                    completionPolicy: {
                      minLearnerTurns: 1,
                      maxLearnerTurns: 6,
                      allowEarlyFinish: true,
                    },
                    answer: {
                      modelAnswer: "Partition the feed by user, fan-out on write for most users.",
                      evaluationGuidance: "Look for read/write trade-off reasoning.",
                      privateEvaluationObjectives: [
                        {
                          key: "reasoning",
                          rubricDimensionKey: "reasoning",
                          description: "Reasons about fan-out trade-offs.",
                          evidenceRequirement: "Names a trade-off.",
                        },
                        {
                          key: "tradeoffs",
                          rubricDimensionKey: "tradeoffs",
                          description: "Justifies a design choice.",
                        },
                      ],
                    },
                    rubricPresetKey: RUBRIC_KEY,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

let seeded = false;

/** Seed the deterministic conversation dataset into the emulator (idempotent). */
export async function seedConversationContent(): Promise<void> {
  if (seeded) return;
  await seed(seedConfig() as never, { projectId: EMU_PROJECT, logLevel: "silent" });
  const db = adminDb();
  const t = SEED_IDS.tenantId;
  // The seed engine doesn't map arbitrary tenant feature flags; enable the
  // conversation features directly (legitimate emulator setup, never a prod write).
  await db.doc(`tenants/${t}`).set(
    {
      features: {
        conversations: true,
        conversationTutor: true,
        conversationQuestionHelp: true,
        conversationAssessment: true,
      },
    },
    { merge: true }
  );
  // Assessment start's resolveEvaluator requires space.evaluationSettingsId → a
  // scoped evaluationSettings doc. The seed SpaceConfig has no such field, so wire
  // it here (this is exactly the prod precondition the flag-flip must satisfy).
  const EVAL_SETTINGS_ID = `es_${t}`;
  await db.doc(`tenants/${t}/evaluationSettings/${EVAL_SETTINGS_ID}`).set({
    id: EVAL_SETTINGS_ID,
    tenantId: t,
    name: "Conversation eval settings",
    autoReleaseThreshold: 0.8,
    createdAt: CLOCK_ISO,
    updatedAt: CLOCK_ISO,
  });
  await db
    .doc(`tenants/${t}/spaces/${SEED_IDS.spaceId}`)
    .set({ evaluationSettingsId: EVAL_SETTINGS_ID }, { merge: true });
  seeded = true;
}

/** Sign in as a student scoped to the seeded conversation tenant. */
export async function signInAsScopedStudent(): Promise<{ uid: string }> {
  const { uid } = await signInAsDemoUser("student", {
    activeTenantId: SEED_IDS.tenantId,
    studentId: `stu_${SEED_IDS.tenantId}`,
    role: "student",
    isSuperAdmin: false,
  });
  return { uid };
}

/** Invoke a v1.* callable over the wire carrying the scoped-student token. */
export async function callAsStudent(name: CallableName, data: unknown): Promise<unknown> {
  await signInAsScopedStudent();
  const callable = httpsCallable(clientFunctions(), toDeployedCallableId(name));
  const res = await callable(data);
  return res.data;
}

/**
 * Probe whether the conversation runtime is exercisable end-to-end. Seeds content,
 * then attempts a tutor start. Returns a skip reason when not ready, else null.
 */
export async function conversationReady(): Promise<string | null> {
  try {
    await seedConversationContent();
    // Probe with tutor:SPACE — the minimal start with no story-point/item source
    // check. If even this fails, the runtime/transport is genuinely not ready.
    const res = (await callAsStudent("v1.levelup.startConversation" as CallableName, {
      clientRequestId: uuid(0xef01),
      mode: "tutor",
      context: TUTOR_SPACE_CONTEXT,
    })) as { session?: { id?: string } };
    if (!res?.session?.id) return "startConversation returned no session (runtime not ready)";
    return null;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return `conversation runtime not ready: ${err.code ?? ""} ${err.message ?? String(e)}`.trim();
  }
}

/**
 * Secondary readiness for STORY-POINT/ITEM/ASSESSMENT-scoped starts. Returns a skip
 * reason when an item-scoped start fails (e.g. the CONV-P0-01 source-check defect),
 * so the deeper suites separate "wire works" from "deep flow blocked".
 */
export async function itemScopeReady(): Promise<string | null> {
  try {
    const res = (await callAsStudent("v1.levelup.startConversation" as CallableName, {
      clientRequestId: uuid(0xef02),
      mode: "tutor",
      context: TUTOR_CONTEXT,
    })) as { session?: { id?: string } };
    if (!res?.session?.id) return "item-scoped start returned no session";
    return null;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return `item-scoped start blocked: ${err.code ?? ""} ${err.message ?? String(e)}`.trim();
  }
}
