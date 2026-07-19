/**
 * Canonicalization layer (SEED-1 / U4.2 divergence F): every mapping from the seed-config
 * authoring vocabulary to the STRICT `@levelup/domain` shapes lives here, so `pipeline.ts`
 * emits docs that parse the domain Zod schemas with `.strict()` — no audit-field supersets,
 * no enum drift, required-nullable fields written as explicit `null`.
 *
 * Direction is one-way config→canonical: the domain is the SSOT and is never widened here.
 */

import {
  gradeForPercentage,
  STAFF_PERMISSION_KEYS,
  TEACHER_PERMISSION_KEYS,
} from "@levelup/domain";
import type {
  ChatAgentQuestionSeedConfig,
  AchievementConfig,
  CostSummaryConfig,
  MaterialItemConfig,
  QuestionBankItemConfig,
  QuestionItemConfig,
  QuestionType,
  TenantConfig,
  UnifiedRubricInput,
} from "../config/types.js";

// ─────────────────────────── timestamps ───────────────────────────

/** Any parseable date/date-time string → canonical zTimestamp (ISO-8601 UTC with ms). */
export function isoTimestamp(input: string): string {
  const ms = Date.parse(input);
  if (Number.isNaN(ms)) throw new RangeError(`seed: unparseable date "${input}"`);
  return new Date(ms).toISOString();
}

// ─────────────────────────── question / material types ───────────────────────────

/** Seed-config question vocabulary → canonical zQuestionType. */
export const QUESTION_TYPE_MAP: Record<QuestionType, string> = {
  mcq: "mcq",
  msq: "mcaq",
  true_false: "true-false",
  fill_blank: "fill-blanks",
  short_answer: "text",
  long_answer: "paragraph",
  code: "code",
  numeric: "numerical",
  match: "matching",
  ordering: "jumbled",
  essay: "paragraph",
  diagram: "image_evaluation",
  audio_response: "audio",
  file_upload: "image_evaluation",
  oral: "audio",
  chat_agent_question: "chat_agent_question",
};

export const canonicalQuestionType = (qt: QuestionType): string => QUESTION_TYPE_MAP[qt] ?? "text";

/** Count the blanks a fill-in prompt declares (runs of 3+ underscores); at least one. */
function blankIds(q: { prompt: string; answer?: { correctAnswer?: unknown } }): string[] {
  const fromAnswer = Array.isArray(q.answer?.correctAnswer) ? q.answer.correctAnswer.length : 0;
  const fromPrompt = (q.prompt.match(/_{3,}/g) ?? []).length;
  const n = Math.max(1, fromAnswer, fromPrompt);
  return Array.from({ length: n }, (_, i) => `b${i + 1}`);
}

/** matching pairs from options (left) + the answered mapping (right). */
function matchingPairs(
  q: QuestionItemConfig | QuestionBankItemConfig
): { left: string; right: string }[] {
  const ans = (q.answer?.correctAnswer ?? {}) as Record<string, unknown>;
  if (q.options?.length) {
    return q.options.map((o) => ({ left: o.text, right: String(ans[o.id] ?? "") }));
  }
  return Object.entries(ans).map(([left, right]) => ({ left, right: String(right) }));
}

/**
 * Client-facing (answer-stripped) `payload.questionData` for a UnifiedItem. Shape-total per
 * the canonical discriminated union; answers stay in the server-only answerKeys subcollection.
 * (matching/jumbled carry their pair/token surface by design — the canonical payload does.)
 */
export function buildItemQuestionData(
  q: QuestionItemConfig | ChatAgentQuestionSeedConfig,
  resolved: { interviewerAgentId?: string } = {}
): Record<string, unknown> {
  const questionType = canonicalQuestionType(q.questionType);
  if (questionType === "chat_agent_question") {
    const assessment = q as ChatAgentQuestionSeedConfig;
    const interviewerAgentId = resolved.interviewerAgentId;
    if (!interviewerAgentId) {
      throw new Error("chat_agent_question requires a resolved interviewerAgentId");
    }
    return {
      questionType,
      scenario: assessment.scenario,
      publicLearningObjectives: assessment.publicLearningObjectives.map((objective) => ({
        id: objective.key,
        label: objective.label,
      })),
      ...(assessment.conversationStarters?.length
        ? { conversationStarters: [...assessment.conversationStarters] }
        : {}),
      interviewerAgentId,
      completionPolicy: {
        minLearnerTurns: assessment.completionPolicy.minLearnerTurns,
        maxLearnerTurns: assessment.completionPolicy.maxLearnerTurns,
        allowEarlyFinish: assessment.completionPolicy.allowEarlyFinish,
        hardLimitAction: "auto_finalize",
      },
    };
  }
  const standard = q as QuestionItemConfig;
  const options = (standard.options ?? []).map((o) => ({ id: o.id, text: o.text }));
  switch (questionType) {
    case "mcq":
    case "mcaq":
      return { questionType, options };
    case "fill-blanks":
      return {
        questionType,
        template: standard.prompt,
        blanks: blankIds(standard).map((id) => ({ id })),
      };
    case "matching":
      return { questionType, pairs: matchingPairs(standard) };
    case "jumbled":
      return { questionType, tokens: options.map((o) => o.text) };
    default:
      // true-false / numerical / text / paragraph / code / audio / image_evaluation:
      // every non-discriminator field is optional and answer-bearing — omit them all.
      return { questionType };
  }
}

/** Private assessment key: kept structurally separate from the public item payload. */
export function buildChatAgentAnswerKey(q: ChatAgentQuestionSeedConfig): Record<string, unknown> {
  return {
    questionType: "chat_agent_question",
    ...(q.answer.modelAnswer !== undefined ? { modelAnswer: q.answer.modelAnswer } : {}),
    ...(q.answer.evaluationGuidance !== undefined
      ? { evaluationGuidance: q.answer.evaluationGuidance }
      : {}),
    privateEvaluationObjectives: q.answer.privateEvaluationObjectives.map((objective) => ({
      id: objective.key,
      rubricDimensionId: objective.rubricDimensionKey,
      description: objective.description,
      ...(objective.evidenceRequirement !== undefined
        ? { evidenceRequirement: objective.evidenceRequirement }
        : {}),
    })),
  };
}

/** Authoring-side questionData for a QuestionBankItem — answers embedded in-line. */
export function buildBankQuestionData(q: QuestionBankItemConfig): Record<string, unknown> {
  const questionType = canonicalQuestionType(q.questionType);
  const ans = q.answer?.correctAnswer;
  const modelAnswer = q.answer?.modelAnswer ?? (typeof ans === "string" ? ans : undefined);
  const options = (q.options ?? []).map((o) => ({ id: o.id, text: o.text }));
  switch (questionType) {
    case "mcq":
      return { questionType, options: options.map((o) => ({ ...o, isCorrect: o.id === ans })) };
    case "mcaq": {
      const set = new Set(Array.isArray(ans) ? ans.map(String) : [String(ans)]);
      return { questionType, options: options.map((o) => ({ ...o, isCorrect: set.has(o.id) })) };
    }
    case "true-false":
      return { questionType, correctAnswer: Boolean(ans) };
    case "numerical":
      return { questionType, correctAnswer: typeof ans === "number" ? ans : Number(ans) };
    case "fill-blanks": {
      const values = Array.isArray(ans) ? ans.map(String) : [String(ans)];
      return {
        questionType,
        template: q.prompt,
        blanks: blankIds(q).map((id, i) => ({
          id,
          correctAnswer: values[i],
          acceptableAnswers: i === 0 ? q.answer?.acceptableAnswers?.map(String) : undefined,
        })),
      };
    }
    case "matching":
      return { questionType, pairs: matchingPairs(q) };
    case "jumbled": {
      const tokens = options.map((o) => o.text);
      const order = Array.isArray(ans)
        ? ans
            .map((id) => (q.options ?? []).findIndex((o) => o.id === String(id)))
            .filter((i) => i >= 0)
        : undefined;
      return { questionType, tokens, correctOrder: order };
    }
    default:
      return { questionType, modelAnswer };
  }
}

/**
 * Canonical material payload union member. The seed's richer authoring vocabulary
 * (slides/image/audio decks by URL) collapses onto the closest canonical materialType.
 */
export function buildMaterialData(m: MaterialItemConfig): Record<string, unknown> {
  switch (m.materialType) {
    case "reading":
      return { materialType: "text", body: m.body ?? m.title };
    case "video":
      return { materialType: "video", url: m.url ?? "", durationSeconds: m.durationSeconds };
    case "pdf":
      return { materialType: "pdf", url: m.url ?? "" };
    case "link":
      return { materialType: "link", url: m.url ?? "", label: m.title };
    // slides / image / audio have no canonical counterpart — degrade to a labelled link.
    default:
      return { materialType: "link", url: m.url ?? "", label: m.title };
  }
}

// ─────────────────────────── rubric ───────────────────────────

/**
 * Seed rubric input ({key,label,weight}) → canonical UnifiedRubric. Dimension inputs become
 * `dimension_based`; a dimension-less input becomes `holistic`. `totalPoints` is not a
 * canonical rubric field (points live on the item/question) — only the passing PERCENTAGE
 * derived from it survives.
 */
export function canonicalRubric(
  rb: UnifiedRubricInput,
  fallbackMaxScore = 10
): Record<string, unknown> {
  const dims = rb.dimensions ?? [];
  const passingPercentage =
    rb.passingScore != null && rb.totalPoints
      ? Math.round((rb.passingScore / rb.totalPoints) * 100)
      : undefined;
  if (dims.length === 0) {
    return {
      scoringMode: "holistic",
      holisticMaxScore: rb.totalPoints ?? fallbackMaxScore,
      holisticGuidance: rb.evaluatorGuidance,
      passingPercentage,
      modelAnswer: rb.modelAnswer,
      evaluatorGuidance: rb.evaluatorGuidance,
    };
  }
  return {
    scoringMode: "dimension_based",
    dimensions: dims.map((d) => ({
      id: d.key,
      name: d.label,
      priority: "MEDIUM",
      weight: d.weight,
      promptGuidance: d.promptGuidance,
    })),
    passingPercentage,
    modelAnswer: rb.modelAnswer,
    evaluatorGuidance: rb.evaluatorGuidance,
  };
}

/** Required-rubric fallback (ExamQuestion.rubric is non-optional): plain holistic scale. */
export const defaultHolisticRubric = (maxScore: number): Record<string, unknown> => ({
  scoringMode: "holistic",
  holisticMaxScore: maxScore,
});

/** Canonical EvaluationDimension[] from a seed rubric input (for EvaluationSettings). */
export const rubricDimensions = (rb?: UnifiedRubricInput): Record<string, unknown>[] =>
  (rb?.dimensions ?? []).map((d) => ({
    id: d.key,
    name: d.label,
    priority: "MEDIUM",
    weight: d.weight,
    promptGuidance: d.promptGuidance,
  }));

// ─────────────────────────── permissions ───────────────────────────

/**
 * zod-v4 `z.record(zEnumKey, z.boolean())` is EXHAUSTIVE — a permissions record must carry
 * every key. Fill unset keys with false; keys outside the domain list are dropped.
 */
export function fullTeacherPermissions(
  p?: Partial<Record<string, boolean>>
): Record<string, boolean> {
  return Object.fromEntries(TEACHER_PERMISSION_KEYS.map((k) => [k, p?.[k] ?? false]));
}

export function fullStaffPermissions(
  p?: Partial<Record<string, boolean>>
): Record<string, boolean> {
  return Object.fromEntries(STAFF_PERMISSION_KEYS.map((k) => [k, p?.[k] ?? false]));
}

// ─────────────────────────── enum maps ───────────────────────────

/** Tenant plan: seed 'starter' → canonical 'basic'; 'pending' status → 'trial'. */
export const TENANT_PLAN_MAP: Record<string, string> = {
  free: "free",
  starter: "basic",
  premium: "premium",
  enterprise: "enterprise",
};
export const TENANT_STATUS_MAP: Record<string, string> = {
  active: "active",
  trial: "trial",
  suspended: "suspended",
  deactivated: "deactivated",
  pending: "trial",
};

/** Seed feature flags → canonical TenantFeatures {autograde, levelup, analytics, store}. */
export function canonicalFeatures(f?: Record<string, boolean>): Record<string, boolean> {
  const src = f ?? {};
  const out: Record<string, boolean> = {};
  const put = (key: string, v: boolean | undefined) => {
    if (v !== undefined) out[key] = v;
  };
  put("autograde", src.autograde ?? src.exams);
  put("levelup", src.levelup ?? src.spaces);
  put("analytics", src.analytics ?? src.ai);
  put("store", src.store);
  return out;
}

/** People status (invited/suspended have no canonical value on tenant entities). */
export const PERSON_STATUS_MAP: Record<string, string> = {
  active: "active",
  invited: "active",
  suspended: "archived",
  archived: "archived",
};

export const ACADEMIC_SESSION_STATUS_MAP: Record<string, string> = {
  active: "active",
  upcoming: "active",
  completed: "archived",
  archived: "archived",
};

export const EXAM_STATUS_MAP: Record<string, string> = {
  draft: "draft",
  published: "published",
  grading: "grading",
  graded: "grading",
  released: "results_released",
  archived: "archived",
};

/** Coarse seed submission status → canonical SubmissionPipelineStatus. */
export const SUBMISSION_STATUS_TO_PIPELINE: Record<string, string> = {
  pending: "uploaded",
  scouting: "scouting",
  mapping: "scouting_complete",
  grading: "grading",
  graded: "grading_complete",
  finalized: "ready_for_review",
  released: "reviewed",
  failed: "failed",
};

export const GRADING_STATUS_MAP: Record<string, string> = {
  pending: "pending",
  processing: "processing",
  grading: "processing",
  graded: "graded",
  needs_review: "needs_review",
  failed: "failed",
  manual: "manual",
  overridden: "overridden",
};

export const TEST_SESSION_STATUS_MAP: Record<string, string> = {
  in_progress: "in_progress",
  submitted: "completed",
  graded: "completed",
  expired: "expired",
};

export const ANNOUNCEMENT_SCOPE_MAP: Record<string, string> = {
  platform: "platform",
  tenant: "tenant",
  class: "tenant", // narrowing is expressed by targetClassIds
  role: "tenant", // narrowing is expressed by targetRoles
};

export const ANNOUNCEMENT_TARGET_ROLES = new Set(["teacher", "student", "parent", "tenantAdmin"]);

export const AGENT_TYPE_FOR_PURPOSE: Record<string, string> = {
  answer_grading: "evaluator",
  evaluation: "evaluator",
  tutoring: "tutor",
};

export const NOTIFICATION_TYPE_MAP: Record<string, string> = {
  exam_results_released: "exam_results_released",
  new_exam_assigned: "new_exam_assigned",
  new_space_assigned: "new_space_assigned",
  submission_graded: "submission_graded",
  grading_complete: "grading_complete",
  student_at_risk: "student_at_risk",
  deadline_reminder: "deadline_reminder",
  space_published: "space_published",
  bulk_import_complete: "bulk_import_complete",
  ai_budget_alert: "ai_budget_alert",
  system_announcement: "system_announcement",
  // seed vocabulary → nearest canonical
  child_result: "exam_results_released",
  child_at_risk: "student_at_risk",
  test_graded: "submission_graded",
  test_grading_pending: "grading_complete",
  grading_needs_review: "grading_complete",
  pending_grade: "grading_complete",
  achievement_unlocked: "system_announcement",
  chat_reply: "system_announcement",
  high_score: "submission_graded",
};

/** Insight seed type → canonical {type, actionType, title}. */
export const INSIGHT_MAP: Record<string, { type: string; actionType: string; title: string }> = {
  weak_topic_recommendation: {
    type: "weak_topic_recommendation",
    actionType: "practice_space",
    title: "Practice Recommendation",
  },
  exam_preparation: {
    type: "exam_preparation",
    actionType: "review_exam",
    title: "Exam Preparation",
  },
  streak_encouragement: {
    type: "streak_encouragement",
    actionType: "practice_space",
    title: "Keep Your Streak Going",
  },
  improvement_celebration: {
    type: "improvement_celebration",
    actionType: "celebrate",
    title: "Great Improvement",
  },
  at_risk_intervention: {
    type: "at_risk_intervention",
    actionType: "seek_help",
    title: "At-Risk Alert",
  },
  cross_system_correlation: {
    type: "cross_system_correlation",
    actionType: "review_exam",
    title: "Performance Correlation",
  },
  // seed vocabulary → nearest canonical
  at_risk: { type: "at_risk_intervention", actionType: "seek_help", title: "At-Risk Alert" },
  stalled_progress: {
    type: "at_risk_intervention",
    actionType: "practice_space",
    title: "Progress Stalled",
  },
  improvement: {
    type: "improvement_celebration",
    actionType: "celebrate",
    title: "Great Improvement",
  },
  engagement: {
    type: "streak_encouragement",
    actionType: "practice_space",
    title: "Keep Your Streak Going",
  },
  early_sessions: {
    type: "streak_encouragement",
    actionType: "practice_space",
    title: "Nice Start",
  },
  pending_grade: {
    type: "exam_preparation",
    actionType: "review_exam",
    title: "Grading In Progress",
  },
};

export const INSIGHT_PRIORITY_MAP: Record<string, string> = {
  critical: "high",
  warning: "medium",
  info: "low",
};

// ─────────────────────────── gamification maps ───────────────────────────

export const ACHIEVEMENT_CATEGORY_MAP: Record<string, string> = {
  learning: "learning",
  consistency: "consistency",
  excellence: "excellence",
  exploration: "exploration",
  social: "social",
  milestone: "milestone",
  streak: "consistency",
  habit: "consistency",
  mastery: "excellence",
  performance: "excellence",
  volume: "learning",
};

export const ACHIEVEMENT_CRITERIA_TYPE_MAP: Record<string, string> = {
  spaces_completed: "spaces_completed",
  story_points_completed: "story_points_completed",
  exams_passed: "exams_passed",
  perfect_scores: "perfect_scores",
  streak_days: "streak_days",
  total_points: "total_points",
  items_completed: "items_completed",
  chat_sessions: "chat_sessions",
  leaderboard_top3: "leaderboard_top3",
  login_days: "login_days",
  tests_completed: "exams_passed",
  perfect_quiz: "perfect_scores",
  storypoints_completed: "story_points_completed",
  high_score: "perfect_scores",
};

export const TIER_RARITY_MAP: Record<string, string> = {
  bronze: "common",
  silver: "uncommon",
  gold: "rare",
  platinum: "epic",
  diamond: "legendary",
};

export const TIER_POINTS_MAP: Record<string, number> = {
  bronze: 10,
  silver: 25,
  gold: 50,
  platinum: 100,
  diamond: 250,
};

const CATEGORY_ICON: Record<string, string> = {
  learning: "📚",
  consistency: "🔥",
  excellence: "🏆",
  exploration: "🧭",
  social: "🤝",
  milestone: "🎯",
};

/** A full canonical Achievement doc (also embedded verbatim in StudentAchievement). */
export function canonicalAchievement(
  a: AchievementConfig,
  ids: { id: string; tenantId: string },
  now: string
): Record<string, unknown> {
  const tier = a.tier ?? "bronze";
  const category = ACHIEVEMENT_CATEGORY_MAP[a.category ?? "milestone"] ?? "milestone";
  return {
    id: ids.id,
    tenantId: ids.tenantId,
    title: a.name,
    description: a.description ?? a.name,
    icon: CATEGORY_ICON[category] ?? "🏅",
    category,
    rarity: TIER_RARITY_MAP[tier] ?? "common",
    tier,
    criteria: {
      type:
        ACHIEVEMENT_CRITERIA_TYPE_MAP[a.criteria?.type ?? "items_completed"] ?? "items_completed",
      threshold: a.criteria?.target ?? 1,
    },
    pointsReward: TIER_POINTS_MAP[tier] ?? 10,
    isActive: a.isActive ?? true,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
}

export const GOAL_TARGET_TYPE_MAP: Record<string, string> = {
  spaces: "spaces",
  story_points: "story_points",
  items: "items",
  exams: "exams",
  minutes: "minutes",
  items_completed: "items",
  minutes_per_day: "minutes",
  storypoints_completed: "story_points",
  tests_passed: "exams",
};

// ─────────────────────────── evaluation results ───────────────────────────

/**
 * Seed evaluation input → canonical UnifiedEvaluationResult / StoredEvaluation
 * (correctness/percentage/confidence/gradedAt are required; cost collapses to
 * tokensUsed/costUsd; feedback → summary; improvements → weaknesses).
 */
export function canonicalEvaluation(
  e: {
    score: number;
    maxScore: number;
    confidence?: number;
    feedback?: string;
    strengths?: string[];
    improvements?: string[];
    cost?: { tokensIn: number; tokensOut: number; usd: number };
  },
  gradedAt: string
): Record<string, unknown> {
  const correctness = e.maxScore > 0 ? Number((e.score / e.maxScore).toFixed(4)) : 0;
  return {
    score: e.score,
    maxScore: e.maxScore,
    correctness,
    percentage: Math.round(correctness * 100),
    strengths: e.strengths ?? [],
    weaknesses: e.improvements ?? [],
    missingConcepts: [],
    summary: e.feedback,
    confidence: e.confidence ?? 0.9,
    tokensUsed: e.cost ? e.cost.tokensIn + e.cost.tokensOut : undefined,
    costUsd: e.cost?.usd,
    gradedAt,
  };
}

/** Canonical released-summary grade letter for a percentage (domain grade bands). */
export const gradeFor = (pct: number): string => gradeForPercentage(pct) as string;

// ─────────────────────────── cost summaries ───────────────────────────

const COST_MODEL = "gemini-2.0-flash";
const INPUT_TOKEN_SHARE = 0.75;

/** Split flat per-purpose USD into the canonical {calls,inputTokens,outputTokens,costUsd} blocks. */
export function canonicalCostBreakdown(c: CostSummaryConfig): {
  byPurpose: Record<string, Record<string, number>>;
  byModel: Record<string, Record<string, number>>;
  totalInputTokens: number;
  totalOutputTokens: number;
} {
  const totalInputTokens = Math.round(c.totalTokens * INPUT_TOKEN_SHARE);
  const totalOutputTokens = c.totalTokens - totalInputTokens;
  const byPurpose: Record<string, Record<string, number>> = {};
  const purposes = Object.entries(c.byPurpose ?? {});
  for (const [purpose, usd] of purposes) {
    const share = c.totalUsd > 0 ? usd / c.totalUsd : 1 / Math.max(1, purposes.length);
    const tokens = Math.round(c.totalTokens * share);
    const inputTokens = Math.round(tokens * INPUT_TOKEN_SHARE);
    byPurpose[purpose] = {
      calls: Math.max(1, Math.round(c.callCount * share)),
      inputTokens,
      outputTokens: tokens - inputTokens,
      costUsd: usd,
    };
  }
  return {
    byPurpose,
    byModel: {
      [COST_MODEL]: {
        calls: c.callCount,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        costUsd: c.totalUsd,
      },
    },
    totalInputTokens,
    totalOutputTokens,
  };
}

// ─────────────────────────── people lookups ───────────────────────────

export type CanonicalRecipientRole = "teacher" | "student" | "parent" | "tenantAdmin";

/** Canonical Notification.recipientRole for a person logical key. */
export function recipientRoleFor(tc: TenantConfig, personKey: string): CanonicalRecipientRole {
  if (tc.students?.some((s) => s.key === personKey)) return "student";
  if (tc.teachers?.some((t) => t.key === personKey)) return "teacher";
  if (tc.parents?.some((p) => p.key === personKey)) return "parent";
  return "tenantAdmin"; // admins / staff / scanners collapse to the admin surface
}

/** Display name for a person logical key (announcements/authorName, review userName …). */
export function personNameFor(tc: TenantConfig, personKey?: string): string {
  if (!personKey) return "LevelUp System";
  const pools: {
    key: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    label?: string;
  }[] = [
    ...(tc.admins ?? []),
    ...(tc.teachers ?? []),
    ...(tc.students ?? []),
    ...(tc.parents ?? []),
    ...(tc.staff ?? []),
    ...(tc.scanners ?? []).map((s) => ({ key: s.key, label: s.label })),
  ];
  const p = pools.find((x) => x.key === personKey);
  if (!p) return "LevelUp System";
  return (
    p.displayName ??
    p.label ??
    [p.firstName, p.lastName].filter(Boolean).join(" ") ??
    "LevelUp System"
  );
}
