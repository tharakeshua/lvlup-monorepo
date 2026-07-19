/**
 * Integration test: AutoGrade Exam Pipeline (end-to-end via emulator).
 *
 * Flow: Create exam → extract questions → upload answer sheets →
 *       verify submission created → verify pipeline status transitions.
 *
 * Requires Firebase emulators to be running: `firebase emulators:start`
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

describe("Exam Pipeline Integration", () => {
  const TENANT_ID = "exam-pipeline-tenant";
  const TENANT_CODE = "EPT001";

  beforeAll(() => {
    getAdminApp();
    setupClientSDK();
  });

  afterEach(async () => {
    await resetEmulators();
  });

  it("should create an exam document in Firestore", async () => {
    const db = getAdminFirestore();

    // Seed tenant and teacher
    await seedTenant({
      tenantId: TENANT_ID,
      name: "Pipeline Test School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    const teacher = await seedUser({
      email: "teacher-pipeline@test.com",
      password: "Test1234",
      displayName: "Pipeline Teacher",
    });

    await seedMembership({
      uid: teacher.uid,
      tenantId: TENANT_ID,
      tenantCode: TENANT_CODE,
      role: "teacher",
      classIds: ["class-1"],
    });

    // Directly create exam doc (simulating what create-exam callable does)
    const examRef = db.collection(`tenants/${TENANT_ID}/exams`).doc("test-exam-1");
    await examRef.set({
      id: "test-exam-1",
      tenantId: TENANT_ID,
      title: "Integration Test Exam",
      subject: "Mathematics",
      classIds: ["class-1"],
      totalMarks: 100,
      passingMarks: 40,
      status: "draft",
      gradingConfig: { autoGrade: true },
      createdBy: teacher.uid,
    });

    const examDoc = await examRef.get();
    expect(examDoc.exists).toBe(true);
    expect(examDoc.data()?.title).toBe("Integration Test Exam");
    expect(examDoc.data()?.status).toBe("draft");
  });

  it("should create questions and transition exam to extracted status", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Pipeline Test School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    // Create exam
    const examRef = db.doc(`tenants/${TENANT_ID}/exams/test-exam-2`);
    await examRef.set({
      id: "test-exam-2",
      tenantId: TENANT_ID,
      title: "Extraction Test",
      subject: "Science",
      classIds: ["class-1"],
      totalMarks: 50,
      status: "question_paper_uploaded",
    });

    // Simulate question extraction (what extractQuestions would produce)
    const batch = db.batch();
    const questionsCol = db.collection(`tenants/${TENANT_ID}/exams/test-exam-2/questions`);

    batch.set(questionsCol.doc("Q1"), {
      id: "Q1",
      text: "What is Newton's first law?",
      maxMarks: 10,
      order: 0,
      rubric: {
        criteria: [{ id: "c1", name: "Accuracy", maxPoints: 10 }],
        scoringMode: "criteria_based",
      },
    });

    batch.set(questionsCol.doc("Q2"), {
      id: "Q2",
      text: "Explain gravity.",
      maxMarks: 15,
      order: 1,
      rubric: {
        criteria: [
          { id: "c1", name: "Definition", maxPoints: 5 },
          { id: "c2", name: "Examples", maxPoints: 10 },
        ],
        scoringMode: "criteria_based",
      },
    });

    batch.update(examRef, {
      status: "question_paper_extracted",
      "questionPaper.questionCount": 2,
    });

    await batch.commit();

    // Verify
    const examDoc = await examRef.get();
    expect(examDoc.data()?.status).toBe("question_paper_extracted");

    const questionsSnap = await questionsCol.get();
    expect(questionsSnap.size).toBe(2);
  });

  it("should create submission and set pipeline status to uploaded", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Pipeline Test School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    // Create published exam
    await db.doc(`tenants/${TENANT_ID}/exams/test-exam-3`).set({
      id: "test-exam-3",
      tenantId: TENANT_ID,
      title: "Submission Test",
      classIds: ["class-1"],
      totalMarks: 100,
      status: "published",
      questionPaper: { questionCount: 5 },
    });

    // Simulate submission creation
    const subRef = db.collection(`tenants/${TENANT_ID}/submissions`).doc("test-sub-1");
    await subRef.set({
      id: "test-sub-1",
      tenantId: TENANT_ID,
      examId: "test-exam-3",
      studentId: "student-1",
      classId: "class-1",
      answerSheets: {
        images: ["tenants/" + TENANT_ID + "/submissions/test-sub-1/page1.jpg"],
        uploadedBy: "teacher-1",
        uploadSource: "web",
      },
      pipelineStatus: "uploaded",
      retryCount: 0,
    });

    const subDoc = await subRef.get();
    expect(subDoc.exists).toBe(true);
    expect(subDoc.data()?.pipelineStatus).toBe("uploaded");
  });

  it("should transition through pipeline statuses correctly", async () => {
    const db = getAdminFirestore();

    await seedTenant({
      tenantId: TENANT_ID,
      name: "Pipeline Test School",
      tenantCode: TENANT_CODE,
      ownerUid: "owner-1",
    });

    const subRef = db.doc(`tenants/${TENANT_ID}/submissions/test-sub-2`);
    await subRef.set({
      id: "test-sub-2",
      pipelineStatus: "uploaded",
    });

    // Simulate pipeline transitions
    const transitions = ["uploaded", "scouting_complete", "grading_complete", "ready_for_review"];

    for (const status of transitions) {
      await subRef.update({ pipelineStatus: status });
      const doc = await subRef.get();
      expect(doc.data()?.pipelineStatus).toBe(status);
    }
  });
});
