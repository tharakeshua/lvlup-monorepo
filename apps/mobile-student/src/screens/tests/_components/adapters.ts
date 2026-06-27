/**
 * Defensive view-model adapters over the `@levelup/query` testsession hooks.
 *
 * Per the GATE-0 note in MOBILE-BUILD-CONTRACT.md, the deployed `lvlup-ff6fa`
 * backend returns reads whose RUNTIME shape drifts from the `@levelup/domain`
 * TS types (response validation is OFF at `src/sdk`, so "types lie"). Every read
 * here optional-chains and defaults; nothing assumes a nested field exists.
 *
 * The hooks return `unknown`; these functions narrow to the *shape we render*,
 * tolerating both the typed `DigitalTestSession` and the drifted projection.
 */

type Dict = Record<string, unknown>;

function obj(v: unknown): Dict {
  return v && typeof v === "object" ? (v as Dict) : {};
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

/** Flatten an infinite-query result (or a plain list/page) into a flat array. */
export function flattenPages<T = Dict>(data: unknown): T[] {
  const d = obj(data);
  // useInfiniteQuery → { pages: [{ items: [...] }, ...] }
  if (Array.isArray(d.pages)) {
    return (d.pages as unknown[]).flatMap((p) => {
      const items = obj(p).items;
      return Array.isArray(items) ? (items as T[]) : [];
    });
  }
  if (Array.isArray(d.items)) return d.items as T[];
  if (Array.isArray(data)) return data as T[];
  return [];
}

/** A normalized test session as the tests screens consume it. */
export interface SessionVM {
  id: string;
  spaceId: string;
  storyPointId: string;
  status: string;
  attemptNumber: number;
  isLatest: boolean;
  title: string;
  spaceTitle: string;
  durationMinutes?: number;
  totalQuestions?: number;
  answeredQuestions?: number;
  totalMarks?: number;
  marksEarned?: number;
  totalPoints?: number;
  pointsEarned?: number;
  percentage?: number;
  passMark?: number;
  passed?: boolean;
  serverDeadline?: string;
  windowLabel?: string;
  cooldownSecs?: number;
  questionOrder: string[];
  visited: Record<string, boolean>;
  marked: Record<string, boolean>;
  raw: Dict;
}

export function readSession(input: unknown): SessionVM {
  const s = obj(input);
  const pctVal = num(s.percentage);
  const passMark = num(s.passingPercentage) ?? num(s.passMark);
  return {
    id: str(s.id) ?? str(s.sessionId) ?? "",
    spaceId: str(s.spaceId) ?? "",
    storyPointId: str(s.storyPointId) ?? "",
    status: str(s.status) ?? "completed",
    attemptNumber: num(s.attemptNumber) ?? 1,
    isLatest: bool(s.isLatest) ?? false,
    title:
      str(s.title) ??
      str(s.testTitle) ??
      str(s.storyPointTitle) ??
      str(obj(s.storyPoint).title) ??
      "Test",
    spaceTitle:
      str(s.spaceTitle) ?? str(s.spaceName) ?? str(obj(s.space).title) ?? str(s.spaceId) ?? "",
    durationMinutes: num(s.durationMinutes),
    totalQuestions: num(s.totalQuestions),
    answeredQuestions: num(s.answeredQuestions),
    totalMarks: num(s.totalMarks) ?? num(s.maxMarks),
    marksEarned: num(s.marksEarned),
    totalPoints: num(s.totalPoints),
    pointsEarned: num(s.pointsEarned),
    percentage: pctVal,
    passMark,
    passed: bool(s.passed) ?? (pctVal != null && passMark != null ? pctVal >= passMark : undefined),
    serverDeadline: str(s.serverDeadline),
    windowLabel: str(s.windowLabel) ?? str(s.windowNote),
    cooldownSecs: num(s.cooldownSecs) ?? num(s.cooldownSeconds),
    questionOrder: Array.isArray(s.questionOrder) ? (s.questionOrder as unknown[]).map(String) : [],
    visited: obj(s.visitedQuestions) as Record<string, boolean>,
    marked: obj(s.markedForReview) as Record<string, boolean>,
    raw: s,
  };
}

export function readSessions(data: unknown): SessionVM[] {
  return flattenPages(data).map(readSession);
}

/** Pick the latest attempt (isLatest, else highest attemptNumber). */
export function latestSession(sessions: SessionVM[]): SessionVM | undefined {
  if (sessions.length === 0) return undefined;
  const flagged = sessions.find((s) => s.isLatest);
  if (flagged) return flagged;
  return [...sessions].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
}

/** A breakdown row (difficulty / bloom / section / topic). */
export interface BreakdownRow {
  label: string;
  got: number;
  max: number;
}

function readBreakdown(map: unknown): BreakdownRow[] {
  const m = obj(map);
  return Object.keys(m).map((key) => {
    const e = obj(m[key]);
    return {
      label: key,
      got: num(e.correct) ?? num(e.points) ?? 0,
      max: num(e.total) ?? num(e.maxPoints) ?? 0,
    };
  });
}

export interface AnalyticsVM {
  difficulty: BreakdownRow[];
  bloom: BreakdownRow[];
  section: BreakdownRow[];
  topic: BreakdownRow[];
  averageTimePerQuestion?: number;
  progression: { q: number; diff: string; correct: boolean }[];
}

export function readAnalytics(session: unknown): AnalyticsVM {
  const s = obj(session);
  const a = obj(s.analytics);
  const prog = Array.isArray(s.difficultyProgression) ? (s.difficultyProgression as unknown[]) : [];
  return {
    difficulty: readBreakdown(a.difficultyBreakdown),
    bloom: readBreakdown(a.bloomsBreakdown),
    section: readBreakdown(a.sectionBreakdown),
    topic: readBreakdown(a.topicBreakdown),
    averageTimePerQuestion: num(a.averageTimePerQuestion),
    progression: prog.map((p, i) => {
      const e = obj(p);
      return {
        q: (num(e.questionIndex) ?? i) + 1,
        diff: str(e.difficulty) ?? "med",
        correct: bool(e.correct) ?? false,
      };
    }),
  };
}

/** Per-question review item (from a session's submissions subcollection). */
export interface ReviewQuestionVM {
  n: number;
  prompt: string;
  your: string;
  correct: boolean;
  feedback: string;
  ai: boolean;
  confidence?: "low" | "med" | "high";
  section?: string;
  diff?: string;
  type?: string;
  rubric?: { label: string; desc?: string; score: number; max: number }[];
}

export function readReviewQuestions(input: unknown): ReviewQuestionVM[] {
  const s = obj(input);
  const subs = Array.isArray(s.submissions)
    ? (s.submissions as unknown[])
    : Array.isArray(s.questions)
      ? (s.questions as unknown[])
      : [];
  return subs.map((raw, i) => {
    const q = obj(raw);
    const evalr = obj(q.evaluation);
    const conf = num(evalr.confidence);
    const rubricSrc = Array.isArray(evalr.rubricBreakdown)
      ? (evalr.rubricBreakdown as unknown[])
      : [];
    return {
      n: num(q.questionNumber) ?? i + 1,
      prompt: str(q.prompt) ?? str(obj(q.question).prompt) ?? "",
      your: stringifyAnswer(q.answer),
      correct: bool(q.correct) ?? false,
      feedback: str(evalr.summary) ?? str(q.feedback) ?? "",
      ai: bool(q.aiGraded) ?? evalr.gradedAt != null,
      confidence: conf == null ? undefined : conf >= 0.8 ? "high" : conf >= 0.5 ? "med" : "low",
      section: str(q.section),
      diff: str(q.difficulty),
      type: str(q.questionType),
      rubric: rubricSrc.length
        ? rubricSrc.map((r) => {
            const rb = obj(r);
            return {
              label: str(rb.label) ?? str(rb.criterion) ?? "",
              desc: str(rb.description) ?? str(rb.desc),
              score: num(rb.score) ?? num(rb.pointsEarned) ?? 0,
              max: num(rb.maxScore) ?? num(rb.max) ?? 0,
            };
          })
        : undefined,
    };
  });
}

function stringifyAnswer(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(stringifyAnswer).join(", ");
  return "—";
}
