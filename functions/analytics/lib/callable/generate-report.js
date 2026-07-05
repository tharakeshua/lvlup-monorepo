"use strict";
/**
 * generateReport — Consolidated callable function.
 *
 * Replaces: generateExamResultPdf, generateProgressReportPdf, generateClassReportPdf
 *
 * type: 'exam-result' → exam result PDF (individual or class summary)
 * type: 'progress'    → student progress report PDF
 * type: 'class'       → class report card PDF
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReport = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const pdf_helpers_1 = require("../utils/pdf-helpers");
const v2_1 = require("firebase-functions/v2");
const wire_1 = require("../contracts/wire");
const legacy_docs_1 = require("../contracts/legacy-docs");
const parse_request_1 = require("../utils/parse-request");
const rate_limit_1 = require("../utils/rate-limit");
exports.generateReport = (0, https_1.onCall)(
  { region: "asia-south1", memory: "512MiB", timeoutSeconds: 120, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const data = (0, parse_request_1.parseRequest)(
      request.data,
      wire_1.GenerateReportRequestSchema
    );
    if (!data.tenantId || !data.type) {
      throw new https_1.HttpsError("invalid-argument", "tenantId and type are required.");
    }
    const callerUid = request.auth.uid;
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "report", 5);
    switch (data.type) {
      case "exam-result":
        return handleExamResultPdf(data);
      case "progress":
        return handleProgressReportPdf(data);
      case "class":
        return handleClassReportPdf(data);
      default:
        throw new https_1.HttpsError(
          "invalid-argument",
          'type must be "exam-result", "progress", or "class".'
        );
    }
  }
);
// ── Upload Utility ─────────────────────────────────────────────────────────
async function uploadAndGetUrl(tenantId, folder, fileName, buffer) {
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
async function handleExamResultPdf(data) {
  if (!data.examId) {
    throw new https_1.HttpsError("invalid-argument", 'examId is required for type "exam-result".');
  }
  const db = admin.firestore();
  // Fetch exam
  const examSnap = await db.doc(`tenants/${data.tenantId}/exams/${data.examId}`).get();
  if (!examSnap.exists) {
    throw new https_1.HttpsError("not-found", "Exam not found.");
  }
  const examResult = legacy_docs_1.ExamSchema.safeParse({ id: examSnap.id, ...examSnap.data() });
  if (!examResult.success) {
    v2_1.logger.error("Invalid Exam document", {
      docId: examSnap.id,
      errors: examResult.error.flatten(),
    });
    throw new https_1.HttpsError("internal", "Data integrity error");
  }
  const exam = examResult.data;
  // Fetch questions
  const questionsSnap = await db
    .collection(`tenants/${data.tenantId}/exams/${data.examId}/questions`)
    .orderBy("order", "asc")
    .get();
  const questions = questionsSnap.docs.map((d) => {
    const qResult = legacy_docs_1.ExamQuestionSchema.safeParse({ id: d.id, ...d.data() });
    if (!qResult.success) {
      v2_1.logger.error("Invalid ExamQuestion document", {
        docId: d.id,
        errors: qResult.error.flatten(),
      });
      throw new https_1.HttpsError("internal", "Data integrity error");
    }
    return qResult.data;
  });
  if (data.studentId) {
    return generateIndividualExamReport(data, exam, questions);
  }
  return generateClassExamSummaryReport(data, exam, questions);
}
// ── Individual Student Exam Report ─────────────────────────────────────────
async function generateIndividualExamReport(data, exam, questions) {
  const db = admin.firestore();
  // Find submission for this student + exam
  const subSnap = await db
    .collection(`tenants/${data.tenantId}/submissions`)
    .where("examId", "==", data.examId)
    .where("studentId", "==", data.studentId)
    .limit(1)
    .get();
  if (subSnap.empty) {
    throw new https_1.HttpsError("not-found", "Submission not found for this student.");
  }
  const subResult = legacy_docs_1.SubmissionSchema.safeParse({
    id: subSnap.docs[0].id,
    ...subSnap.docs[0].data(),
  });
  if (!subResult.success) {
    v2_1.logger.error("Invalid Submission document", {
      docId: subSnap.docs[0].id,
      errors: subResult.error.flatten(),
    });
    throw new https_1.HttpsError("internal", "Data integrity error");
  }
  const submission = subResult.data;
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
    const r = legacy_docs_1.SubmissionSchema.safeParse({ id: d.id, ...d.data() });
    if (!r.success) {
      v2_1.logger.error("Invalid Submission document", { docId: d.id, errors: r.error.flatten() });
      throw new https_1.HttpsError("internal", "Data integrity error");
    }
    return r.data;
  });
  const classAvg =
    allSubs.length > 0
      ? allSubs.reduce((sum, s) => sum + (s.summary?.percentage ?? 0), 0) / allSubs.length
      : 0;
  // Build PDF
  const doc = (0, pdf_helpers_1.createPdfDocument)();
  (0, pdf_helpers_1.addHeader)(
    doc,
    exam.title || "Exam Result",
    `Result Report — ${submission.studentName}`
  );
  // Student info
  (0, pdf_helpers_1.addSectionTitle)(doc, "Student Information");
  (0, pdf_helpers_1.addKeyValue)(doc, "Name", submission.studentName);
  (0, pdf_helpers_1.addKeyValue)(doc, "Roll Number", submission.rollNumber);
  (0, pdf_helpers_1.addKeyValue)(doc, "Subject", exam.subject || "--");
  (0, pdf_helpers_1.addKeyValue)(doc, "Total Marks", exam.totalMarks);
  (0, pdf_helpers_1.addKeyValue)(doc, "Duration", `${exam.duration} minutes`);
  doc.moveDown(0.5);
  // Score summary
  (0, pdf_helpers_1.addSectionTitle)(doc, "Score Summary");
  const pct = submission.summary?.percentage ?? 0;
  doc
    .fontSize(28)
    .font(pdf_helpers_1.FONTS.heading)
    .fillColor((0, pdf_helpers_1.getGradeColor)(pct))
    .text(`${Math.round(pct)}%`, { align: "center" });
  doc
    .fontSize(12)
    .font(pdf_helpers_1.FONTS.body)
    .fillColor(pdf_helpers_1.COLORS.text)
    .text(
      `${submission.summary?.totalScore ?? 0} / ${submission.summary?.maxScore ?? exam.totalMarks}  |  Grade: ${submission.summary?.grade ?? "--"}`,
      { align: "center" }
    );
  doc
    .fontSize(10)
    .fillColor(pdf_helpers_1.COLORS.muted)
    .text(`Class Average: ${Math.round(classAvg)}%`, { align: "center" });
  doc.moveDown(0.8);
  // Per-question breakdown
  (0, pdf_helpers_1.addSectionTitle)(doc, "Question-wise Breakdown");
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
  (0, pdf_helpers_1.addSimpleTable)(doc, tableHeaders, tableRows, [60, 100, 100, pageW - 260]);
  // Footer
  (0, pdf_helpers_1.addFooter)(doc, `LevelUp — ${exam.title} — ${submission.studentName}`);
  const buffer = await (0, pdf_helpers_1.pdfToBuffer)(doc);
  return uploadAndGetUrl(
    data.tenantId,
    `exams/${data.examId}`,
    `result-${data.studentId}.pdf`,
    buffer
  );
}
// ── Class Exam Summary Report ──────────────────────────────────────────────
async function generateClassExamSummaryReport(data, exam, questions) {
  const db = admin.firestore();
  // Fetch all submissions for this exam
  const subsSnap = await db
    .collection(`tenants/${data.tenantId}/submissions`)
    .where("examId", "==", data.examId)
    .get();
  const submissions = subsSnap.docs.map((d) => {
    const r = legacy_docs_1.SubmissionSchema.safeParse({ id: d.id, ...d.data() });
    if (!r.success) {
      v2_1.logger.error("Invalid Submission document", { docId: d.id, errors: r.error.flatten() });
      throw new https_1.HttpsError("internal", "Data integrity error");
    }
    return r.data;
  });
  if (submissions.length === 0) {
    throw new https_1.HttpsError("not-found", "No submissions found for this exam.");
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
  const gradeDist = {};
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
  const doc = (0, pdf_helpers_1.createPdfDocument)();
  (0, pdf_helpers_1.addHeader)(doc, exam.title || "Exam", "Class Results Summary");
  (0, pdf_helpers_1.addSectionTitle)(doc, "Exam Overview");
  (0, pdf_helpers_1.addKeyValue)(doc, "Subject", exam.subject || "--");
  (0, pdf_helpers_1.addKeyValue)(doc, "Total Marks", exam.totalMarks);
  (0, pdf_helpers_1.addKeyValue)(doc, "Total Submissions", submissions.length);
  (0, pdf_helpers_1.addKeyValue)(doc, "Graded", scores.length);
  doc.moveDown(0.5);
  // Statistical summary
  (0, pdf_helpers_1.addSectionTitle)(doc, "Statistical Summary");
  (0, pdf_helpers_1.addKeyValue)(doc, "Mean", `${Math.round(mean * 10) / 10}%`);
  (0, pdf_helpers_1.addKeyValue)(doc, "Median", `${Math.round(median * 10) / 10}%`);
  (0, pdf_helpers_1.addKeyValue)(doc, "Std Deviation", `${Math.round(stdDev * 10) / 10}%`);
  (0, pdf_helpers_1.addKeyValue)(
    doc,
    "Highest",
    `${Math.round((sorted[sorted.length - 1] ?? 0) * 10) / 10}%`
  );
  (0, pdf_helpers_1.addKeyValue)(doc, "Lowest", `${Math.round((sorted[0] ?? 0) * 10) / 10}%`);
  doc.moveDown(0.5);
  // Grade distribution
  (0, pdf_helpers_1.addSectionTitle)(doc, "Grade Distribution");
  const gradeHeaders = ["Grade", "Count", "Percentage"];
  const gradeRows = Object.entries(gradeDist)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([grade, count]) => [grade, count, `${Math.round((count / submissions.length) * 100)}%`]);
  (0, pdf_helpers_1.addSimpleTable)(doc, gradeHeaders, gradeRows, [165, 165, 165]);
  doc.moveDown(0.5);
  // Top 10
  (0, pdf_helpers_1.addSectionTitle)(doc, "Top 10 Performers");
  const topHeaders = ["Rank", "Name", "Roll No.", "Score", "%"];
  const topRows = top10.map((s, i) => [
    i + 1,
    s.studentName,
    s.rollNumber,
    `${s.summary?.totalScore ?? 0}/${s.summary?.maxScore ?? exam.totalMarks}`,
    `${Math.round(s.summary?.percentage ?? 0)}%`,
  ]);
  (0, pdf_helpers_1.addSimpleTable)(doc, topHeaders, topRows, [50, 160, 80, 105, 100]);
  doc.moveDown(0.5);
  // Bottom 10
  if (bottom10.length > 0) {
    (0, pdf_helpers_1.addSectionTitle)(doc, "Bottom 10 Performers");
    const bottomRows = bottom10.map((s, i) => [
      ranked.length - bottom10.length + i + 1,
      s.studentName,
      s.rollNumber,
      `${s.summary?.totalScore ?? 0}/${s.summary?.maxScore ?? exam.totalMarks}`,
      `${Math.round(s.summary?.percentage ?? 0)}%`,
    ]);
    (0, pdf_helpers_1.addSimpleTable)(doc, topHeaders, bottomRows, [50, 160, 80, 105, 100]);
  }
  (0, pdf_helpers_1.addFooter)(doc, `LevelUp — ${exam.title} — Class Summary`);
  const buffer = await (0, pdf_helpers_1.pdfToBuffer)(doc);
  return uploadAndGetUrl(data.tenantId, `exams/${data.examId}`, "class-summary.pdf", buffer);
}
// ═══════════════════════════════════════════════════════════════════════════
// type: 'progress'
// ═══════════════════════════════════════════════════════════════════════════
async function handleProgressReportPdf(data) {
  if (!data.studentId) {
    throw new https_1.HttpsError("invalid-argument", 'studentId is required for type "progress".');
  }
  const db = admin.firestore();
  // Fetch student progress summary
  const summarySnap = await db
    .doc(`tenants/${data.tenantId}/studentProgressSummaries/${data.studentId}`)
    .get();
  if (!summarySnap.exists) {
    throw new https_1.HttpsError("not-found", "Student progress summary not found.");
  }
  const summaryResult = legacy_docs_1.StudentProgressSummarySchema.safeParse({
    id: summarySnap.id,
    ...summarySnap.data(),
  });
  if (!summaryResult.success) {
    v2_1.logger.error("Invalid StudentProgressSummary document", {
      docId: summarySnap.id,
      errors: summaryResult.error.flatten(),
    });
    throw new https_1.HttpsError("internal", "Data integrity error");
  }
  const summary = summaryResult.data;
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
  const doc = (0, pdf_helpers_1.createPdfDocument)();
  (0, pdf_helpers_1.addHeader)(doc, "Student Progress Report", studentName);
  // ── Student Info ────────────────────────────────────────────────────
  (0, pdf_helpers_1.addSectionTitle)(doc, "Student Information");
  (0, pdf_helpers_1.addKeyValue)(doc, "Name", studentName);
  (0, pdf_helpers_1.addKeyValue)(doc, "Student ID", data.studentId.slice(0, 12));
  (0, pdf_helpers_1.addKeyValue)(
    doc,
    "Overall Score",
    `${Math.round(summary.overallScore * 100)}%`
  );
  (0, pdf_helpers_1.addKeyValue)(doc, "At Risk", summary.isAtRisk ? "Yes" : "No");
  doc.moveDown(0.5);
  // ── AutoGrade Summary ───────────────────────────────────────────────
  (0, pdf_helpers_1.addSectionTitle)(doc, "AutoGrade — Exam Performance");
  const ag = summary.autograde;
  (0, pdf_helpers_1.addKeyValue)(doc, "Exams Taken", ag.totalExams);
  (0, pdf_helpers_1.addKeyValue)(doc, "Exams Completed", ag.completedExams);
  (0, pdf_helpers_1.addKeyValue)(doc, "Average Score", `${Math.round(ag.averagePercentage)}%`);
  (0, pdf_helpers_1.addKeyValue)(
    doc,
    "Total Marks",
    `${ag.totalMarksObtained} / ${ag.totalMarksAvailable}`
  );
  doc.moveDown(0.3);
  // Subject breakdown
  const agSubjects = Object.entries(ag.subjectBreakdown);
  if (agSubjects.length > 0) {
    doc
      .fontSize(11)
      .font(pdf_helpers_1.FONTS.heading)
      .fillColor(pdf_helpers_1.COLORS.text)
      .text("Subject Breakdown");
    doc.moveDown(0.2);
    (0, pdf_helpers_1.addSimpleTable)(
      doc,
      ["Subject", "Avg Score", "Exams"],
      agSubjects.map(([subject, b]) => [subject, `${Math.round(b.avgScore * 100)}%`, b.examCount]),
      [200, 147, 148]
    );
    doc.moveDown(0.3);
  }
  // Recent exams
  if (ag.recentExams.length > 0) {
    doc
      .fontSize(11)
      .font(pdf_helpers_1.FONTS.heading)
      .fillColor(pdf_helpers_1.COLORS.text)
      .text("Recent Exams");
    doc.moveDown(0.2);
    (0, pdf_helpers_1.addSimpleTable)(
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
  (0, pdf_helpers_1.addSectionTitle)(doc, "LevelUp — Learning Progress");
  const lu = summary.levelup;
  (0, pdf_helpers_1.addKeyValue)(doc, "Spaces Enrolled", lu.totalSpaces);
  (0, pdf_helpers_1.addKeyValue)(doc, "Spaces Completed", lu.completedSpaces);
  (0, pdf_helpers_1.addKeyValue)(doc, "Average Completion", `${Math.round(lu.averageCompletion)}%`);
  (0, pdf_helpers_1.addKeyValue)(
    doc,
    "Total Points",
    `${lu.totalPointsEarned} / ${lu.totalPointsAvailable}`
  );
  (0, pdf_helpers_1.addKeyValue)(
    doc,
    "Average Accuracy",
    `${Math.round(lu.averageAccuracy * 100)}%`
  );
  (0, pdf_helpers_1.addKeyValue)(doc, "Streak Days", lu.streakDays);
  doc.moveDown(0.3);
  // Subject breakdown
  const luSubjects = Object.entries(lu.subjectBreakdown);
  if (luSubjects.length > 0) {
    doc
      .fontSize(11)
      .font(pdf_helpers_1.FONTS.heading)
      .fillColor(pdf_helpers_1.COLORS.text)
      .text("Subject Breakdown");
    doc.moveDown(0.2);
    (0, pdf_helpers_1.addSimpleTable)(
      doc,
      ["Subject", "Avg Completion", "Spaces"],
      luSubjects.map(([subject, b]) => [subject, `${Math.round(b.avgCompletion)}%`, b.spaceCount]),
      [200, 147, 148]
    );
  }
  doc.moveDown(0.5);
  // ── Strengths & Weaknesses ─────────────────────────────────────────
  (0, pdf_helpers_1.drawHorizontalLine)(doc);
  doc.moveDown(0.5);
  (0, pdf_helpers_1.addSectionTitle)(doc, "Strengths & Areas for Improvement");
  if (summary.strengthAreas.length > 0) {
    doc
      .fontSize(10)
      .font(pdf_helpers_1.FONTS.heading)
      .fillColor(pdf_helpers_1.COLORS.accent)
      .text("Strengths:");
    summary.strengthAreas.forEach((area) => {
      doc
        .fontSize(10)
        .font(pdf_helpers_1.FONTS.body)
        .fillColor(pdf_helpers_1.COLORS.text)
        .text(`  • ${area}`);
    });
    doc.moveDown(0.3);
  }
  if (summary.weaknessAreas.length > 0) {
    doc
      .fontSize(10)
      .font(pdf_helpers_1.FONTS.heading)
      .fillColor(pdf_helpers_1.COLORS.warning)
      .text("Areas for Improvement:");
    summary.weaknessAreas.forEach((area) => {
      doc
        .fontSize(10)
        .font(pdf_helpers_1.FONTS.body)
        .fillColor(pdf_helpers_1.COLORS.text)
        .text(`  • ${area}`);
    });
  }
  if (summary.isAtRisk && summary.atRiskReasons.length > 0) {
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font(pdf_helpers_1.FONTS.heading)
      .fillColor(pdf_helpers_1.COLORS.danger)
      .text("At-Risk Flags:");
    summary.atRiskReasons.forEach((reason) => {
      doc
        .fontSize(10)
        .font(pdf_helpers_1.FONTS.body)
        .fillColor(pdf_helpers_1.COLORS.text)
        .text(`  • ${reason}`);
    });
  }
  (0, pdf_helpers_1.addFooter)(doc, `LevelUp — Progress Report — ${studentName}`);
  const buffer = await (0, pdf_helpers_1.pdfToBuffer)(doc);
  const fileName = `progress-report-${Date.now()}.pdf`;
  return uploadAndGetUrl(data.tenantId, `progress/${data.studentId}`, fileName, buffer);
}
// ═══════════════════════════════════════════════════════════════════════════
// type: 'class'
// ═══════════════════════════════════════════════════════════════════════════
async function handleClassReportPdf(data) {
  if (!data.classId) {
    throw new https_1.HttpsError("invalid-argument", 'classId is required for type "class".');
  }
  const db = admin.firestore();
  // Fetch class progress summary
  const classSummarySnap = await db
    .doc(`tenants/${data.tenantId}/classProgressSummaries/${data.classId}`)
    .get();
  let classSummary = null;
  if (classSummarySnap.exists) {
    const csResult = legacy_docs_1.ClassProgressSummarySchema.safeParse({
      id: classSummarySnap.id,
      ...classSummarySnap.data(),
    });
    if (!csResult.success) {
      v2_1.logger.error("Invalid ClassProgressSummary document", {
        docId: classSummarySnap.id,
        errors: csResult.error.flatten(),
      });
    } else {
      classSummary = csResult.data;
    }
  }
  // Fetch class info
  const classSnap = await db.doc(`tenants/${data.tenantId}/classes/${data.classId}`).get();
  const classData = classSnap.exists ? classSnap.data() : {};
  const className = classData.name || classSummary?.className || data.classId;
  // Fetch all student memberships in this class
  const membershipsSnap = await db
    .collection("userMemberships")
    .where("tenantId", "==", data.tenantId)
    .where("role", "==", "student")
    .where("classIds", "array-contains", data.classId)
    .get();
  const studentIds = membershipsSnap.docs.map((d) => d.data().uid);
  const studentNames = new Map(
    membershipsSnap.docs.map((d) => {
      const m = d.data();
      return [m.uid, `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || m.uid.slice(0, 8)];
    })
  );
  // Fetch student progress summaries in batches of 30
  const studentSummaries = [];
  for (let i = 0; i < studentIds.length; i += 30) {
    const batch = studentIds.slice(i, i + 30);
    const snaps = await Promise.all(
      batch.map((id) => db.doc(`tenants/${data.tenantId}/studentProgressSummaries/${id}`).get())
    );
    snaps.forEach((snap) => {
      if (snap.exists) {
        const r = legacy_docs_1.StudentProgressSummarySchema.safeParse({
          id: snap.id,
          ...snap.data(),
        });
        if (r.success) {
          studentSummaries.push(r.data);
        } else {
          v2_1.logger.error("Invalid StudentProgressSummary document", {
            docId: snap.id,
            errors: r.error.flatten(),
          });
        }
      }
    });
  }
  // Build PDF
  const doc = (0, pdf_helpers_1.createPdfDocument)();
  (0, pdf_helpers_1.addHeader)(doc, "Class Report Card", className);
  // ── Class Overview ─────────────────────────────────────────────────
  (0, pdf_helpers_1.addSectionTitle)(doc, "Class Overview");
  (0, pdf_helpers_1.addKeyValue)(doc, "Class", className);
  (0, pdf_helpers_1.addKeyValue)(doc, "Total Students", studentIds.length);
  if (classSummary) {
    (0, pdf_helpers_1.addKeyValue)(
      doc,
      "Avg Exam Score",
      `${Math.round(classSummary.autograde.averageClassScore * 100)}%`
    );
    (0, pdf_helpers_1.addKeyValue)(
      doc,
      "Exam Completion Rate",
      `${Math.round(classSummary.autograde.examCompletionRate * 100)}%`
    );
    (0, pdf_helpers_1.addKeyValue)(
      doc,
      "Avg Space Completion",
      `${Math.round(classSummary.levelup.averageClassCompletion)}%`
    );
    (0, pdf_helpers_1.addKeyValue)(
      doc,
      "Active Student Rate",
      `${Math.round(classSummary.levelup.activeStudentRate * 100)}%`
    );
    (0, pdf_helpers_1.addKeyValue)(doc, "At-Risk Students", classSummary.atRiskCount);
  }
  doc.moveDown(0.5);
  // ── Student Roster with Scores ─────────────────────────────────────
  (0, pdf_helpers_1.addSectionTitle)(doc, "Student Performance Roster");
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
    (0, pdf_helpers_1.addSimpleTable)(doc, rosterHeaders, rosterRows, [160, 80, 80, 80, 95]);
  } else {
    doc
      .fontSize(10)
      .font(pdf_helpers_1.FONTS.body)
      .fillColor(pdf_helpers_1.COLORS.muted)
      .text("No student progress data available yet.");
  }
  doc.moveDown(0.5);
  // ── AutoGrade Section ──────────────────────────────────────────────
  (0, pdf_helpers_1.addSectionTitle)(doc, "AutoGrade — Exam Averages");
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
    (0, pdf_helpers_1.addSimpleTable)(
      doc,
      ["Name", "Exams", "Total Marks", "Avg %"],
      agRows,
      [180, 70, 130, 115]
    );
  } else {
    doc
      .fontSize(10)
      .font(pdf_helpers_1.FONTS.body)
      .fillColor(pdf_helpers_1.COLORS.muted)
      .text("No exam data available.");
  }
  doc.moveDown(0.5);
  // ── LevelUp Section ────────────────────────────────────────────────
  (0, pdf_helpers_1.addSectionTitle)(doc, "LevelUp — Space Completion");
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
    (0, pdf_helpers_1.addSimpleTable)(
      doc,
      ["Name", "Spaces", "Points", "Completion"],
      luRows,
      [180, 100, 100, 115]
    );
  } else {
    doc
      .fontSize(10)
      .font(pdf_helpers_1.FONTS.body)
      .fillColor(pdf_helpers_1.COLORS.muted)
      .text("No learning data available.");
  }
  doc.moveDown(0.5);
  // ── At-Risk Students ───────────────────────────────────────────────
  const atRiskStudents = studentSummaries.filter((s) => s.isAtRisk);
  if (atRiskStudents.length > 0) {
    (0, pdf_helpers_1.drawHorizontalLine)(doc);
    doc.moveDown(0.5);
    (0, pdf_helpers_1.addSectionTitle)(doc, "At-Risk Students");
    atRiskStudents.forEach((s) => {
      const name = studentNames.get(s.studentId) || s.studentId.slice(0, 10);
      doc
        .fontSize(10)
        .font(pdf_helpers_1.FONTS.heading)
        .fillColor(pdf_helpers_1.COLORS.danger)
        .text(`${name}:`, { continued: true })
        .font(pdf_helpers_1.FONTS.body)
        .fillColor(pdf_helpers_1.COLORS.text)
        .text(` ${s.atRiskReasons.join(", ")}`);
    });
  }
  (0, pdf_helpers_1.addFooter)(doc, `LevelUp — Class Report — ${className}`);
  const buffer = await (0, pdf_helpers_1.pdfToBuffer)(doc);
  const fileName = `class-report-${Date.now()}.pdf`;
  return uploadAndGetUrl(data.tenantId, `classes/${data.classId}`, fileName, buffer);
}
//# sourceMappingURL=generate-report.js.map
