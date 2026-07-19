/**
 * The SINGLE source of truth for Firestore collection/document paths used by the seed engine.
 * Mirrors `@levelup/repository-admin/paths.ts`. Canonical decisions baked in:
 *
 * - D1: ONE nested item path `spaces/{s}/storyPoints/{sp}/items/{id}` (flat path deleted).
 * - §6.4: answer keys at `items/{itemId}/answerKeys/{itemId}` (server-only, deny-all subcollection).
 * - D6: test-session answers at `digitalTestSessions/{sid}/submissions/{itemId}` (always-subcollection).
 * - D11: scanners tenant-scoped at `tenants/{t}/scanners/{id}` (top-level `/scanners` deleted).
 * - D13: `spaceProgress/{userId}_{spaceId}`; `costSummaries/{daily|monthly}/{id}` flat.
 * - Membership: `userMemberships/{uid}_{tenantId}` (single representation).
 */

/**
 * The env-driven top-level collection prefix (Student-Vertical, Slice A). Default
 * `''` → ZERO behaviour change (emulator/dev). When set (e.g. `v2_`) it prefixes
 * ONLY the FIRST (top-level) path segment; tenant-scoped subcollections inherit
 * the prefix because they are built from the prefixed `tenant()` root — they are
 * NOT double-prefixed. MUST stay mirrored with `repo-admin/paths.ts`.
 */
const PFX = (): string => process.env["LVLUP_COLLECTION_PREFIX"] ?? "";

/** Prefix a top-level collection name (the first path segment only). */
const top = (name: string): string => `${PFX()}${name}`;

export const Paths = {
  // ---- platform-root (un-tenant-scoped) ----
  user: (uid: string) => `${top("users")}/${uid}`,
  users: () => top("users"),
  membership: (uid: string, tenantId: string) => `${top("userMemberships")}/${uid}_${tenantId}`,
  memberships: () => top("userMemberships"),
  tenant: (t: string) => `${top("tenants")}/${t}`,
  tenants: () => top("tenants"),
  tenantCode: (code: string) => `${top("tenantCodes")}/${code}`,
  globalPreset: (id: string) => `${top("globalEvaluationPresets")}/${id}`,
  platformActivityLog: (id: string) => `${top("platformActivityLog")}/${id}`,

  // ---- tenant-scoped identity (built from the prefixed `tenant()` root) ----
  academicSession: (t: string, id: string) => `${Paths.tenant(t)}/academicSessions/${id}`,
  academicSessions: (t: string) => `${Paths.tenant(t)}/academicSessions`,
  teacher: (t: string, id: string) => `${Paths.tenant(t)}/teachers/${id}`,
  teachers: (t: string) => `${Paths.tenant(t)}/teachers`,
  student: (t: string, id: string) => `${Paths.tenant(t)}/students/${id}`,
  students: (t: string) => `${Paths.tenant(t)}/students`,
  parent: (t: string, id: string) => `${Paths.tenant(t)}/parents/${id}`,
  parents: (t: string) => `${Paths.tenant(t)}/parents`,
  staff: (t: string, id: string) => `${Paths.tenant(t)}/staff/${id}`,
  staffs: (t: string) => `${Paths.tenant(t)}/staff`,
  scanner: (t: string, id: string) => `${Paths.tenant(t)}/scanners/${id}`, // D11 tenant-scoped
  scanners: (t: string) => `${Paths.tenant(t)}/scanners`,
  klass: (t: string, id: string) => `${Paths.tenant(t)}/classes/${id}`,
  classes: (t: string) => `${Paths.tenant(t)}/classes`,
  announcement: (t: string, id: string) => `${Paths.tenant(t)}/announcements/${id}`,
  announcements: (t: string) => `${Paths.tenant(t)}/announcements`,
  announcementRead: (t: string, id: string, uid: string) =>
    `${Paths.tenant(t)}/announcements/${id}/reads/${uid}`, // CD8 readBy -> subcollection
  // Notifications: `tenants/{t}/notifications/{id}` (canonical contract path).
  notification: (t: string, id: string) => `${Paths.tenant(t)}/notifications/${id}`,
  notifications: (t: string) => `${Paths.tenant(t)}/notifications`,
  notificationPreferences: (t: string, uid: string) =>
    `${Paths.tenant(t)}/notificationPreferences/${uid}`,
  deviceToken: (t: string, uid: string, token: string) =>
    `${Paths.tenant(t)}/users/${uid}/devices/${token}`,

  // ---- levelup content ----
  space: (t: string, id: string) => `${Paths.tenant(t)}/spaces/${id}`,
  spaces: (t: string) => `${Paths.tenant(t)}/spaces`,
  storyPoint: (t: string, s: string, sp: string) =>
    `${Paths.tenant(t)}/spaces/${s}/storyPoints/${sp}`,
  storyPoints: (t: string, s: string) => `${Paths.tenant(t)}/spaces/${s}/storyPoints`,
  // D1: the single canonical nested item path.
  item: (t: string, s: string, sp: string, id: string) =>
    `${Paths.tenant(t)}/spaces/${s}/storyPoints/${sp}/items/${id}`,
  items: (t: string, s: string, sp: string) =>
    `${Paths.tenant(t)}/spaces/${s}/storyPoints/${sp}/items`,
  // §6.4: one deterministic answer key per item. Keeping the doc id equal to
  // itemId means this path cannot accidentally diverge from `answerKeyDoc`.
  answerKey: (t: string, s: string, sp: string, itemId: string) =>
    `${Paths.tenant(t)}/spaces/${s}/storyPoints/${sp}/items/${itemId}/answerKeys/${itemId}`,
  answerKeys: (t: string, s: string, sp: string, itemId: string) =>
    `${Paths.tenant(t)}/spaces/${s}/storyPoints/${sp}/items/${itemId}/answerKeys`,
  agent: (t: string, id: string) => `${Paths.tenant(t)}/agents/${id}`,
  agents: (t: string) => `${Paths.tenant(t)}/agents`,
  rubricPreset: (t: string, id: string) => `${Paths.tenant(t)}/rubricPresets/${id}`,
  rubricPresets: (t: string) => `${Paths.tenant(t)}/rubricPresets`,
  questionBankItem: (t: string, id: string) => `${Paths.tenant(t)}/questionBank/${id}`,
  questionBank: (t: string) => `${Paths.tenant(t)}/questionBank`,
  spaceReview: (t: string, s: string, uid: string) =>
    `${Paths.tenant(t)}/spaces/${s}/reviews/${uid}`,
  chatSession: (t: string, id: string) => `${Paths.tenant(t)}/chatSessions/${id}`,
  chatMessage: (t: string, sessionId: string, msgId: string) =>
    `${Paths.tenant(t)}/chatSessions/${sessionId}/messages/${msgId}`, // always-subcollection (D6)

  // ---- testsession + progress ----
  testSession: (t: string, id: string) => `${Paths.tenant(t)}/digitalTestSessions/${id}`,
  testSessions: (t: string) => `${Paths.tenant(t)}/digitalTestSessions`,
  // D6: per-item answers always-subcollection.
  testSubmission: (t: string, sessionId: string, itemId: string) =>
    `${Paths.tenant(t)}/digitalTestSessions/${sessionId}/submissions/${itemId}`,
  testSessionLive: (t: string, sessionId: string) =>
    `${Paths.tenant(t)}/digitalTestSessions/${sessionId}/live/current`,
  // D13: spaceProgress keyed `{userId}_{spaceId}`.
  spaceProgress: (t: string, userId: string, spaceId: string) =>
    `${Paths.tenant(t)}/spaceProgress/${userId}_${spaceId}`,
  spaceProgressLive: (t: string, userId: string, spaceId: string) =>
    `${Paths.tenant(t)}/spaceProgress/${userId}_${spaceId}/live/current`,
  // D6: per-item progress docs (not a fat record-map).
  // U2.2: NESTED under spaceProgress (the rule-blessed, runtime-written form).
  // The former root-level `storyPointProgress/{userId}_{storyPointId}` was rule-less
  // and never written at runtime; unified to nested to match rules + levelup trigger.
  storyPointProgress: (t: string, userId: string, spaceId: string, storyPointId: string) =>
    `${Paths.spaceProgress(t, userId, spaceId)}/storyPointProgress/${storyPointId}`,

  // ---- autograde ----
  exam: (t: string, id: string) => `${Paths.tenant(t)}/exams/${id}`,
  exams: (t: string) => `${Paths.tenant(t)}/exams`,
  examQuestion: (t: string, examId: string, qid: string) =>
    `${Paths.tenant(t)}/exams/${examId}/questions/${qid}`,
  examQuestions: (t: string, examId: string) => `${Paths.tenant(t)}/exams/${examId}/questions`,
  submission: (t: string, id: string) => `${Paths.tenant(t)}/submissions/${id}`,
  submissions: (t: string) => `${Paths.tenant(t)}/submissions`,
  questionSubmission: (t: string, submissionId: string, qid: string) =>
    `${Paths.tenant(t)}/submissions/${submissionId}/questionSubmissions/${qid}`,
  questionSubmissions: (t: string, submissionId: string) =>
    `${Paths.tenant(t)}/submissions/${submissionId}/questionSubmissions`,
  evaluationSettings: (t: string, id: string) => `${Paths.tenant(t)}/evaluationSettings/${id}`,
  gradingDeadLetter: (t: string, id: string) => `${Paths.tenant(t)}/gradingDeadLetter/${id}`,

  // ---- analytics ----
  studentProgressSummary: (t: string, studentId: string) =>
    `${Paths.tenant(t)}/studentProgressSummaries/${studentId}`,
  classProgressSummary: (t: string, classId: string) =>
    `${Paths.tenant(t)}/classProgressSummaries/${classId}`,
  examAnalytics: (t: string, examId: string) => `${Paths.tenant(t)}/examAnalytics/${examId}`,
  insight: (t: string, id: string) => `${Paths.tenant(t)}/insights/${id}`,
  // D13: flat `costSummaries` collection; granularity encoded in the doc id (`daily_{p}`/`monthly_{p}`)
  // so the path stays an even-component document path.
  dailyCostSummary: (t: string, id: string) => `${Paths.tenant(t)}/costSummaries/daily_${id}`,
  monthlyCostSummary: (t: string, id: string) => `${Paths.tenant(t)}/costSummaries/monthly_${id}`,
  llmCallLog: (t: string, id: string) => `${Paths.tenant(t)}/llmCallLogs/${id}`,

  // ---- gamification (tenant-scoped, keyed on student userId) ----
  achievement: (t: string, id: string) => `${Paths.tenant(t)}/achievements/${id}`,
  achievements: (t: string) => `${Paths.tenant(t)}/achievements`,
  studentAchievement: (t: string, userId: string, achievementId: string) =>
    `${Paths.tenant(t)}/students/${userId}/achievements/${achievementId}`,
  studentLevel: (t: string, userId: string) =>
    `${Paths.tenant(t)}/students/${userId}/level/current`,
  studyGoal: (t: string, userId: string, goalId: string) =>
    `${Paths.tenant(t)}/students/${userId}/studyGoals/${goalId}`,
  studySession: (t: string, userId: string, sessionId: string) =>
    `${Paths.tenant(t)}/students/${userId}/studySessions/${sessionId}`,
} as const;

export type Paths = typeof Paths;
