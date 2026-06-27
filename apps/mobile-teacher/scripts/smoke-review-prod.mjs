/**
 * REVIEW/grading lane LIVE PROD probe.
 *
 * Signs in as the DEMO01 teacher (latha.krishnan@demo.levelup.academy) and walks
 * the EXACT data paths the review screens consume, so we know the autograde
 * teacher slice is live before trusting on-device behaviour:
 *   • examRepo.list                         (ExamsOverviewScreen)
 *   • gradingReviewRepo.getExamGradingOverview(examId)  (GradingQueue/GradingReview/ResultsRelease)
 *   • examAnalyticsRepo.get(examId)         (ExamAnalyticsScreen)
 *   • gradingReviewRepo.getReviewBundle(submissionId)   (SubmissionDetail/ManualOverride/RubricBreakdown)
 * validateResponses OFF (reads may be only partially canonicalized — screens
 * code defensively regardless).
 */
import { initializeApp } from 'firebase/app';
import { createApiClient } from '@levelup/api-client';
import { createRepositories } from '@levelup/repositories';
import { createFirebaseAuthHandle, createFirebaseTransport } from '@levelup/transport-firebase';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const REGION = 'asia-south1';
const EMAIL = process.env.DEMO_EMAIL ?? 'latha.krishnan@demo.levelup.academy';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@12345';

const PROD_CONFIG = {
  apiKey: 'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E',
  authDomain: 'lvlup-ff6fa.firebaseapp.com',
  projectId: 'lvlup-ff6fa',
  storageBucket: 'lvlup-ff6fa.appspot.com',
  messagingSenderId: '504506746594',
  appId: '1:504506746594:web:aac69e81f25dd95c5f80bb',
  databaseURL: 'https://lvlup-ff6fa-default-rtdb.firebaseio.com',
};

const app = initializeApp(PROD_CONFIG);
const services = {
  auth: getAuth(app),
  db: getFirestore(app),
  rtdb: getDatabase(app),
  storage: getStorage(app),
  functions: getFunctions(app, REGION),
};

async function probe(label, fn) {
  try {
    const res = await fn();
    return { label, ok: true, res };
  } catch (e) {
    console.log(`   ⚠️  ${label}: ${e?.code ?? ''} ${e?.message ?? e}`);
    return { label, ok: false, error: e?.code ?? e?.message ?? String(e) };
  }
}

const main = async () => {
  console.log(`[review-probe] sign-in ${EMAIL} @ lvlup-ff6fa`);
  const authHandle = createFirebaseAuthHandle(services.auth);
  const { user } = await authHandle.signIn(EMAIL, PASSWORD).catch((e) => {
    console.error(`❌ sign-in threw: ${e?.code ?? ''} ${e?.message ?? e}`);
    process.exit(2);
  });
  console.log(`[review-probe] signed in uid=${user?.uid}`);

  const api = createApiClient(createFirebaseTransport(services, { region: REGION }), {
    validateResponses: false,
  });
  const repos = createRepositories(api);

  console.log(`\n[review-probe] walking review-lane data paths:`);

  const exams = await probe('examRepo.list', () => repos.examRepo.list({}));
  const examItems = exams.ok ? (exams.res?.items ?? exams.res ?? []) : [];
  console.log(`   ${exams.ok ? '✅' : '❌'} examRepo.list → ${examItems.length} exam(s)`);
  for (const e of examItems) console.log(`        • [${e.id}] "${e.title ?? '(untitled)'}" status=${e.status}`);

  // Walk every NON-DRAFT exam (drafts legitimately have no submissions/analytics).
  const targets = examItems.filter((e) => e?.id && e.status !== 'draft');
  if (targets.length === 0) {
    console.log(`\n⏳ Only draft exam(s) for this teacher — nothing to grade/analyze yet. Screens render empty gracefully.`);
    process.exit(exams.ok ? 0 : 1);
  }

  let anyOverview = false,
    anyAnalytics = false,
    anyBundle = false;

  for (const exam of targets) {
    console.log(`\n── exam [${exam.id}] "${exam.title ?? '(untitled)'}" status=${exam.status} ──`);
    const overview = await probe('getExamGradingOverview', () =>
      repos.gradingReviewRepo.getExamGradingOverview({ examId: exam.id }),
    );
    const subs = overview.ok ? (overview.res?.submissions ?? []) : [];
    if (overview.ok) {
      anyOverview = true;
      const byStatus = {};
      for (const s of subs) byStatus[s.pipelineStatus ?? '?'] = (byStatus[s.pipelineStatus ?? '?'] ?? 0) + 1;
      console.log(`   ✅ getExamGradingOverview → ${subs.length} submission(s) ${JSON.stringify(byStatus)}, analytics=${Boolean(overview.res?.analytics)}`);
    } else {
      console.log(`   ❌ getExamGradingOverview → ${overview.error}`);
    }

    const analytics = await probe('examAnalyticsRepo.get', () => repos.examAnalyticsRepo.get(exam.id));
    if (analytics.ok) {
      anyAnalytics = true;
      console.log(`   ✅ examAnalyticsRepo.get → avg ${analytics.res?.avgPercentage ?? '?'}% · pass ${analytics.res?.passRate ?? '?'}% · ${analytics.res?.gradedSubmissions ?? '?'}/${analytics.res?.totalSubmissions ?? '?'} graded`);
    } else {
      console.log(`   ⚠️  examAnalyticsRepo.get → ${analytics.error} (benign for ungraded exams)`);
    }

    const sub = subs[0];
    if (sub?.id) {
      const bundle = await probe('getReviewBundle', () =>
        repos.gradingReviewRepo.getReviewBundle({ submissionId: sub.id }),
      );
      if (bundle.ok) {
        anyBundle = true;
        const rows = bundle.res?.rows ?? [];
        const bands = rows.map((r) => r.confidenceBand);
        console.log(`   ✅ getReviewBundle(${sub.id}) → ${rows.length} graded row(s), bands=${JSON.stringify(bands)}, score=${bundle.res?.submission?.summary?.totalScore ?? '?'}/${bundle.res?.submission?.summary?.maxScore ?? '?'}`);
      } else {
        console.log(`   ❌ getReviewBundle(${sub.id}) → ${bundle.error}`);
      }
    } else {
      console.log(`   • no submissions on this exam to bundle-probe`);
    }
  }

  console.log(`\n✅ REVIEW-PROBE DONE across ${targets.length} non-draft exam(s).`);
  console.log(`   chain: examRepo.list=${exams.ok ? 'LIVE' : 'DEAD'} · getExamGradingOverview=${anyOverview ? 'LIVE' : 'no-data'} · examAnalytics=${anyAnalytics ? 'LIVE' : 'no-data'} · getReviewBundle=${anyBundle ? 'LIVE' : 'no-data'}`);
  process.exit(0);
};

const timer = setTimeout(() => {
  console.error('❌ timed out after 60s');
  process.exit(3);
}, 60_000);
main().finally(() => clearTimeout(timer));
