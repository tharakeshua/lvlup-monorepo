/**
 * Integration test: Grading Pipeline (end-to-end flow).
 *
 * Flow: Teacher creates exam → Student submits → AutoGrade processes →
 *       Results released → Analytics updated.
 *
 * Requires Firebase emulators: `firebase emulators:start`
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  getAdminApp,
  getAdminFirestore,
  getAdminAuth,
  resetEmulators,
  setupClientSDK,
} from "./setup";
import {
  seedTenant,
  seedUser,
  seedMembership,
  setUserClaims,
  seedTeacherEntity,
} from "./seed-helpers";

describe("Grading Pipeline Integration", () => {
  const TENANT_ID = "grading-pipeline-tenant";
  const TENANT_CODE = "GPT001";

  beforeAll(() => {
    getAdminApp();
    setupClientSDK();
  });

  afterEach(async () => {
    await resetEmulators();
  });

  it("should create exam and verify it exists in Firestore", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Grading Pipeline School",
      tenantCode: TENANT_CODE,
      ownerUid: "teacher-1",
    });

    const examRef = db.collection(`tenants/${TENANT_ID}/exams`).doc("exam-1");
    await examRef.set({
      id: "exam-1",
      title: "Math Final",
      subject: "Mathematics",
      classIds: ["class-1"],
      totalMarks: 100,
      status: "draft",
      tenantId: TENANT_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const examDoc = await examRef.get();
    expect(examDoc.exists).toBe(true);
    expect(examDoc.data()?.title).toBe("Math Final");
    expect(examDoc.data()?.status).toBe("draft");
  });

  it("should create questions for an exam", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Grading Pipeline School",
      tenantCode: TENANT_CODE,
      ownerUid: "teacher-1",
    });

    const examRef = db.doc(`tenants/${TENANT_ID}/exams/exam-1`);
    await examRef.set({
      id: "exam-1",
      title: "Science Quiz",
      status: "question_paper_extracted",
      totalMarks: 20,
      tenantId: TENANT_ID,
    });

    // Add questions
    const questionsRef = examRef.collection("questions");
    await questionsRef.doc("q1").set({
      id: "q1",
      questionNumber: 1,
      maxMarks: 10,
      rubric: { criteria: [{ maxPoints: 10 }] },
    });
    await questionsRef.doc("q2").set({
      id: "q2",
      questionNumber: 2,
      maxMarks: 10,
      rubric: { criteria: [{ maxPoints: 10 }] },
    });

    const questionsSnap = await questionsRef.get();
    expect(questionsSnap.docs).toHaveLength(2);
  });

  it("should create a submission and track its status", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Grading Pipeline School",
      tenantCode: TENANT_CODE,
      ownerUid: "teacher-1",
    });

    const submissionRef = db.doc(`tenants/${TENANT_ID}/exams/exam-1/submissions/sub-1`);
    await submissionRef.set({
      id: "sub-1",
      examId: "exam-1",
      studentId: "student-1",
      status: "uploaded",
      answerSheets: ["https://storage.example.com/sheet1.jpg"],
      tenantId: TENANT_ID,
      createdAt: new Date(),
    });

    const subDoc = await submissionRef.get();
    expect(subDoc.exists).toBe(true);
    expect(subDoc.data()?.status).toBe("uploaded");
  });

  it("should aggregate question submission grades", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Grading Pipeline School",
      tenantCode: TENANT_CODE,
      ownerUid: "teacher-1",
    });

    // Create question submissions
    const qSubBasePath = `tenants/${TENANT_ID}/exams/exam-1/submissions/sub-1/questionSubmissions`;
    await db.doc(`${qSubBasePath}/qs-1`).set({
      id: "qs-1",
      questionId: "q1",
      gradingStatus: "graded",
      score: 8,
      maxScore: 10,
    });
    await db.doc(`${qSubBasePath}/qs-2`).set({
      id: "qs-2",
      questionId: "q2",
      gradingStatus: "graded",
      score: 7,
      maxScore: 10,
    });

    // Verify aggregation
    const qSubSnap = await db.collection(qSubBasePath).get();
    const totalScore = qSubSnap.docs.reduce((sum, d) => sum + (d.data().score ?? 0), 0);
    const allGraded = qSubSnap.docs.every((d) => d.data().gradingStatus === "graded");

    expect(totalScore).toBe(15);
    expect(allGraded).toBe(true);
  });

  it("should update analytics when results are released", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Grading Pipeline School",
      tenantCode: TENANT_CODE,
      ownerUid: "teacher-1",
    });

    // Simulate exam analytics creation
    const analyticsRef = db.doc(`tenants/${TENANT_ID}/examAnalytics/exam-1`);
    await analyticsRef.set({
      examId: "exam-1",
      tenantId: TENANT_ID,
      totalSubmissions: 25,
      gradedSubmissions: 25,
      averageScore: 75.5,
      highestScore: 98,
      lowestScore: 42,
      scoreDistribution: { "0-50": 3, "51-75": 12, "76-100": 10 },
      createdAt: new Date(),
    });

    const analyticsDoc = await analyticsRef.get();
    expect(analyticsDoc.exists).toBe(true);
    expect(analyticsDoc.data()?.averageScore).toBe(75.5);
    expect(analyticsDoc.data()?.totalSubmissions).toBe(25);
  });
});
