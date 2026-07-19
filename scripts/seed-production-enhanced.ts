/**
 * Enhanced Production Seed Script — Populates additional Firestore collections
 * that are not covered by seed-production.ts.
 *
 * Run AFTER seed-production.ts has completed.
 *
 * Usage: GOOGLE_APPLICATION_CREDENTIALS=./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json npx tsx scripts/seed-production-enhanced.ts
 *
 * Creates:
 *   - EvaluationSettings (default rubric config)
 *   - Submissions (student answer sheet submissions for AutoGrade exams)
 *   - QuestionSubmissions (per-question grading results)
 *   - ExamAnalytics (computed analytics per exam)
 *   - StudentProgressSummaries (cross-system per-student)
 *   - ClassProgressSummaries (aggregated per-class)
 *   - DigitalTestSessions (LevelUp test attempts)
 *   - Notifications (in-app notifications for all roles)
 *   - NotificationPreferences (per user)
 *   - LearningInsights (personalized recommendations)
 *   - DailyCostSummary (AI cost tracking)
 *   - RTDB notification state
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// 1. Initialize Firebase Admin (PRODUCTION — NOT EMULATOR)
// ---------------------------------------------------------------------------
const SERVICE_ACCOUNT_PATH = resolve(
  __dirname,
  "../lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json"
);

const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "lvlup-ff6fa",
  databaseURL: "https://lvlup-ff6fa-default-rtdb.asia-southeast1.firebasedatabase.app",
});

const db = admin.firestore();
const rtdb = admin.database();
const Timestamp = admin.firestore.Timestamp;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const now = Date.now();
function ts(daysAgo = 0): admin.firestore.Timestamp {
  return Timestamp.fromMillis(now - daysAgo * 86400000);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Report tracking
// ---------------------------------------------------------------------------
interface SeedResult {
  step: string;
  collection: string;
  count: number;
  status: "success" | "failed";
  error?: string;
  details?: string;
}

const results: SeedResult[] = [];

function logResult(
  step: string,
  collection: string,
  count: number,
  status: "success" | "failed",
  error?: string,
  details?: string
) {
  results.push({ step, collection, count, status, error, details });
  if (status === "success") {
    console.log(`  ✅ ${collection}: ${count} documents created${details ? ` (${details})` : ""}`);
  } else {
    console.log(`  ❌ ${collection}: FAILED - ${error}`);
  }
}

// ===========================================================================
// MAIN ENHANCED SEED FUNCTION
// ===========================================================================
async function seedEnhanced(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  ENHANCED SEED SCRIPT — Additional Collections             ║");
  console.log("║  Target: lvlup-ff6fa (REAL Firestore)                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // =========================================================================
  // STEP 0: Discover existing data from seed-production.ts
  // =========================================================================
  console.log("[0] Discovering existing seeded data...");

  // Find the tenant
  const tenantsSnap = await db
    .collection("tenants")
    .where("tenantCode", "==", "GRN001")
    .limit(1)
    .get();

  if (tenantsSnap.empty) {
    console.error("❌ No tenant with code GRN001 found. Run seed-production.ts first.");
    process.exit(1);
  }

  const tenantDoc = tenantsSnap.docs[0];
  const tenantId = tenantDoc.id;
  const tenantCode = "GRN001";
  console.log(`  Tenant: ${tenantDoc.data().name} (${tenantId})`);

  // Get all students
  const studentsSnap = await db
    .collection(`tenants/${tenantId}/students`)
    .where("status", "==", "active")
    .get();
  const students = studentsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, any>),
  }));
  console.log(`  Students found: ${students.length}`);

  // Get all teachers
  const teachersSnap = await db
    .collection(`tenants/${tenantId}/teachers`)
    .where("status", "==", "active")
    .get();
  const teachers = teachersSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, any>),
  }));
  console.log(`  Teachers found: ${teachers.length}`);

  // Get all classes
  const classesSnap = await db.collection(`tenants/${tenantId}/classes`).get();
  const classes = classesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }));
  console.log(`  Classes found: ${classes.length}`);

  // Get all exams
  const examsSnap = await db.collection(`tenants/${tenantId}/exams`).get();
  const exams = examsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }));
  console.log(`  Exams found: ${exams.length}`);

  // Get all spaces
  const spacesSnap = await db.collection(`tenants/${tenantId}/spaces`).get();
  const spaces = spacesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }));
  console.log(`  Spaces found: ${spaces.length}`);

  // Get all parents
  const parentsSnap = await db.collection(`tenants/${tenantId}/parents`).get();
  const parents = parentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }));
  console.log(`  Parents found: ${parents.length}`);

  // Get tenant admin membership
  const membershipsSnap = await db
    .collection("userMemberships")
    .where("tenantId", "==", tenantId)
    .where("role", "==", "tenantAdmin")
    .limit(1)
    .get();
  const tenantAdminUid = membershipsSnap.empty ? "" : membershipsSnap.docs[0].data().uid;
  console.log(`  Tenant Admin UID: ${tenantAdminUid}`);

  // Get academic session
  const sessionsSnap = await db
    .collection(`tenants/${tenantId}/academicSessions`)
    .where("isCurrent", "==", true)
    .limit(1)
    .get();
  const academicSessionId = sessionsSnap.empty ? "" : sessionsSnap.docs[0].id;
  console.log(`  Academic Session: ${academicSessionId}\n`);

  // =========================================================================
  // STEP 1: EvaluationSettings
  // =========================================================================
  console.log("[1/11] Creating EvaluationSettings...");
  try {
    const evalSettingsRef = db.collection(`tenants/${tenantId}/evaluationSettings`).doc();
    await evalSettingsRef.set({
      id: evalSettingsRef.id,
      tenantId,
      name: "Default Evaluation Config",
      description: "Standard evaluation dimensions for exam grading",
      isDefault: true,
      isPublic: false,
      enabledDimensions: [
        {
          id: "dim_accuracy",
          name: "Accuracy",
          description: "Correctness of the answer and key concepts",
          icon: "🎯",
          priority: "HIGH",
          promptGuidance:
            "Check if the core answer is correct and all key concepts are accurately stated.",
          enabled: true,
          isDefault: true,
          isCustom: false,
          expectedFeedbackCount: 3,
          weight: 0.4,
          scoringScale: 10,
        },
        {
          id: "dim_completeness",
          name: "Completeness",
          description: "Coverage of all required points",
          icon: "📋",
          priority: "HIGH",
          promptGuidance:
            "Assess if the student addressed all parts of the question comprehensively.",
          enabled: true,
          isDefault: true,
          isCustom: false,
          expectedFeedbackCount: 2,
          weight: 0.3,
          scoringScale: 10,
        },
        {
          id: "dim_presentation",
          name: "Presentation",
          description: "Clarity, organization, and neatness of the answer",
          icon: "✨",
          priority: "MEDIUM",
          promptGuidance:
            "Evaluate the structure, clarity, and overall presentation of the answer.",
          enabled: true,
          isDefault: true,
          isCustom: false,
          expectedFeedbackCount: 2,
          weight: 0.2,
          scoringScale: 10,
        },
        {
          id: "dim_application",
          name: "Application",
          description: "Ability to apply concepts to solve the problem",
          icon: "🔧",
          priority: "MEDIUM",
          promptGuidance: "Check if the student can apply learned concepts to practical problems.",
          enabled: true,
          isDefault: true,
          isCustom: false,
          expectedFeedbackCount: 1,
          weight: 0.1,
          scoringScale: 10,
        },
      ],
      displaySettings: {
        showStrengths: true,
        showKeyTakeaway: true,
        prioritizeByImportance: true,
      },
      createdBy: tenantAdminUid,
      createdAt: ts(30),
      updatedAt: ts(0),
    });
    logResult("1", "evaluationSettings", 1, "success");
  } catch (err: any) {
    logResult("1", "evaluationSettings", 0, "failed", err.message);
  }

  // =========================================================================
  // STEP 2: Submissions & QuestionSubmissions for each exam
  // =========================================================================
  console.log("\n[2/11] Creating Submissions & QuestionSubmissions...");
  let totalSubmissions = 0;
  let totalQSubs = 0;

  for (const exam of exams) {
    try {
      // Get exam questions
      const questionsSnap = await db
        .collection(`tenants/${tenantId}/exams/${exam.id}/questions`)
        .get();
      const questions = questionsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, any>),
      }));

      // Find students in exam's classes
      const examStudents = students.filter((s) =>
        s.classIds?.some((cid: string) => exam.classIds?.includes(cid))
      );

      // Create submissions for 70% of eligible students
      const submittingStudents = examStudents.slice(0, Math.ceil(examStudents.length * 0.7));

      let examTotalScore = 0;
      let examMaxScore = 0;
      let gradedCount = 0;

      for (const student of submittingStudents) {
        const submissionRef = db.collection(`tenants/${tenantId}/submissions`).doc();

        // Generate random scores
        const classId = student.classIds?.[0] || "";
        const studentScore = randomBetween(Math.floor(exam.totalMarks * 0.3), exam.totalMarks);
        const percentage = (studentScore / exam.totalMarks) * 100;
        const gradeThresholds = [
          { min: 90, grade: "A+" },
          { min: 80, grade: "A" },
          { min: 70, grade: "B+" },
          { min: 60, grade: "B" },
          { min: 50, grade: "C" },
          { min: 40, grade: "D" },
          { min: 0, grade: "F" },
        ];
        const grade = gradeThresholds.find((t) => percentage >= t.min)?.grade || "F";

        await submissionRef.set({
          id: submissionRef.id,
          tenantId,
          examId: exam.id,
          studentId: student.id,
          studentName: student.displayName || `${student.firstName} ${student.lastName}`,
          rollNumber: student.rollNumber || "",
          classId,
          answerSheets: {
            images: [`gs://lvlup-ff6fa.appspot.com/submissions/${submissionRef.id}/page1.jpg`],
            uploadedAt: ts(10),
            uploadedBy: student.authUid || student.uid || "",
            uploadSource: "web",
          },
          scoutingResult: {
            routingMap: Object.fromEntries(questions.map((q, i) => [q.id, [i]])),
            confidence: Object.fromEntries(
              questions.map((q) => [q.id, 0.85 + Math.random() * 0.15])
            ),
            completedAt: ts(9),
          },
          summary: {
            totalScore: studentScore,
            maxScore: exam.totalMarks,
            percentage,
            grade,
            questionsGraded: questions.length,
            totalQuestions: questions.length,
            completedAt: ts(8),
          },
          pipelineStatus: "grading_complete",
          retryCount: 0,
          resultsReleased: true,
          resultsReleasedAt: ts(5),
          resultsReleasedBy: tenantAdminUid,
          createdAt: ts(10),
          updatedAt: ts(5),
        });

        totalSubmissions++;
        examTotalScore += studentScore;
        examMaxScore += exam.totalMarks;
        gradedCount++;

        // Create QuestionSubmissions for each question
        let remainingScore = studentScore;
        for (let qi = 0; qi < questions.length; qi++) {
          const q = questions[qi];
          const maxMarks = q.marks || q.maxMarks || 5;
          const isLast = qi === questions.length - 1;
          const qScore = isLast
            ? Math.max(0, Math.min(maxMarks, remainingScore))
            : Math.min(maxMarks, randomBetween(Math.floor(maxMarks * 0.3), maxMarks));
          remainingScore -= qScore;

          const qSubRef = db
            .collection(`tenants/${tenantId}/submissions/${submissionRef.id}/questionSubmissions`)
            .doc(q.id);

          const strengths =
            qScore >= maxMarks * 0.8
              ? ["Good understanding of core concepts", "Clear explanation"]
              : ["Attempted the question"];
          const weaknesses =
            qScore < maxMarks * 0.6 ? ["Incomplete answer", "Missing key concepts"] : [];

          await qSubRef.set({
            id: q.id,
            submissionId: submissionRef.id,
            questionId: q.id,
            examId: exam.id,
            mapping: {
              pageIndices: [0],
              imageUrls: [`gs://lvlup-ff6fa.appspot.com/submissions/${submissionRef.id}/page1.jpg`],
              scoutedAt: ts(9),
            },
            evaluation: {
              score: qScore,
              maxScore: maxMarks,
              correctness: qScore / maxMarks,
              percentage: (qScore / maxMarks) * 100,
              strengths,
              weaknesses,
              missingConcepts:
                qScore < maxMarks * 0.5 ? ["Fundamental concepts need revision"] : [],
              summary: {
                keyTakeaway:
                  qScore >= maxMarks * 0.7
                    ? "Student demonstrates solid understanding."
                    : "Student needs additional practice on this topic.",
                overallComment: `Scored ${qScore}/${maxMarks}.`,
              },
              confidence: 0.85 + Math.random() * 0.1,
              mistakeClassification:
                qScore >= maxMarks * 0.8
                  ? "None"
                  : qScore >= maxMarks * 0.5
                    ? "Silly Error"
                    : "Conceptual",
              tokensUsed: { input: randomBetween(500, 1500), output: randomBetween(200, 800) },
              costUsd: Math.random() * 0.01,
              gradedAt: ts(8),
            },
            gradingStatus: "graded",
            gradingRetryCount: 0,
            createdAt: ts(10),
            updatedAt: ts(8),
          });
          totalQSubs++;
        }
      }

      // Update exam stats
      const avgScore = gradedCount > 0 ? examTotalScore / gradedCount : 0;
      const passRate =
        gradedCount > 0
          ? (submittingStudents.filter((_s, i) => {
              // rough estimate
              return examTotalScore / gradedCount >= exam.passingMarks;
            }).length /
              gradedCount) *
            100
          : 0;

      await db.doc(`tenants/${tenantId}/exams/${exam.id}`).update({
        "stats.totalSubmissions": submittingStudents.length,
        "stats.gradedSubmissions": submittingStudents.length,
        "stats.avgScore": Math.round(avgScore),
        "stats.passRate": Math.round(passRate),
        status: "results_released",
        updatedAt: ts(0),
      });

      console.log(
        `  Exam "${exam.title}": ${submittingStudents.length} submissions, ${questions.length * submittingStudents.length} question submissions`
      );
    } catch (err: any) {
      logResult("2", `submissions for ${exam.title}`, 0, "failed", err.message);
    }
  }
  logResult("2", "submissions", totalSubmissions, "success");
  logResult("2", "questionSubmissions", totalQSubs, "success");

  // =========================================================================
  // STEP 3: ExamAnalytics
  // =========================================================================
  console.log("\n[3/11] Creating ExamAnalytics...");
  let examAnalyticsCount = 0;
  for (const exam of exams) {
    try {
      // Gather submission data for this exam
      const subsSnap = await db
        .collection(`tenants/${tenantId}/submissions`)
        .where("examId", "==", exam.id)
        .get();

      const submissions = subsSnap.docs.map((d) => d.data());
      const gradedSubs = submissions.filter((s) => s.pipelineStatus === "grading_complete");

      const scores = gradedSubs.map((s) => s.summary?.totalScore || 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const avgPercentage =
        scores.length > 0
          ? scores.map((s) => (s / exam.totalMarks) * 100).reduce((a, b) => a + b, 0) /
            scores.length
          : 0;
      const passCount = scores.filter((s) => s >= exam.passingMarks).length;

      const sortedScores = [...scores].sort((a, b) => a - b);
      const medianScore =
        sortedScores.length > 0 ? sortedScores[Math.floor(sortedScores.length / 2)] : 0;

      // Score distribution buckets
      const buckets = [
        { min: 0, max: 20, count: 0 },
        { min: 21, max: 40, count: 0 },
        { min: 41, max: 60, count: 0 },
        { min: 61, max: 80, count: 0 },
        { min: 81, max: 100, count: 0 },
      ];
      for (const s of scores) {
        const pct = (s / exam.totalMarks) * 100;
        const bucket = buckets.find((b) => pct >= b.min && pct <= b.max);
        if (bucket) bucket.count++;
      }

      // Get questions for per-question analytics
      const questionsSnap = await db
        .collection(`tenants/${tenantId}/exams/${exam.id}/questions`)
        .get();
      const questionAnalytics: Record<string, any> = {};

      for (const qDoc of questionsSnap.docs) {
        const q = qDoc.data();
        const maxMarks = q.marks || q.maxMarks || 5;
        const avgQScore = randomBetween(Math.floor(maxMarks * 0.4), maxMarks);
        questionAnalytics[qDoc.id] = {
          questionId: qDoc.id,
          avgScore: avgQScore,
          maxScore: maxMarks,
          avgPercentage: (avgQScore / maxMarks) * 100,
          difficultyIndex: 0.3 + Math.random() * 0.5,
          discriminationIndex: 0.2 + Math.random() * 0.6,
          commonMistakes: ["Calculation error", "Incomplete steps"],
          commonStrengths: ["Good conceptual understanding"],
        };
      }

      // Class breakdown
      const classBreakdown: Record<string, any> = {};
      for (const classId of exam.classIds || []) {
        const cls = classes.find((c) => c.id === classId);
        classBreakdown[classId] = {
          classId,
          className: cls?.name || classId,
          avgScore: avgScore * (0.9 + Math.random() * 0.2),
          passRate: passCount > 0 ? (passCount / gradedSubs.length) * 100 : 60,
          submissionCount:
            gradedSubs.filter((s) => s.classId === classId).length || gradedSubs.length,
        };
      }

      // Topic performance
      const topicPerformance: Record<string, any> = {};
      for (const topic of exam.topics || []) {
        topicPerformance[topic] = {
          topic,
          avgPercentage: 50 + Math.random() * 40,
          weakStudentCount: randomBetween(1, 5),
        };
      }

      const analyticsRef = db.doc(`tenants/${tenantId}/examAnalytics/${exam.id}`);
      await analyticsRef.set({
        id: exam.id,
        tenantId,
        examId: exam.id,
        totalSubmissions: submissions.length,
        gradedSubmissions: gradedSubs.length,
        avgScore: Math.round(avgScore * 10) / 10,
        avgPercentage: Math.round(avgPercentage * 10) / 10,
        passRate:
          gradedSubs.length > 0 ? Math.round((passCount / gradedSubs.length) * 1000) / 10 : 0,
        medianScore,
        scoreDistribution: { buckets },
        questionAnalytics,
        classBreakdown,
        topicPerformance,
        computedAt: ts(3),
        lastUpdatedAt: ts(0),
      });

      examAnalyticsCount++;
    } catch (err: any) {
      logResult("3", `examAnalytics for ${exam.title}`, 0, "failed", err.message);
    }
  }
  logResult("3", "examAnalytics", examAnalyticsCount, "success");

  // =========================================================================
  // STEP 4: StudentProgressSummaries
  // =========================================================================
  console.log("\n[4/11] Creating StudentProgressSummaries...");
  let progressSummaryCount = 0;
  try {
    for (const student of students) {
      // Get student's submissions
      const studentSubsSnap = await db
        .collection(`tenants/${tenantId}/submissions`)
        .where("studentId", "==", student.id)
        .get();

      const studentSubs = studentSubsSnap.docs.map((d) => d.data());
      const completedExams = studentSubs.filter((s) => s.pipelineStatus === "grading_complete");

      // AutoGrade metrics
      const totalMarksObtained = completedExams.reduce(
        (sum, s) => sum + (s.summary?.totalScore || 0),
        0
      );
      const totalMarksAvailable = completedExams.reduce(
        (sum, s) => sum + (s.summary?.maxScore || 0),
        0
      );
      const avgPercentage =
        totalMarksAvailable > 0 ? (totalMarksObtained / totalMarksAvailable) * 100 : 0;

      const recentExams = completedExams.slice(0, 5).map((s) => {
        const exam = exams.find((e) => e.id === s.examId);
        return {
          examId: s.examId,
          examTitle: exam?.title || "Unknown Exam",
          score: totalMarksAvailable > 0 ? s.summary.totalScore / s.summary.maxScore : 0,
          percentage: s.summary?.percentage || 0,
          date: s.createdAt || ts(10),
        };
      });

      // Subject breakdown
      const subjectBreakdown: Record<string, any> = {};
      for (const sub of completedExams) {
        const exam = exams.find((e) => e.id === sub.examId);
        const subj = exam?.subject || "Unknown";
        if (!subjectBreakdown[subj]) {
          subjectBreakdown[subj] = { avgScore: 0, examCount: 0, totalScore: 0 };
        }
        subjectBreakdown[subj].examCount++;
        subjectBreakdown[subj].totalScore += sub.summary?.percentage || 0;
      }
      for (const key of Object.keys(subjectBreakdown)) {
        subjectBreakdown[key].avgScore =
          subjectBreakdown[key].totalScore / subjectBreakdown[key].examCount / 100;
        delete subjectBreakdown[key].totalScore;
      }

      // LevelUp metrics (simulated)
      const studentSpaces = spaces.filter((sp) =>
        sp.classIds?.some((cid: string) => student.classIds?.includes(cid))
      );

      const completedSpaces = Math.floor(studentSpaces.length * (0.3 + Math.random() * 0.5));
      const avgCompletion = 30 + Math.random() * 60;
      const totalPointsEarned = randomBetween(50, 500);
      const totalPointsAvailable = randomBetween(totalPointsEarned, 800);

      // Cross-system analysis
      const overallScore =
        avgPercentage > 0
          ? (avgPercentage / 100) * 0.6 + (avgCompletion / 100) * 0.4
          : avgCompletion / 100;
      const isAtRisk = overallScore < 0.4;

      const strengthAreas: string[] = [];
      const weaknessAreas: string[] = [];
      for (const [subj, data] of Object.entries(subjectBreakdown)) {
        if ((data as any).avgScore >= 0.7) strengthAreas.push(subj);
        else if ((data as any).avgScore < 0.4) weaknessAreas.push(subj);
      }

      const summaryRef = db.doc(`tenants/${tenantId}/studentProgressSummaries/${student.id}`);
      await summaryRef.set({
        id: student.id,
        tenantId,
        studentId: student.id,
        autograde: {
          totalExams: exams.filter((e) =>
            e.classIds?.some((cid: string) => student.classIds?.includes(cid))
          ).length,
          completedExams: completedExams.length,
          averageScore: totalMarksAvailable > 0 ? totalMarksObtained / totalMarksAvailable : 0,
          averagePercentage: Math.round(avgPercentage * 10) / 10,
          totalMarksObtained,
          totalMarksAvailable,
          subjectBreakdown,
          recentExams,
        },
        levelup: {
          totalSpaces: studentSpaces.length,
          completedSpaces,
          averageCompletion: Math.round(avgCompletion * 10) / 10,
          totalPointsEarned,
          totalPointsAvailable,
          averageAccuracy: 0.5 + Math.random() * 0.4,
          streakDays: randomBetween(0, 15),
          subjectBreakdown: Object.fromEntries(
            [...new Set(studentSpaces.map((sp) => sp.subject))].map((subj) => [
              subj,
              {
                avgCompletion: 30 + Math.random() * 60,
                spaceCount: studentSpaces.filter((sp) => sp.subject === subj).length,
              },
            ])
          ),
          recentActivity: studentSpaces.slice(0, 3).map((sp) => ({
            spaceId: sp.id,
            spaceTitle: sp.title,
            action: "completed_item",
            date: ts(randomBetween(1, 10)),
          })),
        },
        overallScore: Math.round(overallScore * 100) / 100,
        strengthAreas,
        weaknessAreas,
        isAtRisk,
        atRiskReasons: isAtRisk ? ["low_exam_score", "low_space_completion"] : [],
        lastUpdatedAt: ts(0),
      });

      progressSummaryCount++;
    }
    logResult("4", "studentProgressSummaries", progressSummaryCount, "success");
  } catch (err: any) {
    logResult("4", "studentProgressSummaries", progressSummaryCount, "failed", err.message);
  }

  // =========================================================================
  // STEP 5: ClassProgressSummaries
  // =========================================================================
  console.log("\n[5/11] Creating ClassProgressSummaries...");
  let classSummaryCount = 0;
  try {
    for (const cls of classes) {
      // Get students in class
      const classStudents = students.filter((s) => s.classIds?.includes(cls.id));

      // Get progress summaries for class students
      const studentSummaries: any[] = [];
      for (const s of classStudents) {
        const summaryDoc = await db
          .doc(`tenants/${tenantId}/studentProgressSummaries/${s.id}`)
          .get();
        if (summaryDoc.exists) studentSummaries.push(summaryDoc.data());
      }

      const avgClassScore =
        studentSummaries.length > 0
          ? studentSummaries.reduce((sum, s) => sum + (s.autograde?.averagePercentage || 0), 0) /
            studentSummaries.length
          : 0;

      const avgClassCompletion =
        studentSummaries.length > 0
          ? studentSummaries.reduce((sum, s) => sum + (s.levelup?.averageCompletion || 0), 0) /
            studentSummaries.length
          : 0;

      // Top/bottom performers
      const sortedByScore = [...studentSummaries].sort(
        (a, b) => (b.autograde?.averagePercentage || 0) - (a.autograde?.averagePercentage || 0)
      );

      const topPerformers = sortedByScore.slice(0, 3).map((s) => {
        const student = classStudents.find((cs) => cs.id === s.studentId);
        return {
          studentId: s.studentId,
          name: student?.displayName || `Student ${s.studentId}`,
          avgScore: s.autograde?.averagePercentage || 0,
        };
      });

      const bottomPerformers = sortedByScore
        .slice(-3)
        .reverse()
        .map((s) => {
          const student = classStudents.find((cs) => cs.id === s.studentId);
          return {
            studentId: s.studentId,
            name: student?.displayName || `Student ${s.studentId}`,
            avgScore: s.autograde?.averagePercentage || 0,
          };
        });

      const sortedByPoints = [...studentSummaries].sort(
        (a, b) => (b.levelup?.totalPointsEarned || 0) - (a.levelup?.totalPointsEarned || 0)
      );

      const topPointEarners = sortedByPoints.slice(0, 3).map((s) => {
        const student = classStudents.find((cs) => cs.id === s.studentId);
        return {
          studentId: s.studentId,
          name: student?.displayName || `Student ${s.studentId}`,
          points: s.levelup?.totalPointsEarned || 0,
        };
      });

      const atRiskStudentIds = studentSummaries.filter((s) => s.isAtRisk).map((s) => s.studentId);

      const classRef = db.doc(`tenants/${tenantId}/classProgressSummaries/${cls.id}`);
      await classRef.set({
        id: cls.id,
        tenantId,
        classId: cls.id,
        className: cls.name,
        studentCount: classStudents.length,
        autograde: {
          averageClassScore: Math.round(avgClassScore * 10) / 10,
          examCompletionRate: 70 + Math.random() * 25,
          topPerformers,
          bottomPerformers,
        },
        levelup: {
          averageClassCompletion: Math.round(avgClassCompletion * 10) / 10,
          activeStudentRate: 60 + Math.random() * 35,
          topPointEarners,
        },
        atRiskStudentIds,
        atRiskCount: atRiskStudentIds.length,
        lastUpdatedAt: ts(0),
      });
      classSummaryCount++;
    }
    logResult("5", "classProgressSummaries", classSummaryCount, "success");
  } catch (err: any) {
    logResult("5", "classProgressSummaries", classSummaryCount, "failed", err.message);
  }

  // =========================================================================
  // STEP 6: DigitalTestSessions (LevelUp test attempts)
  // =========================================================================
  console.log("\n[6/11] Creating DigitalTestSessions...");
  let testSessionCount = 0;
  try {
    // For each space that has timed_test story points, create test sessions for some students
    for (const space of spaces) {
      const storyPointsSnap = await db
        .collection(`tenants/${tenantId}/spaces/${space.id}/storyPoints`)
        .where("type", "in", ["timed_test", "quiz"])
        .get();

      for (const spDoc of storyPointsSnap.docs) {
        const sp = spDoc.data();

        // Get items for this story point
        const itemsSnap = await db
          .collection(`tenants/${tenantId}/spaces/${space.id}/items`)
          .where("storyPointId", "==", spDoc.id)
          .get();

        const items = itemsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, any>),
        }));
        const questionItems = items.filter((i) => i.type === "question");

        if (questionItems.length === 0) continue;

        // Find eligible students
        const eligibleStudents = students.filter((s) =>
          s.classIds?.some((cid: string) => space.classIds?.includes(cid))
        );

        // Create test sessions for first 5 students
        for (const student of eligibleStudents.slice(0, 5)) {
          const sessionRef = db.collection(`tenants/${tenantId}/digitalTestSessions`).doc();

          const totalQuestions = questionItems.length;
          const answered = randomBetween(Math.ceil(totalQuestions * 0.6), totalQuestions);
          const pointsEarned = randomBetween(
            10,
            questionItems.reduce(
              (sum, q) => sum + (q.meta?.totalPoints || q.payload?.data?.basePoints || 10),
              0
            )
          );
          const totalPoints = questionItems.reduce(
            (sum, q) => sum + (q.meta?.totalPoints || q.payload?.data?.basePoints || 10),
            0
          );

          const questionOrder = questionItems.map((q) => q.id);
          const visitedQuestions: Record<string, boolean> = {};
          const submissions: Record<string, any> = {};
          const markedForReview: Record<string, boolean> = {};

          for (let qi = 0; qi < questionItems.length; qi++) {
            const q = questionItems[qi];
            visitedQuestions[q.id] = qi < answered;

            if (qi < answered) {
              const qPoints = q.meta?.totalPoints || q.payload?.data?.basePoints || 10;
              const earned = randomBetween(Math.floor(qPoints * 0.3), qPoints);
              submissions[q.id] = {
                itemId: q.id,
                questionType: q.payload?.data?.questionType || "mcq",
                answer: q.payload?.data?.questionType === "mcq" ? "a" : "sample answer",
                submittedAt: ts(5).toMillis(),
                timeSpentSeconds: randomBetween(20, 300),
                correct: earned >= qPoints * 0.8,
                pointsEarned: earned,
                totalPoints: qPoints,
              };
            }

            if (qi < 2) markedForReview[q.id] = true;
          }

          await sessionRef.set({
            id: sessionRef.id,
            tenantId,
            userId: student.authUid || student.uid || "",
            spaceId: space.id,
            storyPointId: spDoc.id,
            sessionType: sp.type === "timed_test" ? "timed_test" : "quiz",
            attemptNumber: 1,
            status: "completed",
            isLatest: true,
            startedAt: ts(6),
            endedAt: ts(5),
            durationMinutes: sp.assessmentConfig?.durationMinutes || 30,
            totalQuestions,
            answeredQuestions: answered,
            questionOrder,
            visitedQuestions,
            submissions,
            markedForReview,
            pointsEarned,
            totalPoints,
            percentage: totalPoints > 0 ? Math.round((pointsEarned / totalPoints) * 100) : 0,
            submittedAt: ts(5),
            autoSubmitted: false,
            createdAt: ts(6),
            updatedAt: ts(5),
          });

          testSessionCount++;
        }
      }
    }
    logResult("6", "digitalTestSessions", testSessionCount, "success");
  } catch (err: any) {
    logResult("6", "digitalTestSessions", testSessionCount, "failed", err.message);
  }

  // =========================================================================
  // STEP 7: Notifications
  // =========================================================================
  console.log("\n[7/11] Creating Notifications...");
  let notifCount = 0;
  try {
    const notificationTemplates = [
      // For teachers
      ...teachers.map((t) => ({
        recipientId: t.authUid || t.uid || "",
        recipientRole: "teacher" as const,
        type: "grading_complete" as const,
        title: "Grading Complete",
        body: `All submissions for ${exams[0]?.title || "the exam"} have been graded.`,
        entityType: "exam" as const,
        entityId: exams[0]?.id || "",
      })),
      // For students - exam results
      ...students.slice(0, 10).map((s) => ({
        recipientId: s.authUid || s.uid || "",
        recipientRole: "student" as const,
        type: "exam_results_released" as const,
        title: "Exam Results Released",
        body: `Results for ${exams[0]?.title || "the exam"} are now available. Check your scores!`,
        entityType: "exam" as const,
        entityId: exams[0]?.id || "",
      })),
      // For students - new space assigned
      ...students.slice(0, 10).map((s) => ({
        recipientId: s.authUid || s.uid || "",
        recipientRole: "student" as const,
        type: "new_space_assigned" as const,
        title: "New Learning Space",
        body: `A new learning space "${spaces[0]?.title || "space"}" has been assigned to your class.`,
        entityType: "space" as const,
        entityId: spaces[0]?.id || "",
      })),
      // For parents - student at risk
      ...parents.slice(0, 3).map((p) => ({
        recipientId: p.authUid || p.uid || "",
        recipientRole: "parent" as const,
        type: "student_at_risk" as const,
        title: "Student Needs Attention",
        body: "Your child may need additional support based on recent performance.",
        entityType: "student" as const,
        entityId: students[0]?.id || "",
      })),
      // For tenant admin
      {
        recipientId: tenantAdminUid,
        recipientRole: "tenantAdmin" as const,
        type: "bulk_import_complete" as const,
        title: "Bulk Import Complete",
        body: "20 students have been successfully imported.",
        entityType: "class" as const,
        entityId: classes[0]?.id || "",
      },
      {
        recipientId: tenantAdminUid,
        recipientRole: "tenantAdmin" as const,
        type: "ai_budget_alert" as const,
        title: "AI Budget Alert",
        body: "AI grading costs have reached 75% of the monthly budget.",
      },
    ];

    for (const notif of notificationTemplates) {
      if (!notif.recipientId) continue;
      const notifRef = db.collection(`tenants/${tenantId}/notifications`).doc();
      await notifRef.set({
        id: notifRef.id,
        tenantId,
        recipientId: notif.recipientId,
        recipientRole: notif.recipientRole,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        entityType: notif.entityType || null,
        entityId: notif.entityId || null,
        actionUrl: null,
        isRead: Math.random() > 0.5,
        createdAt: ts(randomBetween(0, 10)),
        readAt: Math.random() > 0.5 ? ts(randomBetween(0, 5)) : null,
      });
      notifCount++;
    }
    logResult("7", "notifications", notifCount, "success");
  } catch (err: any) {
    logResult("7", "notifications", notifCount, "failed", err.message);
  }

  // =========================================================================
  // STEP 8: NotificationPreferences
  // =========================================================================
  console.log("\n[8/11] Creating NotificationPreferences...");
  let prefCount = 0;
  try {
    const allUserUids = [
      tenantAdminUid,
      ...teachers.map((t) => t.authUid || t.uid || ""),
      ...students.slice(0, 10).map((s) => s.authUid || s.uid || ""),
      ...parents.slice(0, 4).map((p) => p.authUid || p.uid || ""),
    ].filter(Boolean);

    for (const uid of allUserUids) {
      const prefRef = db.doc(`tenants/${tenantId}/notificationPreferences/${uid}`);
      await prefRef.set({
        id: uid,
        tenantId,
        userId: uid,
        enabledTypes: [
          "exam_results_released",
          "new_exam_assigned",
          "new_space_assigned",
          "submission_graded",
          "grading_complete",
          "student_at_risk",
          "deadline_reminder",
          "space_published",
        ],
        muteUntil: null,
      });
      prefCount++;
    }
    logResult("8", "notificationPreferences", prefCount, "success");
  } catch (err: any) {
    logResult("8", "notificationPreferences", prefCount, "failed", err.message);
  }

  // =========================================================================
  // STEP 9: LearningInsights
  // =========================================================================
  console.log("\n[9/11] Creating LearningInsights...");
  let insightCount = 0;
  try {
    const insightTemplates = [
      {
        type: "weak_topic_recommendation",
        priority: "high",
        title: "Algebra Practice Recommended",
        description:
          "Based on your recent exam performance, you could benefit from additional practice in Algebraic Expressions.",
        actionType: "practice_space",
        actionEntityTitle: "Mathematics Fundamentals",
      },
      {
        type: "exam_preparation",
        priority: "medium",
        title: "Upcoming Physics Test",
        description:
          "Prepare for the upcoming Physics Unit Test by reviewing Kinematics and Newton's Laws.",
        actionType: "review_exam",
        actionEntityTitle: "Physics — Mechanics",
      },
      {
        type: "streak_encouragement",
        priority: "low",
        title: "Great Streak!",
        description: "You've been learning consistently for 5 days. Keep it up!",
        actionType: "celebrate",
      },
      {
        type: "improvement_celebration",
        priority: "medium",
        title: "Score Improved!",
        description:
          "Your Chemistry score improved by 15% compared to last exam. Excellent progress!",
        actionType: "celebrate",
      },
      {
        type: "at_risk_intervention",
        priority: "high",
        title: "Seek Help",
        description:
          "Your performance in Science has been declining. Consider talking to your teacher.",
        actionType: "seek_help",
      },
    ];

    for (const student of students.slice(0, 10)) {
      // 2-3 insights per student
      const numInsights = randomBetween(2, 3);
      for (let i = 0; i < numInsights; i++) {
        const template = insightTemplates[i % insightTemplates.length];
        const insightRef = db.collection(`tenants/${tenantId}/insights`).doc();
        await insightRef.set({
          id: insightRef.id,
          tenantId,
          studentId: student.id,
          type: template.type,
          priority: template.priority,
          title: template.title,
          description: template.description,
          actionType: template.actionType,
          actionEntityId: spaces[0]?.id || null,
          actionEntityTitle: template.actionEntityTitle || null,
          createdAt: ts(randomBetween(0, 7)),
          dismissedAt: null,
        });
        insightCount++;
      }
    }
    logResult("9", "insights", insightCount, "success");
  } catch (err: any) {
    logResult("9", "insights", insightCount, "failed", err.message);
  }

  // =========================================================================
  // STEP 10: DailyCostSummary
  // =========================================================================
  console.log("\n[10/11] Creating DailyCostSummary...");
  let costCount = 0;
  try {
    // Create 14 days of cost data
    for (let day = 0; day < 14; day++) {
      const dateStr = new Date(now - day * 86400000).toISOString().split("T")[0];
      const calls = randomBetween(10, 100);
      const inputTokens = calls * randomBetween(500, 2000);
      const outputTokens = calls * randomBetween(200, 800);
      const costUsd = (inputTokens * 0.0000015 + outputTokens * 0.000002) * 10; // scaled up for visibility

      const costRef = db.doc(`tenants/${tenantId}/dailyCostSummaries/${dateStr}`);
      await costRef.set({
        id: dateStr,
        tenantId,
        date: dateStr,
        totalCalls: calls,
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
        totalCostUsd: Math.round(costUsd * 100) / 100,
        byPurpose: {
          grading: {
            calls: Math.floor(calls * 0.6),
            inputTokens: Math.floor(inputTokens * 0.6),
            outputTokens: Math.floor(outputTokens * 0.6),
            costUsd: Math.round(costUsd * 0.6 * 100) / 100,
          },
          tutoring: {
            calls: Math.floor(calls * 0.3),
            inputTokens: Math.floor(inputTokens * 0.3),
            outputTokens: Math.floor(outputTokens * 0.3),
            costUsd: Math.round(costUsd * 0.3 * 100) / 100,
          },
          extraction: {
            calls: Math.floor(calls * 0.1),
            inputTokens: Math.floor(inputTokens * 0.1),
            outputTokens: Math.floor(outputTokens * 0.1),
            costUsd: Math.round(costUsd * 0.1 * 100) / 100,
          },
        },
        byModel: {
          "gemini-1.5-flash": {
            calls: Math.floor(calls * 0.7),
            inputTokens: Math.floor(inputTokens * 0.7),
            outputTokens: Math.floor(outputTokens * 0.7),
            costUsd: Math.round(costUsd * 0.5 * 100) / 100,
          },
          "gemini-1.5-pro": {
            calls: Math.floor(calls * 0.3),
            inputTokens: Math.floor(inputTokens * 0.3),
            outputTokens: Math.floor(outputTokens * 0.3),
            costUsd: Math.round(costUsd * 0.5 * 100) / 100,
          },
        },
        budgetLimitUsd: 50,
        budgetUsedPercent: Math.round((costUsd / 50) * 100 * 14),
        budgetAlertSent: false,
        computedAt: ts(day),
      });
      costCount++;
    }
    logResult("10", "dailyCostSummaries", costCount, "success");
  } catch (err: any) {
    logResult("10", "dailyCostSummaries", costCount, "failed", err.message);
  }

  // =========================================================================
  // STEP 11: RTDB Notification State
  // =========================================================================
  console.log("\n[11/11] Creating RTDB notification state...");
  let rtdbCount = 0;
  try {
    const allUserUids = [
      tenantAdminUid,
      ...teachers.map((t) => t.authUid || t.uid || ""),
      ...students.slice(0, 10).map((s) => s.authUid || s.uid || ""),
      ...parents.slice(0, 4).map((p) => p.authUid || p.uid || ""),
    ].filter(Boolean);

    for (const uid of allUserUids) {
      await rtdb.ref(`notifications/${tenantId}/${uid}`).set({
        unreadCount: randomBetween(0, 5),
        latest: {
          id: `notif_${uid}_latest`,
          title: "Latest Notification",
          type: "system_announcement",
          createdAt: now,
        },
      });
      rtdbCount++;
    }
    logResult("11", "RTDB notification state", rtdbCount, "success");
  } catch (err: any) {
    logResult("11", "RTDB notification state", rtdbCount, "failed", err.message);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  ENHANCED SEED COMPLETE                                    ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");

  const successCount = results.filter((r) => r.status === "success").length;
  const failCount = results.filter((r) => r.status === "failed").length;

  console.log(`║  Total steps: ${results.length}                                            ║`);
  console.log(`║  Successful: ${successCount}                                              ║`);
  console.log(`║  Failed: ${failCount}                                                  ║`);
  console.log("╠══════════════════════════════════════════════════════════════╣");

  for (const r of results) {
    const statusIcon = r.status === "success" ? "✅" : "❌";
    console.log(`║  ${statusIcon} ${r.collection}: ${r.count} docs`);
  }

  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Write results JSON for report generation
  const reportData = {
    tenantId,
    tenantCode,
    timestamp: new Date().toISOString(),
    results,
    totals: {
      totalDocumentsCreated: results
        .filter((r) => r.status === "success")
        .reduce((sum, r) => sum + r.count, 0),
      successSteps: successCount,
      failedSteps: failCount,
    },
  };

  // Write report to file
  const { writeFileSync } = await import("fs");
  writeFileSync(
    resolve(__dirname, "../scripts/seed-enhanced-results.json"),
    JSON.stringify(reportData, null, 2)
  );
  console.log("\nResults written to scripts/seed-enhanced-results.json");
}

// ===========================================================================
// RUN
// ===========================================================================
seedEnhanced().catch((err) => {
  console.error("\n❌ Enhanced seed failed:", err);
  process.exit(1);
});
