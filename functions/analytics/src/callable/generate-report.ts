/**
 * generateReport — Consolidated callable function.
 *
 * Replaces: generateExamResultPdf, generateProgressReportPdf, generateClassReportPdf
 *
 * type: 'exam-result' → exam result PDF (individual or class summary)
 * type: 'progress'    → student progress report PDF
 * type: 'class'       → class report card PDF
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  createPdfDocument,
  addHeader,
  addSectionTitle,
  addKeyValue,
  addSimpleTable,
  addFooter,
  drawHorizontalLine,
  pdfToBuffer,
  getGradeColor,
  FONTS,
  COLORS,
} from "../utils/pdf-helpers";
import { logger } from "firebase-functions/v2";
import type { GenerateReportRequest, GenerateReportResponse } from "../contracts/wire";
import { GenerateReportRequestSchema } from "../contracts/wire";
import type {
  SubmissionDoc,
  ExamQuestionDoc,
  StudentProgressSummary,
  ClassProgressSummary,
} from "../contracts/legacy-docs";
import {
  ExamSchema,
  ExamQuestionSchema,
  SubmissionSchema,
  StudentProgressSummarySchema,
  ClassProgressSummarySchema,
} from "../contracts/legacy-docs";
import { parseRequest } from "../utils/parse-request";
import { enforceRateLimit } from "../utils/rate-limit";

export const generateReport = onCall(
  { region: "asia-south1", memory: "512MiB", timeoutSeconds: 120, cors: true },
  async (request): Promise<GenerateReportResponse> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const data = parseRequest(request.data, GenerateReportRequestSchema);
    if (!data.tenantId || !data.type) {
      throw new HttpsError("invalid-argument", "tenantId and type are required.");
    }

    const callerUid = request.auth.uid;
    await enforceRateLimit(data.tenantId, callerUid, "report", 5);

    switch (data.type) {
      case "exam-result":
        return handleExamResultPdf(data);
      case "progress":
        return handleProgressReportPdf(data);
      case "class":
        return handleClassReportPdf(data);
      default:
        throw new HttpsError(
          "invalid-argument",
          'type must be "exam-result", "progress", or "class".'
        );
    }
  }
);

// ── Upload Utility ─────────────────────────────────────────────────────────

async function uploadAndGetUrl(
  tenantId: string,
  folder: string,
  fileName: string,
  buffer: Buffer
): Promise<GenerateReportResponse> {
  const bucket = admin.storage().bucket();
  const filePath = `tenants/${tenantId}/reports/${folder}/${fileName}`;
  const file = bucket.file(filePath);

  await file.save(buffer, {
    metadata: { contentType: "application/pdf" },
  });

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  return { pdfUrl: url };
}

// ═══════════════════════════════════════════════════════════════════════════
// type: 'exam-result'
// ═══════════════════════════════════════════════════════════════════════════

async function handleExamResultPdf(data: GenerateReportRequest): Promise<GenerateReportResponse> {
  if (!data.examId) {
    throw new HttpsError("invalid-argument", 'examId is required for type "exam-result".');
  }

  const db = admin.firestore();

  // Fetch exam
  const examSnap = await db.doc(`tenants/${data.tenantId}/exams/${data.examId}`).get();
  if (!examSnap.exists) {
    throw new HttpsError("not-found", "Exam not found.");
  }
  const examResult = ExamSchema.safeParse({ id: examSnap.id, ...examSnap.data() });
  if (!examResult.success) {
    logger.error("Invalid Exam document", {
      docId: examSnap.id,
      errors: examResult.error.flatten(),
    });
    throw new HttpsError("internal", "Data integrity error");
  }
  const exam = examResult.data;

  // Fetch questions
  const questionsSnap = await db
    .collection(`tenants/${data.tenantId}/exams/${data.examId}/questions`)
    .orderBy("order", "asc")
    .get();
  const questions = questionsSnap.docs.map((d) => {
    const qResult = ExamQuestionSchema.safeParse({ id: d.id, ...d.data() });
    if (!qResult.success) {
      logger.error("Invalid ExamQuestion document", {
        docId: d.id,
        errors: qResult.error.flatten(),
      });
      throw new HttpsError("internal", "Data integrity error");
    }
    return qResult.data as unknown as ExamQuestionDoc;
  });

  if (data.studentId) {
    return generateIndividualExamReport(data, exam, questions);
  }
  return generateClassExamSummaryReport(data, exam, questions);
}

// ── Individual Student Exam Report ─────────────────────────────────────────

async function generateIndividualExamReport(
  data: GenerateReportRequest,
  exam: FirebaseFirestore.DocumentData,
  questions: ExamQuestionDoc[]
): Promise<GenerateReportResponse> {
  const db = admin.firestore();

  // Find submission for this student + exam
  const subSnap = await db
    .collection(`tenants/${data.tenantId}/submissions`)
    .where("examId", "==", data.examId)
    .where("studentId", "==", data.studentId)
    .limit(1)
    .get();

  if (subSnap.empty) {
    throw new HttpsError("not-found", "Submission not found for this student.");
  }

  const subResult = SubmissionSchema.safeParse({
    id: subSnap.docs[0].id,
    ...subSnap.docs[0].data(),
  });
  if (!subResult.success) {
    logger.error("Invalid Submission document", {
      docId: subSnap.docs[0].id,
      errors: subResult.error.flatten(),
    });
    throw new HttpsError("internal", "Data integrity error");
  }
  const submission = subResult.data as unknown as SubmissionDoc;

  // Fetch question submissions for per-question breakdown
  const qSubSnap = await db
    .collection(`tenants/${data.tenantId}/submissions/${submission.id}/questionSubmissions`)
    .get();
  const qSubs = new Map(qSubSnap.docs.map((d) => [d.id, d.data()]));

  // Fetch class average for comparison
  const allSubsSnap = await db
    .collection(`tenants/${data.tenantId}/submissions`)
    .where("examId", "==", data.examId)
    .get();
  const allSubs = allSubsSnap.docs.map((d) => {
    const r = SubmissionSchema.safeParse({ id: d.id, ...d.data() });
    if (!r.success) {
      logger.error("Invalid Submission document", { docId: d.id, errors: r.error.flatten() });
      throw new HttpsError("internal", "Data integrity error");
    }
    return r.data as unknown as SubmissionDoc;
  });
  const classAvg =
    allSubs.length > 0
      ? allSubs.reduce((sum, s) => sum + (s.summary?.percentage ?? 0), 0) / allSubs.length
      : 0;

  // Build PDF
  const doc = createPdfDocument();

  addHeader(doc, exam.title || "Exam Result", `Result Report — ${submission.studentName}`);

  // Student info
  addSectionTitle(doc, "Student Information");
  addKeyValue(doc, "Name", submission.studentName);
  addKeyValue(doc, "Roll Number", submission.rollNumber);
  addKeyValue(doc, "Subject", exam.subject || "--");
  addKeyValue(doc, "Total Marks", exam.totalMarks);
  addKeyValue(doc, "Duration", `${exam.duration} minutes`);
  doc.moveDown(0.5);

  // Score summary
  addSectionTitle(doc, "Score Summary");
  const pct = submission.summary?.percentage ?? 0;
  doc
    .fontSize(28)
    .font(FONTS.heading)
    .fillColor(getGradeColor(pct))
    .text(`${Math.round(pct)}%`, { align: "center" });
  doc
    .fontSize(12)
    .font(FONTS.body)
    .fillColor(COLORS.text)
    .text(
      `${submission.summary?.totalScore ?? 0} / ${submission.summary?.maxScore ?? exam.totalMarks}  |  Grade: ${submission.summary?.grade ?? "--"}`,
      { align: "center" }
    );
  doc
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(`Class Average: ${Math.round(classAvg)}%`, { align: "center" });
  doc.moveDown(0.8);

  // Per-question breakdown
  addSectionTitle(doc, "Question-wise Breakdown");

  const tableHeaders = ["Q#", "Max Marks", "Obtained", "Status"];
  const tableRows = questions.map((q) => {
    const qs = qSubs.get(q.id);
    const obtained = qs?.manualOverride
      ? qs.manualOverride.score
      : (qs?.evaluation?.totalScore ?? "--");
    const status =
      qs?.gradingStatus === "graded"
        ? "Graded"
        : qs?.gradingStatus === "failed"
          ? "Failed"
          : "Pending";
    return [`Q${q.order}`, q.maxMarks, obtained, status];
  });

  const pageW = 495; // A4 minus margins
  addSimpleTable(doc, tableHeaders, tableRows, [60, 100, 100, pageW - 260]);

  // Footer
  addFooter(doc, `LevelUp — ${exam.title} — ${submission.studentName}`);

  const buffer = await pdfToBuffer(doc);
  return uploadAndGetUrl(
    data.tenantId,
    `exams/${data.examId}`,
    `result-${data.studentId}.pdf`,
    buffer
  );
}

// ── Class Exam Summary Report ──────────────────────────────────────────────

async function generateClassExamSummaryReport(
  data: GenerateReportRequest,
  exam: FirebaseFirestore.DocumentData,
  questions: ExamQuestionDoc[]
): Promise<GenerateReportResponse> {
  const db = admin.firestore();

  // Fetch all submissions for this exam
  const subsSnap = await db
    .collection(`tenants/${data.tenantId}/submissions`)
    .where("examId", "==", data.examId)
    .get();
  const submissions = subsSnap.docs.map((d) => {
    const r = SubmissionSchema.safeParse({ id: d.id, ...d.data() });
    if (!r.success) {
      logger.error("Invalid Submission document", { docId: d.id, errors: r.error.flatten() });
      throw new HttpsError("internal", "Data integrity error");
    }
    return r.data as unknown as SubmissionDoc;
  });

  if (submissions.length === 0) {
    throw new HttpsError("not-found", "No submissions found for this exam.");
  }

  // Calculate stats
  const scores = submissions
    .filter((s) => s.summary?.percentage != null)
    .map((s) => s.summary.percentage);
  const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
  const variance =
    scores.length > 0 ? scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length : 0;
  const stdDev = Math.sqrt(variance);

  // Grade distribution
  const gradeDist: Record<string, number> = {};
  submissions.forEach((s) => {
    const grade = s.summary?.grade || "Ungraded";
    gradeDist[grade] = (gradeDist[grade] || 0) + 1;
  });

  // Sorted by score descending
  const ranked = [...submissions]
    .filter((s) => s.summary?.percentage != null)
    .sort((a, b) => (b.summary?.percentage ?? 0) - (a.summary?.percentage ?? 0));
  const top10 = ranked.slice(0, 10);
  const bottom10 = ranked.slice(-10).reverse();

  // Build PDF
  const doc = createPdfDocument();

  addHeader(doc, exam.title || "Exam", "Class Results Summary");

  addSectionTitle(doc, "Exam Overview");
  addKeyValue(doc, "Subject", exam.subject || "--");
  addKeyValue(doc, "Total Marks", exam.totalMarks);
  addKeyValue(doc, "Total Submissions", submissions.length);
  addKeyValue(doc, "Graded", scores.length);
  doc.moveDown(0.5);

  // Statistical summary
  addSectionTitle(doc, "Statistical Summary");
  addKeyValue(doc, "Mean", `${Math.round(mean * 10) / 10}%`);
  addKeyValue(doc, "Median", `${Math.round(median * 10) / 10}%`);
  addKeyValue(doc, "Std Deviation", `${Math.round(stdDev * 10) / 10}%`);
  addKeyValue(doc, "Highest", `${Math.round((sorted[sorted.length - 1] ?? 0) * 10) / 10}%`);
  addKeyValue(doc, "Lowest", `${Math.round((sorted[0] ?? 0) * 10) / 10}%`);
  doc.moveDown(0.5);

  // Grade distribution
  addSectionTitle(doc, "Grade Distribution");
  const gradeHeaders = ["Grade", "Count", "Percentage"];
  const gradeRows = Object.entries(gradeDist)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([grade, count]) => [grade, count, `${Math.round((count / submissions.length) * 100)}%`]);
  addSimpleTable(doc, gradeHeaders, gradeRows, [165, 165, 165]);
  doc.moveDown(0.5);

  // Top 10
  addSectionTitle(doc, "Top 10 Performers");
  const topHeaders = ["Rank", "Name", "Roll No.", "Score", "%"];
  const topRows = top10.map((s, i) => [
    i + 1,
    s.studentName,
    s.rollNumber,
    `${s.summary?.totalScore ?? 0}/${s.summary?.maxScore ?? exam.totalMarks}`,
    `${Math.round(s.summary?.percentage ?? 0)}%`,
  ]);
  addSimpleTable(doc, topHeaders, topRows, [50, 160, 80, 105, 100]);
  doc.moveDown(0.5);

  // Bottom 10
  if (bottom10.length > 0) {
    addSectionTitle(doc, "Bottom 10 Performers");
    const bottomRows = bottom10.map((s, i) => [
      ranked.length - bottom10.length + i + 1,
      s.studentName,
      s.rollNumber,
      `${s.summary?.totalScore ?? 0}/${s.summary?.maxScore ?? exam.totalMarks}`,
      `${Math.round(s.summary?.percentage ?? 0)}%`,
    ]);
    addSimpleTable(doc, topHeaders, bottomRows, [50, 160, 80, 105, 100]);
  }

  addFooter(doc, `LevelUp — ${exam.title} — Class Summary`);

  const buffer = await pdfToBuffer(doc);
  return uploadAndGetUrl(data.tenantId, `exams/${data.examId}`, "class-summary.pdf", buffer);
}

// ═══════════════════════════════════════════════════════════════════════════
// type: 'progress'
// ═══════════════════════════════════════════════════════════════════════════

async function handleProgressReportPdf(
  data: GenerateReportRequest
): Promise<GenerateReportResponse> {
  if (!data.studentId) {
    throw new HttpsError("invalid-argument", 'studentId is required for type "progress".');
  }

  const db = admin.firestore();

  // Fetch student progress summary
  const summarySnap = await db
    .doc(`tenants/${data.tenantId}/studentProgressSummaries/${data.studentId}`)
    .get();

  if (!summarySnap.exists) {
    throw new HttpsError("not-found", "Student progress summary not found.");
  }

  const summaryResult = StudentProgressSummarySchema.safeParse({
    id: summarySnap.id,
    ...summarySnap.data(),
  });
  if (!summaryResult.success) {
    logger.error("Invalid StudentProgressSummary document", {
      docId: summarySnap.id,
      errors: summaryResult.error.flatten(),
    });
    throw new HttpsError("internal", "Data integrity error");
  }
  const summary = summaryResult.data as unknown as StudentProgressSummary;

  // Fetch student profile for name
  const membershipSnap = await db
    .collection("userMemberships")
    .where("tenantId", "==", data.tenantId)
    .where("uid", "==", data.studentId)
    .where("role", "==", "student")
    .limit(1)
    .get();

  const studentName = membershipSnap.empty
    ? "Student"
    : `${membershipSnap.docs[0].data().firstName ?? ""} ${membershipSnap.docs[0].data().lastName ?? ""}`.trim() ||
      "Student";

  // Build PDF
  const doc = createPdfDocument();

  addHeader(doc, "Student Progress Report", studentName);

  // ── Student Info ────────────────────────────────────────────────────
  addSectionTitle(doc, "Student Information");
  addKeyValue(doc, "Name", studentName);
  addKeyValue(doc, "Student ID", data.studentId.slice(0, 12));
  addKeyValue(doc, "Overall Score", `${Math.round(summary.overallScore * 100)}%`);
  addKeyValue(doc, "At Risk", summary.isAtRisk ? "Yes" : "No");
  doc.moveDown(0.5);

  // ── AutoGrade Summary ───────────────────────────────────────────────
  addSectionTitle(doc, "AutoGrade — Exam Performance");
  const ag = summary.autograde;
  addKeyValue(doc, "Exams Taken", ag.totalExams);
  addKeyValue(doc, "Exams Completed", ag.completedExams);
  addKeyValue(doc, "Average Score", `${Math.round(ag.averagePercentage)}%`);
  addKeyValue(doc, "Total Marks", `${ag.totalMarksObtained} / ${ag.totalMarksAvailable}`);
  doc.moveDown(0.3);

  // Subject breakdown
  const agSubjects = Object.entries(ag.subjectBreakdown);
  if (agSubjects.length > 0) {
    doc.fontSize(11).font(FONTS.heading).fillColor(COLORS.text).text("Subject Breakdown");
    doc.moveDown(0.2);
    addSimpleTable(
      doc,
      ["Subject", "Avg Score", "Exams"],
      agSubjects.map(([subject, b]) => [subject, `${Math.round(b.avgScore * 100)}%`, b.examCount]),
      [200, 147, 148]
    );
    doc.moveDown(0.3);
  }

  // Recent exams
  if (ag.recentExams.length > 0) {
    doc.fontSize(11).font(FONTS.heading).fillColor(COLORS.text).text("Recent Exams");
    doc.moveDown(0.2);
    addSimpleTable(
      doc,
      ["Exam", "Score", "%"],
      ag.recentExams
        .slice(0, 5)
        .map((e) => [e.examTitle, `${Math.round(e.score * 100)}%`, `${Math.round(e.percentage)}%`]),
      [250, 122, 123]
    );
  }
  doc.moveDown(0.5);

  // ── LevelUp Summary ────────────────────────────────────────────────
  addSectionTitle(doc, "LevelUp — Learning Progress");
  const lu = summary.levelup;
  addKeyValue(doc, "Spaces Enrolled", lu.totalSpaces);
  addKeyValue(doc, "Spaces Completed", lu.completedSpaces);
  addKeyValue(doc, "Average Completion", `${Math.round(lu.averageCompletion)}%`);
  addKeyValue(doc, "Total Points", `${lu.totalPointsEarned} / ${lu.totalPointsAvailable}`);
  addKeyValue(doc, "Average Accuracy", `${Math.round(lu.averageAccuracy * 100)}%`);
  addKeyValue(doc, "Streak Days", lu.streakDays);
  doc.moveDown(0.3);

  // Subject breakdown
  const luSubjects = Object.entries(lu.subjectBreakdown);
  if (luSubjects.length > 0) {
    doc.fontSize(11).font(FONTS.heading).fillColor(COLORS.text).text("Subject Breakdown");
    doc.moveDown(0.2);
    addSimpleTable(
      doc,
      ["Subject", "Avg Completion", "Spaces"],
      luSubjects.map(([subject, b]) => [subject, `${Math.round(b.avgCompletion)}%`, b.spaceCount]),
      [200, 147, 148]
    );
  }
  doc.moveDown(0.5);

  // ── Strengths & Weaknesses ─────────────────────────────────────────
  drawHorizontalLine(doc);
  doc.moveDown(0.5);
  addSectionTitle(doc, "Strengths & Areas for Improvement");

  if (summary.strengthAreas.length > 0) {
    doc.fontSize(10).font(FONTS.heading).fillColor(COLORS.accent).text("Strengths:");
    summary.strengthAreas.forEach((area) => {
      doc.fontSize(10).font(FONTS.body).fillColor(COLORS.text).text(`  • ${area}`);
    });
    doc.moveDown(0.3);
  }

  if (summary.weaknessAreas.length > 0) {
    doc.fontSize(10).font(FONTS.heading).fillColor(COLORS.warning).text("Areas for Improvement:");
    summary.weaknessAreas.forEach((area) => {
      doc.fontSize(10).font(FONTS.body).fillColor(COLORS.text).text(`  • ${area}`);
    });
  }

  if (summary.isAtRisk && summary.atRiskReasons.length > 0) {
    doc.moveDown(0.3);
    doc.fontSize(10).font(FONTS.heading).fillColor(COLORS.danger).text("At-Risk Flags:");
    summary.atRiskReasons.forEach((reason) => {
      doc.fontSize(10).font(FONTS.body).fillColor(COLORS.text).text(`  • ${reason}`);
    });
  }

  addFooter(doc, `LevelUp — Progress Report — ${studentName}`);

  const buffer = await pdfToBuffer(doc);
  const fileName = `progress-report-${Date.now()}.pdf`;
  return uploadAndGetUrl(data.tenantId, `progress/${data.studentId}`, fileName, buffer);
}

// ═══════════════════════════════════════════════════════════════════════════
// type: 'class'
// ═══════════════════════════════════════════════════════════════════════════

async function handleClassReportPdf(data: GenerateReportRequest): Promise<GenerateReportResponse> {
  if (!data.classId) {
    throw new HttpsError("invalid-argument", 'classId is required for type "class".');
  }

  const db = admin.firestore();

  // Fetch class progress summary
  const classSummarySnap = await db
    .doc(`tenants/${data.tenantId}/classProgressSummaries/${data.classId}`)
    .get();

  let classSummary: ClassProgressSummary | null = null;
  if (classSummarySnap.exists) {
    const csResult = ClassProgressSummarySchema.safeParse({
      id: classSummarySnap.id,
      ...classSummarySnap.data(),
    });
    if (!csResult.success) {
      logger.error("Invalid ClassProgressSummary document", {
        docId: classSummarySnap.id,
        errors: csResult.error.flatten(),
      });
    } else {
      classSummary = csResult.data as unknown as ClassProgressSummary;
    }
  }

  // Fetch class info
  const classSnap = await db.doc(`tenants/${data.tenantId}/classes/${data.classId}`).get();
  const classData = classSnap.exists ? classSnap.data()! : {};
  const className = classData.name || classSummary?.className || data.classId;

  // Fetch all student memberships in this class
  const membershipsSnap = await db
    .collection("userMemberships")
    .where("tenantId", "==", data.tenantId)
    .where("role", "==", "student")
    .where("classIds", "array-contains", data.classId)
    .get();

  const studentIds = membershipsSnap.docs.map((d) => d.data().uid as string);
  const studentNames = new Map(
    membershipsSnap.docs.map((d) => {
      const m = d.data();
      return [m.uid, `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || m.uid.slice(0, 8)];
    })
  );

  // Fetch student progress summaries in batches of 30
  const studentSummaries: StudentProgressSummary[] = [];
  for (let i = 0; i < studentIds.length; i += 30) {
    const batch = studentIds.slice(i, i + 30);
    const snaps = await Promise.all(
      batch.map((id) => db.doc(`tenants/${data.tenantId}/studentProgressSummaries/${id}`).get())
    );
    snaps.forEach((snap) => {
      if (snap.exists) {
        const r = StudentProgressSummarySchema.safeParse({ id: snap.id, ...snap.data() });
        if (r.success) {
          studentSummaries.push(r.data as unknown as StudentProgressSummary);
        } else {
          logger.error("Invalid StudentProgressSummary document", {
            docId: snap.id,
            errors: r.error.flatten(),
          });
        }
      }
    });
  }

  // Build PDF
  const doc = createPdfDocument();

  addHeader(doc, "Class Report Card", className);

  // ── Class Overview ─────────────────────────────────────────────────
  addSectionTitle(doc, "Class Overview");
  addKeyValue(doc, "Class", className);
  addKeyValue(doc, "Total Students", studentIds.length);

  if (classSummary) {
    addKeyValue(
      doc,
      "Avg Exam Score",
      `${Math.round(classSummary.autograde.averageClassScore * 100)}%`
    );
    addKeyValue(
      doc,
      "Exam Completion Rate",
      `${Math.round(classSummary.autograde.examCompletionRate * 100)}%`
    );
    addKeyValue(
      doc,
      "Avg Space Completion",
      `${Math.round(classSummary.levelup.averageClassCompletion)}%`
    );
    addKeyValue(
      doc,
      "Active Student Rate",
      `${Math.round(classSummary.levelup.activeStudentRate * 100)}%`
    );
    addKeyValue(doc, "At-Risk Students", classSummary.atRiskCount);
  }
  doc.moveDown(0.5);

  // ── Student Roster with Scores ─────────────────────────────────────
  addSectionTitle(doc, "Student Performance Roster");

  const rosterHeaders = ["Name", "Exam Avg", "Space %", "Overall", "At Risk"];
  const rosterRows = studentSummaries
    .sort((a, b) => b.overallScore - a.overallScore)
    .map((s) => [
      studentNames.get(s.studentId) || s.studentId.slice(0, 10),
      `${Math.round(s.autograde.averagePercentage)}%`,
      `${Math.round(s.levelup.averageCompletion)}%`,
      `${Math.round(s.overallScore * 100)}%`,
      s.isAtRisk ? "Yes" : "--",
    ]);

  if (rosterRows.length > 0) {
    addSimpleTable(doc, rosterHeaders, rosterRows, [160, 80, 80, 80, 95]);
  } else {
    doc
      .fontSize(10)
      .font(FONTS.body)
      .fillColor(COLORS.muted)
      .text("No student progress data available yet.");
  }
  doc.moveDown(0.5);

  // ── AutoGrade Section ──────────────────────────────────────────────
  addSectionTitle(doc, "AutoGrade — Exam Averages");

  const agRows = studentSummaries
    .filter((s) => s.autograde.totalExams > 0)
    .sort((a, b) => b.autograde.averagePercentage - a.autograde.averagePercentage)
    .map((s) => [
      studentNames.get(s.studentId) || s.studentId.slice(0, 10),
      s.autograde.totalExams,
      `${s.autograde.totalMarksObtained}/${s.autograde.totalMarksAvailable}`,
      `${Math.round(s.autograde.averagePercentage)}%`,
    ]);

  if (agRows.length > 0) {
    addSimpleTable(doc, ["Name", "Exams", "Total Marks", "Avg %"], agRows, [180, 70, 130, 115]);
  } else {
    doc.fontSize(10).font(FONTS.body).fillColor(COLORS.muted).text("No exam data available.");
  }
  doc.moveDown(0.5);

  // ── LevelUp Section ────────────────────────────────────────────────
  addSectionTitle(doc, "LevelUp — Space Completion");

  const luRows = studentSummaries
    .filter((s) => s.levelup.totalSpaces > 0)
    .sort((a, b) => b.levelup.averageCompletion - a.levelup.averageCompletion)
    .map((s) => [
      studentNames.get(s.studentId) || s.studentId.slice(0, 10),
      `${s.levelup.completedSpaces}/${s.levelup.totalSpaces}`,
      `${s.levelup.totalPointsEarned}`,
      `${Math.round(s.levelup.averageCompletion)}%`,
    ]);

  if (luRows.length > 0) {
    addSimpleTable(doc, ["Name", "Spaces", "Points", "Completion"], luRows, [180, 100, 100, 115]);
  } else {
    doc.fontSize(10).font(FONTS.body).fillColor(COLORS.muted).text("No learning data available.");
  }
  doc.moveDown(0.5);

  // ── At-Risk Students ───────────────────────────────────────────────
  const atRiskStudents = studentSummaries.filter((s) => s.isAtRisk);
  if (atRiskStudents.length > 0) {
    drawHorizontalLine(doc);
    doc.moveDown(0.5);
    addSectionTitle(doc, "At-Risk Students");

    atRiskStudents.forEach((s) => {
      const name = studentNames.get(s.studentId) || s.studentId.slice(0, 10);
      doc
        .fontSize(10)
        .font(FONTS.heading)
        .fillColor(COLORS.danger)
        .text(`${name}:`, { continued: true })
        .font(FONTS.body)
        .fillColor(COLORS.text)
        .text(` ${s.atRiskReasons.join(", ")}`);
    });
  }

  addFooter(doc, `LevelUp — Class Report — ${className}`);

  const buffer = await pdfToBuffer(doc);
  const fileName = `class-report-${Date.now()}.pdf`;
  return uploadAndGetUrl(data.tenantId, `classes/${data.classId}`, fileName, buffer);
}
