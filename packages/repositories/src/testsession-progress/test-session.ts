/**
 * `testSessionRepo` (SDK-LAYERS-PLAN §4.1, domain plan §Repositories).
 *
 * The client edge of the digital-test runtime. Owns:
 *   • IO: start / submit / evaluate / get / list (opaque-cursor paginate).
 *   • Transition pre-checks read `ALLOWED_TRANSITIONS.testSession` (UX-only; the
 *     server re-enforces via `assertTransition`) — `canSubmit`.
 *   • Derived/computed fields (computed once, the UI never recomputes):
 *     `isExpired`/`remainingMs` against an INJECTED server clock (never the
 *     client clock — §6.6), `answeredCount`, `computeProgressPct`,
 *     `computeSectionGroups` (the section→questions view-model), and the
 *     test-runtime view-model assembly.
 *
 * Per-entity repo — imports `api` + `@levelup/domain` ONLY; never a sibling repo
 * (R6). Methods follow the naming convention (list/get/save/paginate for IO,
 * `can`/`is` prefixes for boolean pre-checks, `compute`/`resolve` for derived).
 */
import { canTransition } from "@levelup/domain";
import type {
  DigitalTestSession,
  ItemId,
  StoryPointType,
  TestSessionId,
  TestSessionType,
} from "@levelup/domain";
import type {
  ApiClient,
  DigitalTestSessionSummary,
  DigitalTestSessionView,
  EvaluateAnswerRequest,
  EvaluateAnswerResponse,
  ListTestSessionsRequest,
  PageResponse,
  StartTestSessionRequest,
  StartTestSessionResponse,
  SubmitTestSessionRequest,
  SubmitTestSessionResponse,
} from "./api-types.js";
import { listOnce, paginate, type PageBag } from "./paginate.js";
import { storyPointTypeToSessionType } from "./story-point-type.js";

/** A question entry of the assembled runtime view-model. */
export interface RuntimeQuestionView {
  itemId: ItemId;
  index: number;
  visited: boolean;
  markedForReview: boolean;
  section?: string;
}

/** Section → ordered questions view-model (assembled once from `sectionMapping`). */
export interface SectionGroup {
  section: string;
  questions: RuntimeQuestionView[];
}

export interface TestSessionRepo {
  recordStart(input: StartTestSessionRequest): Promise<StartTestSessionResponse>;
  recordSubmit(input: SubmitTestSessionRequest): Promise<SubmitTestSessionResponse>;
  recordEvaluation(input: EvaluateAnswerRequest): Promise<EvaluateAnswerResponse>;
  get(id: TestSessionId): Promise<DigitalTestSessionView>;
  list(filter: ListTestSessionsRequest): Promise<PageResponse<DigitalTestSessionSummary>>;
  paginate(filter: ListTestSessionsRequest): Promise<PageBag<DigitalTestSessionSummary>>;

  // pre-checks (pure reads of ALLOWED_TRANSITIONS — no wire call)
  canSubmit(session: Pick<DigitalTestSession, "status">): boolean;

  // derived (computed once; server is the authority)
  isExpired(session: Pick<DigitalTestSession, "serverDeadline">, serverNow: Date | string): boolean;
  computeRemainingMs(
    session: Pick<DigitalTestSession, "serverDeadline">,
    serverNow: Date | string
  ): number;
  computeAnsweredCount(session: Pick<DigitalTestSession, "answeredQuestions">): number;
  computeProgressPct(
    session: Pick<DigitalTestSession, "answeredQuestions" | "totalQuestions">
  ): number;
  computeRuntimeView(session: DigitalTestSession): RuntimeQuestionView[];
  computeSectionGroups(session: DigitalTestSession): SectionGroup[];
  resolveSessionTypeLabel(storyPointType: StoryPointType): TestSessionType;
}

function toMillis(when: Date | string): number {
  return when instanceof Date ? when.getTime() : new Date(when).getTime();
}

export function createTestSessionRepo(api: ApiClient): TestSessionRepo {
  const list = (
    filter: ListTestSessionsRequest
  ): Promise<PageResponse<DigitalTestSessionSummary>> =>
    listOnce((req) => api.levelup.listTestSessions(req), filter);

  const repo: TestSessionRepo = {
    recordStart: (input) => api.levelup.startTestSession(input),
    recordSubmit: (input) => api.levelup.submitTestSession(input),
    recordEvaluation: (input) => api.levelup.evaluateAnswer(input),
    get: async (id) => (await api.levelup.getTestSession({ sessionId: id })).session,
    list,
    paginate: (filter) => paginate((req) => api.levelup.listTestSessions(req), filter),

    canSubmit: (session) => canTransition("testSession", session.status, "completed"),

    isExpired: (session, serverNow) => {
      if (session.serverDeadline == null) return false;
      return toMillis(serverNow) >= toMillis(session.serverDeadline);
    },
    computeRemainingMs: (session, serverNow) => {
      if (session.serverDeadline == null) return Number.POSITIVE_INFINITY;
      return Math.max(0, toMillis(session.serverDeadline) - toMillis(serverNow));
    },
    computeAnsweredCount: (session) => session.answeredQuestions,
    computeProgressPct: (session) =>
      session.totalQuestions > 0
        ? Math.round((session.answeredQuestions / session.totalQuestions) * 100)
        : 0,

    computeRuntimeView: (session) =>
      session.questionOrder.map((itemId, index) => {
        const view: RuntimeQuestionView = {
          itemId,
          index,
          visited: session.visitedQuestions[itemId] === true,
          markedForReview: session.markedForReview[itemId] === true,
        };
        const section = session.sectionMapping?.[itemId];
        if (section !== undefined) view.section = section;
        return view;
      }),

    computeSectionGroups: (session) => {
      const order = repo.computeRuntimeView(session);
      const groups = new Map<string, RuntimeQuestionView[]>();
      for (const q of order) {
        const key = q.section ?? "";
        const bucket = groups.get(key);
        if (bucket) bucket.push(q);
        else groups.set(key, [q]);
      }
      return Array.from(groups, ([section, questions]) => ({ section, questions }));
    },

    resolveSessionTypeLabel: (storyPointType) => storyPointTypeToSessionType(storyPointType),
  };

  return repo;
}
