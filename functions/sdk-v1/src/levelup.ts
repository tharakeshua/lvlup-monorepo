/**
 * `v1.levelup.*` callable / trigger / scheduler wiring (content + testsession +
 * gamification, per SDK-LAYERS-PLAN §2.2/§2.3/§2.4).
 *
 * Each `export const <op>` becomes `v1.levelup.<op>` (deployed id `v1-levelup-<op>`,
 * derived from the nested `v1.levelup` export group in index.ts). Runtime ports
 * (repos/ai/clock) are injected by `./bootstrap`; do NOT re-wire them here.
 *
 * ── Backing-service coverage ──
 * LVL-2 closed the wire gap: every `v1.levelup.*` contract callable now has a
 * backing `@levelup/services` fn and is exported here (content CRUD + versions,
 * question bank, rubric presets, agents, store/reviews, progress list,
 * assignContent, generateContent). Nothing in this module invents business
 * logic — it is registration only.
 */
import {
  makeCallable,
  makeScheduler,
  type ServiceFn,
  type SchedulerService,
} from "@levelup/functions-adapters";
import type { CallableName, ReqOf, ResOf } from "@levelup/api-contract";
import type {
  AuthContext as ServicesAuthContext,
  SystemContext as ServicesSystemContext,
} from "@levelup/services";
import {
  // content authoring + read slice
  saveSpaceService,
  duplicateSpaceService,
  saveStoryPointService,
  saveItemService,
  getItemForEditService,
  listItemsService,
  listSpacesService,
  getSpaceService,
  getEvaluationConfigService,
  listStoryPointsService,
  getStoryPointService,
  listVersionsService,
  generateContentService,
  assignContentService,
  // question bank / rubric presets / agents (LVL-2 authoring slice)
  listQuestionBankService,
  saveQuestionBankItemService,
  importFromBankService,
  listRubricPresetsService,
  saveRubricPresetService,
  listAgentsService,
  saveAgentService,
  // test-session slice
  startTestSessionService,
  submitTestSessionService,
  saveTestAnswerService,
  getTestSessionService,
  listTestSessionsService,
  // practice slice
  evaluateAnswerService,
  recordItemAttemptService,
  getSpaceProgressService,
  getStoryPointProgressService,
  listSpaceProgressForUserService,
  // purchase / store slice
  purchaseSpaceService,
  listStoreSpacesService,
  getStoreSpaceService,
  listSpaceReviewsService,
  saveSpaceReviewService,
  // chat slice
  sendChatMessageService,
  getChatSessionService,
  listChatSessionsService,
  // server-authoritative conversations (T-D; finish + recovery owned by T-E)
  startConversationService,
  sendConversationTurnService,
  getConversationService,
  listConversationsService,
  abandonConversationService,
  finishConversationService,
  resumeConversationFinalizationsService,
  // gamification slice
  getGamificationSummaryService,
  getStudentLevelService,
  listAchievementsService,
  listStudentAchievementsService,
  markAchievementsSeenService,
  saveAchievementDefinitionService,
  levelupGetLeaderboardService,
  listStudyGoalsService,
  saveStudyGoalService,
  listStudySessionsService,
  listLearningInsightsService,
  levelupDismissInsightService,
  // triggers / schedulers
  expireTestSessionsService,
  cleanupStaleSessionsService,
} from "@levelup/services";

/**
 * Service-fn → callable wire helper (the SINGLE sanctioned T9/structural-port-seam
 * cast at the wiring boundary; the symmetric twin of bootstrap.ts's injection cast).
 *
 * A `@levelup/services` service fn is typed `(input, ctx: ServicesAuthContext)`,
 * where `ServicesAuthContext.repos` is the RICH `repo-admin` `Repos`. The adapter's
 * `ServiceFn<N>` types `ctx` against the adapter-layer `AuthContext`, whose `repos`
 * is the deliberately-minimal structural `Repos` port (`context/ports.ts`). The
 * concrete runtime injects the rich repos (see bootstrap.ts), so the two contexts
 * are structurally reconcilable but nominally distinct ONLY at the `repos` port.
 * `@levelup/services` declares its `AuthContext` as the structural shape the real
 * `buildAuthContext` result satisfies — i.e. these are the same value at runtime.
 *
 * `call` re-types a service fn (input/output stay fully checked against the contract
 * via `ReqOf`/`ResOf`) as the adapter `ServiceFn<N>`, casting ONLY the ctx seam. No
 * `any`; the cast is confined to this one boundary until the reconciliation wave
 * replaces the local `context/ports.ts` port with the concrete `repo-admin` types.
 */
type ServicesServiceFn<N extends CallableName> = (
  input: ReqOf<N>,
  ctx: ServicesAuthContext
) => Promise<ResOf<N>>;

function call<N extends CallableName>(name: N, service: ServicesServiceFn<N>) {
  return makeCallable(name, service as unknown as ServiceFn<N>);
}

/** Scheduler twin of `call` — same single T9 ctx-seam cast (services `SystemContext`
 *  ↔ adapter `SystemContext`, differing only in the rich-vs-minimal `repos` port). */
function schedule(spec: string, service: (ctx: ServicesSystemContext) => Promise<void>) {
  return makeScheduler(spec, service as unknown as SchedulerService);
}

// ── content authoring + reads ────────────────────────────────────────────────
export const saveSpace = call("v1.levelup.saveSpace", saveSpaceService);
export const duplicateSpace = call("v1.levelup.duplicateSpace", duplicateSpaceService);
export const saveStoryPoint = call("v1.levelup.saveStoryPoint", saveStoryPointService);
export const saveItem = call("v1.levelup.saveItem", saveItemService);
export const getItemForEdit = call("v1.levelup.getItemForEdit", getItemForEditService);
export const listItems = call("v1.levelup.listItems", listItemsService);
export const listSpaces = call("v1.levelup.listSpaces", listSpacesService);
export const getSpace = call("v1.levelup.getSpace", getSpaceService);
export const getEvaluationConfig = call(
  "v1.levelup.getEvaluationConfig",
  getEvaluationConfigService
);
export const listStoryPoints = call("v1.levelup.listStoryPoints", listStoryPointsService);
export const getStoryPoint = call("v1.levelup.getStoryPoint", getStoryPointService);
export const listVersions = call("v1.levelup.listVersions", listVersionsService);
export const generateContent = call("v1.levelup.generateContent", generateContentService);
export const assignContent = call("v1.levelup.assignContent", assignContentService);

// ── question bank / rubric presets / agents (LVL-2 authoring slice) ─────────
export const listQuestionBank = call("v1.levelup.listQuestionBank", listQuestionBankService);
export const saveQuestionBankItem = call(
  "v1.levelup.saveQuestionBankItem",
  saveQuestionBankItemService
);
export const importFromBank = call("v1.levelup.importFromBank", importFromBankService);
export const listRubricPresets = call("v1.levelup.listRubricPresets", listRubricPresetsService);
export const saveRubricPreset = call("v1.levelup.saveRubricPreset", saveRubricPresetService);
export const listAgents = call("v1.levelup.listAgents", listAgentsService);
export const saveAgent = call("v1.levelup.saveAgent", saveAgentService);

// ── test sessions ──────────────────────────────────────────────────────────
export const startTestSession = call("v1.levelup.startTestSession", startTestSessionService);
export const submitTestSession = call("v1.levelup.submitTestSession", submitTestSessionService);
export const saveTestAnswer = call("v1.levelup.saveTestAnswer", saveTestAnswerService);
export const getTestSession = call("v1.levelup.getTestSession", getTestSessionService);
export const listTestSessions = call("v1.levelup.listTestSessions", listTestSessionsService);

// ── practice / progress ──────────────────────────────────────────────────────
export const evaluateAnswer = call("v1.levelup.evaluateAnswer", evaluateAnswerService);
export const recordItemAttempt = call("v1.levelup.recordItemAttempt", recordItemAttemptService);
export const getSpaceProgress = call("v1.levelup.getSpaceProgress", getSpaceProgressService);
export const listSpaceProgressForUser = call(
  "v1.levelup.listSpaceProgressForUser",
  listSpaceProgressForUserService
);
export const getStoryPointProgress = call(
  "v1.levelup.getStoryPointProgress",
  getStoryPointProgressService
);

// ── purchase / store (B2C) ───────────────────────────────────────────────────
export const purchaseSpace = call("v1.levelup.purchaseSpace", purchaseSpaceService);
export const listStoreSpaces = call("v1.levelup.listStoreSpaces", listStoreSpacesService);
export const getStoreSpace = call("v1.levelup.getStoreSpace", getStoreSpaceService);
export const listSpaceReviews = call("v1.levelup.listSpaceReviews", listSpaceReviewsService);
export const saveSpaceReview = call("v1.levelup.saveSpaceReview", saveSpaceReviewService);

// ── chat (AI tutor) ──────────────────────────────────────────────────────────
export const sendChatMessage = call("v1.levelup.sendChatMessage", sendChatMessageService);
export const getChatSession = call("v1.levelup.getChatSession", getChatSessionService);
export const listChatSessions = call("v1.levelup.listChatSessions", listChatSessionsService);

// ── durable conversations ──────────────────────────────────────────────────
export const startConversation = call("v1.levelup.startConversation", startConversationService);
export const sendConversationTurn = call(
  "v1.levelup.sendConversationTurn",
  sendConversationTurnService
);
export const getConversation = call("v1.levelup.getConversation", getConversationService);
export const listConversations = call("v1.levelup.listConversations", listConversationsService);
export const abandonConversation = call(
  "v1.levelup.abandonConversation",
  abandonConversationService
);
/** Learner-requested finalization; the server owns grading + progress application (T-E). */
export const finishConversation = call("v1.levelup.finishConversation", finishConversationService);

// ── gamification / insights (core-owned fold, v1.levelup.* namespace) ────────
export const getGamificationSummary = call(
  "v1.levelup.getGamificationSummary",
  getGamificationSummaryService
);
export const getStudentLevel = call("v1.levelup.getStudentLevel", getStudentLevelService);
export const listAchievements = call("v1.levelup.listAchievements", listAchievementsService);
export const listStudentAchievements = call(
  "v1.levelup.listStudentAchievements",
  listStudentAchievementsService
);
export const markAchievementsSeen = call(
  "v1.levelup.markAchievementsSeen",
  markAchievementsSeenService
);
export const saveAchievementDefinition = call(
  "v1.levelup.saveAchievementDefinition",
  saveAchievementDefinitionService
);
// levelup-canonical leaderboard (the analytics module wires the *AnalyticsService twin).
export const getLeaderboard = call("v1.levelup.getLeaderboard", levelupGetLeaderboardService);
export const listStudyGoals = call("v1.levelup.listStudyGoals", listStudyGoalsService);
export const saveStudyGoal = call("v1.levelup.saveStudyGoal", saveStudyGoalService);
export const listStudySessions = call("v1.levelup.listStudySessions", listStudySessionsService);
export const listLearningInsights = call(
  "v1.levelup.listLearningInsights",
  listLearningInsightsService
);
// levelup-canonical dismissInsight (the analytics module wires the *AnalyticsService twin).
export const dismissInsight = call("v1.levelup.dismissInsight", levelupDismissInsightService);

// ── schedulers (thin wrappers over @levelup/services scheduler fns) ──────────
/** Sweep past-deadline in_progress sessions → expire+grade (single-writer expire half). */
export const expireTestSessions = schedule("every 5 minutes", expireTestSessionsService);
/** Abandon stale (>24h) in_progress sessions, skipping past-deadline ones (expire precedence). */
export const cleanupStaleSessions = schedule("every 1 hours", cleanupStaleSessionsService);
/**
 * Tenant-scoped conversation finalization repair worker (LLD §13.2). Resumes
 * hard-limit auto-finalizations, stale `finalizing` sessions, due `grading_failed`
 * submissions, and post-evaluation crashes (evaluated/progress-applied submissions
 * whose session never reached `completed`) via the replay-safe finalization path.
 */
export const resumeConversationFinalizations = schedule("every 5 minutes", async (ctx) => {
  // The worker returns a per-tenant repair report for observability; the scheduler
  // seam only needs completion, so the report is dropped here (logged upstream).
  await resumeConversationFinalizationsService(ctx);
});
