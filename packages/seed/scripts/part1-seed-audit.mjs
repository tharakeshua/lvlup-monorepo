/**
 * SEED-1 iteration harness — PART 1 of audit-u4-2.mjs only (seed pipeline dry-run vs
 * domain strict Zod). No network, no prod reads. The GATE stays audit-u4-2.mjs;
 * this exists so builder fixes can iterate fast. Routing table mirrors audit-u4-2.mjs.
 */
import * as D from '@levelup/domain';
import { mockSeedConfig } from '../src/data/index.js';
import { SeedContext } from '../src/engine/context.js';
import { SeedPipeline } from '../src/engine/pipeline.js';

const issues = (r, n = 8) =>
  r.error.issues.slice(0, n).map((i) => `${i.path.join('.') || '<root>'}: ${i.code}${i.message ? ` (${i.message})` : ''}`);

const ROUTES = [
  [/\/answerKeys\/[^/]+$/, 'AnswerKeySchema'],
  [/\/storyPoints\/[^/]+\/items\/[^/]+$/, 'UnifiedItemSchema'],
  [/\/storyPoints\/[^/]+$/, 'StoryPointSchema'],
  [/\/spaces\/[^/]+\/reviews\/[^/]+$/, 'SpaceReviewSchema'],
  [/\/spaces\/[^/]+$/, 'SpaceSchema'],
  [/\/exams\/[^/]+\/questions\/[^/]+$/, 'ExamQuestionSchema'],
  [/\/exams\/[^/]+$/, 'ExamSchema'],
  // digitalTestSessions routes MUST precede the generic /submissions route — the nested
  // digitalTestSessions/{id}/submissions/{itemId} path also matches /submissions/[^/]+$.
  [/\/digitalTestSessions\/[^/]+\/submissions\/[^/]+$/, 'TestSubmissionSchema'],
  [/\/digitalTestSessions\/[^/]+\/live\/current$/, null],
  [/\/digitalTestSessions\/[^/]+$/, 'DigitalTestSessionSchema'],
  [/\/submissions\/[^/]+\/questionSubmissions\/[^/]+$/, 'QuestionSubmissionSchema'],
  [/\/submissions\/[^/]+$/, 'SubmissionSchema'],
  [/\/evaluationSettings\/[^/]+$/, 'EvaluationSettingsSchema'],
  [/\/gradingDeadLetter\/[^/]+$/, 'GradingDeadLetterEntrySchema'],
  [/\/spaceProgress\/[^/]+\/live\/current$/, null],
  [/\/spaceProgress\/[^/]+\/storyPointProgress\/[^/]+$/, 'StoryPointProgressDocSchema'],
  [/\/spaceProgress\/[^/]+$/, 'SpaceProgressSchema'],
  [/\/storyPointProgress\/[^/]+$/, 'StoryPointProgressDocSchema'],
  [/\/chatSessions\/[^/]+\/messages\/[^/]+$/, 'ChatMessageSchema'],
  [/\/chatSessions\/[^/]+$/, 'ChatSessionSchema'],
  [/\/academicSessions\/[^/]+$/, 'AcademicSessionSchema'],
  [/\/teachers\/[^/]+$/, 'TeacherSchema'],
  [/\/students\/[^/]+\/achievements\/[^/]+$/, 'StudentAchievementSchema'],
  [/\/students\/[^/]+\/level\/current$/, 'StudentLevelSchema'],
  [/\/students\/[^/]+\/studyGoals\/[^/]+$/, 'StudyGoalSchema'],
  [/\/students\/[^/]+\/studySessions\/[^/]+$/, 'StudySessionSchema'],
  [/\/students\/[^/]+\/devices\/[^/]+$/, null],
  [/\/students\/[^/]+$/, 'StudentSchema'],
  [/\/parents\/[^/]+$/, 'ParentSchema'],
  [/\/staff\/[^/]+$/, 'StaffSchema'],
  [/\/scanners\/[^/]+$/, 'ScannerSchema'],
  [/\/classes\/[^/]+$/, 'ClassSchema'],
  [/\/announcements\/[^/]+\/reads\/[^/]+$/, null],
  [/\/announcements\/[^/]+$/, 'AnnouncementSchema'],
  [/\/notifications\/[^/]+$/, 'NotificationSchema'],
  [/\/notificationPreferences\/[^/]+$/, 'NotificationPreferencesSchema'],
  [/\/agents\/[^/]+$/, 'AgentSchema'],
  [/\/rubricPresets\/[^/]+$/, 'RubricPresetSchema'],
  [/\/questionBank\/[^/]+$/, 'QuestionBankItemSchema'],
  [/\/achievements\/[^/]+$/, 'AchievementSchema'],
  [/\/studentProgressSummaries\/[^/]+$/, 'StudentProgressSummarySchema'],
  [/\/classProgressSummaries\/[^/]+$/, 'ClassProgressSummarySchema'],
  [/\/examAnalytics\/[^/]+$/, 'ExamAnalyticsSchema'],
  [/\/insights\/[^/]+$/, 'LearningInsightSchema'],
  [/\/costSummaries\/daily_/, 'DailyCostSummarySchema'],
  [/\/costSummaries\/monthly_/, 'MonthlyCostSummarySchema'],
  [/\/llmCallLogs\/[^/]+$/, 'LlmCallLogSchema'],
  [/(^|\/)globalEvaluationPresets\/[^/]+$/, 'EvaluationSettingsSchema'],
  [/(^|\/)platformActivityLog\/[^/]+$/, 'PlatformActivityLogSchema'],
  [/^(v2_)?userMemberships\/[^/]+$/, 'UserMembershipSchema'],
  [/^(v2_)?tenantCodes\/[^/]+$/, 'TenantCodeIndexSchema'],
  [/^(v2_)?tenants\/[^/]+$/, 'TenantSchema'],
  [/^(v2_)?users\/[^/]+$/, 'UnifiedUserSchema'],
];
function routeKind(path) {
  for (const [re, schema] of ROUTES) if (re.test(path)) return schema;
  return undefined;
}

const ctx = new SeedContext({ projectId: 'lvlup-ff6fa', dryRun: true, logLevel: 'error' });
const captured = [];
const origSet = ctx.batch.set.bind(ctx.batch);
ctx.batch.set = async (ref, data, options) => { captured.push({ path: ref.path, data }); return origSet(ref, data, options); };

const pipeline = new SeedPipeline(ctx);
await pipeline.run(mockSeedConfig);
await ctx.flush();

const byPath = new Map();
for (const { path, data } of captured) byPath.set(path, { ...(byPath.get(path) ?? {}), ...data });

const perKind = {};
const unrouted = {};
for (const [path, data] of byPath.entries()) {
  const kind = routeKind(path);
  if (kind === undefined) { const key = path.replace(/[^/]+$/, '{id}'); unrouted[key] = (unrouted[key] ?? 0) + 1; continue; }
  if (kind === null) continue;
  const schema = D[kind];
  const rec = (perKind[kind] ??= { total: 0, strict: 0, failStrict: 0, sampleErrors: [] });
  rec.total++;
  const r = schema.safeParse(data);
  if (r.success) rec.strict++;
  else { rec.failStrict++; if (rec.sampleErrors.length < 2) rec.sampleErrors.push({ path, issues: issues(r) }); }
}

const kinds = Object.keys(perKind);
const fails = Object.entries(perKind).filter(([, v]) => v.failStrict > 0);
let totalDocs = 0, totalStrict = 0;
for (const v of Object.values(perKind)) { totalDocs += v.total; totalStrict += v.strict; }
console.log(`routed docs: ${totalStrict}/${totalDocs} strict | entity types clean: ${kinds.length - fails.length}/${kinds.length}`);
for (const [k, v] of fails.sort((a, b) => b[1].failStrict - a[1].failStrict)) {
  console.log(`FAIL ${k} ${v.failStrict}/${v.total}`);
  for (const s of v.sampleErrors) console.log(`    ${s.path}\n      ${s.issues.join('\n      ')}`);
}
if (Object.keys(unrouted).length) console.log('unrouted:', JSON.stringify(unrouted));
process.exit(0);
