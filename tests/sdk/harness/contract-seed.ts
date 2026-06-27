/**
 * Contract-tenant seeder for the wire-path integration suite.
 *
 * The `@levelup/seed` engine writes its demo tenants (demo/greenwood/…) under the
 * engine's `seedId()` id scheme. The wire-path integration tests, however, address
 * a dedicated **contract tenant** by the harness `localSeedId()` scheme (a distinct,
 * deterministic id derivation) — `localSeedId('tenant','contract')`,
 * `localSeedId('space','dsa')`, etc. Those entities are NOT produced by the engine
 * seed, so this helper materializes exactly the contract-tenant fixtures the
 * integration suite reads, via the Admin SDK, at the SAME Firestore paths the
 * services/`repo-admin` use. It runs once in globalSetup AFTER the engine seed.
 *
 * Ids/claims are kept consistent with `harness/auth-context.ts` (same `localSeedId`
 * + `DEMO_USER_KEYS`), so a signed-in caller's claims point at the entities written
 * here. Idempotent (set-with-merge by stable id).
 */
import { adminDb, adminAuth } from "./emulator";
import {
  CONTRACT_TENANT_KEY,
  CONTRACT_TENANT_CODE,
  DEMO_USER_KEYS,
  localSeedId,
} from "./fixtures-ids";
import { buildClaimsForRole, type Role } from "./auth-context";

const TENANT = localSeedId("tenant", CONTRACT_TENANT_KEY);
const uid = (role: keyof typeof DEMO_USER_KEYS) => localSeedId("uid", DEMO_USER_KEYS[role]);

const SPACE_DSA = localSeedId("space", "dsa"); // draft, publish-ready
const SPACE_PUB = localSeedId("space", "published");
const SP_ARRAYS = localSeedId("sp", "arrays");
const ITEM_Q1 = localSeedId("item", "arrays.q1");
const CLASS_10A = localSeedId("class", "10a");
const STUDENT_SAM = localSeedId("student", "sam");
const STUDENT_NORA = localSeedId("student", "nora");
const EXAM_MID = localSeedId("exam", "midterm");
const EXAMQ_1 = localSeedId("examq", "1");
const SUB_S1 = localSeedId("submission", "s1");
const SESSION_2026 = localSeedId("session", "2026");
const INSIGHT_I1 = localSeedId("insight", "i1");
const SESSION_TS1 = localSeedId("session", "ts1");

// ── DEDICATED spaces for the lifecycle-transition suite (full cross-file isolation) ──
// `save-space-transition-enforcement.test.ts` mutates spaces (publish/archive) as part
// of asserting the transition table. If it touched the SHARED 'published'/'dsa' spaces
// it would poison the projection-reader suites (`list-get-space-projections`). So it
// owns these two private spaces NO other file ever reads: a publish-ready DRAFT and an
// already-PUBLISHED space, mirroring the shapes of SPACE_DSA / SPACE_PUB.
const SPACE_TRANSITION_DRAFT = localSeedId("space", "transition.draft");
const SPACE_TRANSITION_PUB = localSeedId("space", "transition.pub");
const SP_TRANSITION = localSeedId("sp", "transition");
const ITEM_TRANSITION = localSeedId("item", "transition.q1");

// ── DEDICATED exam + submissions for the released-gating suite (full isolation) ──
// `released-gating.test.ts` calls `releaseResults` (flips the gate) and asserts the
// pre-release stripped projections. If it shared EXAM_MID/SUB_S1 with the other
// autograde suites (which also release / re-grade them, plus async analytics triggers
// that fire on release), full-suite ordering left those docs released / re-owned and
// the pre-release assertions flapped. These private ids are released/read by this one
// file only.
const EXAM_RG = localSeedId("exam", "rg");
const EXAMQ_RG = localSeedId("examq", "rg");
const SUB_RG = localSeedId("submission", "rg");
const SUB_RG_LOCKED = `${SUB_RG}_locked`;
const EXAM_RG_LOCKED = `${EXAM_RG}_locked`;

// The TEST fixtures (`IDS.student`) derive entity ids from the SHORT key
// (`'sam'`), but the signed-in CLAIMS (`auth-context.buildClaimsForRole`) derive
// `ctx.entityIds.studentId` from the FULL `DEMO_USER_KEYS` key (`'student.sam'`).
// The two id forms differ, so services keyed on `ctx.entityIds.*` look up the
// CLAIM form while tests reference the SHORT form. We materialize BOTH so either
// resolves (and key the analytics summaries on the claim form `ctx` reads).
const STUDENT_SAM_CLAIM = localSeedId("student", DEMO_USER_KEYS.student);
const TEACHER_CLAIM = localSeedId("teacher", DEMO_USER_KEYS.teacher);
const PARENT_CLAIM = localSeedId("parent", DEMO_USER_KEYS.parent);

/** True when the contract tenant doc already exists (cheap presence probe). */
export async function contractTenantExists(): Promise<boolean> {
  try {
    const snap = await adminDb().doc(`tenants/${TENANT}`).get();
    return snap.exists;
  } catch {
    return false;
  }
}

/** Seed the contract tenant + its referenced entities. Idempotent. */
export async function seedContractTenant(): Promise<void> {
  const db = adminDb();
  const now = "2026-01-01T00:00:00.000Z";
  const SYS = uid("tenantAdmin"); // audit actor for seeded docs (a real UserId)
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  const put = (path: string, data: Record<string, unknown>) =>
    writes.push({
      path,
      data: {
        tenantId: TENANT,
        createdAt: now,
        updatedAt: now,
        createdBy: SYS,
        updatedBy: SYS,
        ...data,
      },
    });

  // ── tenant (top-level) + code index ── (shape mirrors domain TenantSchema)
  writes.push({
    path: `tenants/${TENANT}`,
    data: {
      id: TENANT,
      name: "Contract Academy",
      slug: "contract-academy",
      tenantCode: CONTRACT_TENANT_CODE,
      ownerUid: uid("tenantAdmin"),
      status: "active",
      subscription: { plan: "premium", renewsAt: null },
      features: { autograde: true, levelup: true, analytics: true, store: true },
      settings: { timezone: "Asia/Kolkata", locale: "en" },
      stats: { totalStudents: 2, totalTeachers: 1, totalClasses: 1, totalExams: 1, totalSpaces: 2 },
      trialEndsAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: uid("tenantAdmin"),
      updatedBy: uid("tenantAdmin"),
    },
  });
  // TenantCodeIndex per domain: { tenantId, createdAt }.
  writes.push({
    path: `tenantCodes/${CONTRACT_TENANT_CODE}`,
    data: { tenantId: TENANT, createdAt: now },
  });

  // ── auth-user directory + memberships (top-level) ──
  const roleEntity: Record<string, { kind: string; entityId?: string }> = {
    tenantAdmin: { kind: "tenantAdmin" },
    teacher: { kind: "teacher", entityId: localSeedId("teacher", DEMO_USER_KEYS.teacher) },
    student: { kind: "student", entityId: STUDENT_SAM },
    studentOther: { kind: "student", entityId: STUDENT_NORA },
    parent: { kind: "parent", entityId: localSeedId("parent", DEMO_USER_KEYS.parent) },
    staff: { kind: "staff", entityId: localSeedId("staff", DEMO_USER_KEYS.staff) },
    scanner: { kind: "scanner", entityId: localSeedId("scanner", DEMO_USER_KEYS.scanner) },
  };
  // map our `roleEntity.kind` → the membership entity-link field name (UserMembership).
  const ENTITY_LINK_FIELD: Record<string, string> = {
    teacher: "teacherId",
    student: "studentId",
    parent: "parentId",
    staff: "staffId",
    scanner: "scannerId",
  };
  for (const [role, info] of Object.entries(roleEntity)) {
    const u = uid(role as keyof typeof DEMO_USER_KEYS);
    // UnifiedUser shape (uid not id; authProviders[]; isSuperAdmin; status; audit).
    writes.push({
      path: `users/${u}`,
      data: {
        uid: u,
        email: `${DEMO_USER_KEYS[role as keyof typeof DEMO_USER_KEYS]}@contract.test`,
        displayName: role,
        authProviders: ["email"],
        isSuperAdmin: false,
        status: "active",
        activeTenantId: TENANT,
        lastLogin: null,
        createdAt: now,
        updatedAt: now,
        createdBy: u,
        updatedBy: u,
      },
    });
    const linkField = ENTITY_LINK_FIELD[info.kind];
    writes.push({
      path: `userMemberships/${u}_${TENANT}`,
      data: {
        id: `${u}_${TENANT}`,
        uid: u,
        tenantId: TENANT,
        role: info.kind,
        status: "active",
        joinSource: "admin_created",
        tenantCode: CONTRACT_TENANT_CODE,
        ...(role === "teacher" || role === "scanner"
          ? { permissions: { managedClassIds: [CLASS_10A] } }
          : {}),
        ...(linkField && info.entityId ? { [linkField]: info.entityId } : {}),
        ...(role === "parent" ? { parentLinkedStudentIds: [STUDENT_SAM, STUDENT_SAM_CLAIM] } : {}),
        lastActive: null,
        createdAt: now,
        updatedAt: now,
        createdBy: u,
        updatedBy: u,
      },
    });
  }

  // ── classes / students / teachers / sessions ──
  put(`tenants/${TENANT}/classes/${CLASS_10A}`, {
    id: CLASS_10A,
    name: "Class 10A",
    grade: "10",
    section: "A",
    studentIds: [STUDENT_SAM, STUDENT_SAM_CLAIM],
    studentCount: 2,
    teacherIds: [TEACHER_CLAIM],
    academicSessionId: SESSION_2026,
    status: "active",
  });
  // student 'sam' under BOTH the short (test) and claim (ctx.entityIds) id forms.
  for (const sid of [STUDENT_SAM, STUDENT_SAM_CLAIM]) {
    put(`tenants/${TENANT}/students/${sid}`, {
      id: sid,
      firstName: "Sam",
      lastName: "Stone",
      rollNumber: "R-001",
      classIds: [CLASS_10A],
      status: "active",
    });
  }
  put(`tenants/${TENANT}/students/${STUDENT_NORA}`, {
    id: STUDENT_NORA,
    firstName: "Nora",
    lastName: "North",
    rollNumber: "R-002",
    classIds: [CLASS_10A],
    status: "active",
  });
  put(`tenants/${TENANT}/teachers/${TEACHER_CLAIM}`, {
    id: TEACHER_CLAIM,
    firstName: "Alice",
    lastName: "Ng",
    classIds: [CLASS_10A],
    status: "active",
  });
  put(`tenants/${TENANT}/academicSessions/${SESSION_2026}`, {
    id: SESSION_2026,
    label: "2025-2026",
    isActive: true,
  });

  // ── spaces (draft 'dsa' is publish-ready; 'published') ──
  put(`tenants/${TENANT}/spaces/${SPACE_DSA}`, {
    id: SPACE_DSA,
    title: "Data Structures",
    type: "learning",
    status: "draft",
    accessType: "class_assigned",
    classIds: [CLASS_10A],
    teacherIds: [uid("teacher")],
    createdBy: uid("teacher"),
    updatedBy: uid("teacher"),
    stats: { storyPointCount: 1, itemCount: 1, enrolledCount: 1, completionCount: 0 },
    publishedAt: null,
    archivedAt: null,
  });
  put(`tenants/${TENANT}/spaces/${SPACE_PUB}`, {
    id: SPACE_PUB,
    title: "Published Space",
    type: "learning",
    status: "published",
    accessType: "public_store",
    classIds: [CLASS_10A],
    teacherIds: [uid("teacher")],
    createdBy: uid("teacher"),
    updatedBy: uid("teacher"),
    price: { amountMinor: 0, currency: "INR" },
    publishedToStore: true,
    stats: { storyPointCount: 1, itemCount: 1, enrolledCount: 1, completionCount: 0 },
    publishedAt: now,
    archivedAt: null,
  });

  // ── DEDICATED transition spaces (mirror DSA-draft / PUB shapes) ──
  // A publish-ready draft (≥1 storyPoint + ≥1 item) owned by the transition suite only.
  put(`tenants/${TENANT}/spaces/${SPACE_TRANSITION_DRAFT}`, {
    id: SPACE_TRANSITION_DRAFT,
    title: "Transition Draft",
    type: "learning",
    status: "draft",
    accessType: "class_assigned",
    classIds: [CLASS_10A],
    teacherIds: [uid("teacher")],
    createdBy: uid("teacher"),
    updatedBy: uid("teacher"),
    stats: { storyPointCount: 1, itemCount: 1, enrolledCount: 1, completionCount: 0 },
    publishedAt: null,
    archivedAt: null,
  });
  put(`tenants/${TENANT}/spaces/${SPACE_TRANSITION_PUB}`, {
    id: SPACE_TRANSITION_PUB,
    title: "Transition Published",
    type: "learning",
    status: "published",
    accessType: "public_store",
    classIds: [CLASS_10A],
    teacherIds: [uid("teacher")],
    createdBy: uid("teacher"),
    updatedBy: uid("teacher"),
    price: { amountMinor: 0, currency: "INR" },
    publishedToStore: true,
    stats: { storyPointCount: 1, itemCount: 1, enrolledCount: 1, completionCount: 0 },
    publishedAt: now,
    archivedAt: null,
  });
  // story point + item under the transition DRAFT so its publish-readiness check passes
  // (saveSpace publish validates ≥1 storyPoint via the FLAT storyPoints mirror).
  put(`tenants/${TENANT}/spaces/${SPACE_TRANSITION_DRAFT}/storyPoints/${SP_TRANSITION}`, {
    id: SP_TRANSITION,
    spaceId: SPACE_TRANSITION_DRAFT,
    title: "Transition SP",
    type: "practice",
    orderIndex: 0,
  });
  put(`tenants/${TENANT}/storyPoints/${SP_TRANSITION}`, {
    id: SP_TRANSITION,
    spaceId: SPACE_TRANSITION_DRAFT,
    title: "Transition SP",
    type: "practice",
    orderIndex: 0,
  });
  put(
    `tenants/${TENANT}/spaces/${SPACE_TRANSITION_DRAFT}/storyPoints/${SP_TRANSITION}/items/${ITEM_TRANSITION}`,
    {
      id: ITEM_TRANSITION,
      spaceId: SPACE_TRANSITION_DRAFT,
      storyPointId: SP_TRANSITION,
      type: "question",
      content: "Transition question.",
      payload: {
        type: "question",
        basePoints: 10,
        questionData: { questionType: "text", maxLength: 500 },
      },
      orderIndex: 0,
      archivedAt: null,
    }
  );

  // ── story point + item (+ deny-all answer key subcollection) ──
  put(`tenants/${TENANT}/spaces/${SPACE_DSA}/storyPoints/${SP_ARRAYS}`, {
    id: SP_ARRAYS,
    spaceId: SPACE_DSA,
    title: "Arrays",
    type: "practice",
    orderIndex: 0,
  });
  // Top-level storyPoints mirror — the storyPoints repo (`entity('storyPoints')`)
  // reads the FLAT `tenants/{t}/storyPoints` collection (id-keyed, `spaceId`-tagged),
  // which is what `saveSpace` publish-readiness (`storyPoints.list(where spaceId)`)
  // queries. The seed writes BOTH the nested doc (item-tree reads) and this mirror.
  put(`tenants/${TENANT}/storyPoints/${SP_ARRAYS}`, {
    id: SP_ARRAYS,
    spaceId: SPACE_DSA,
    title: "Arrays",
    type: "practice",
    orderIndex: 0,
  });
  put(`tenants/${TENANT}/spaces/${SPACE_DSA}/storyPoints/${SP_ARRAYS}/items/${ITEM_Q1}`, {
    id: ITEM_Q1,
    spaceId: SPACE_DSA,
    storyPointId: SP_ARRAYS,
    type: "question",
    content: "Define an array.",
    // Canonical two-level item payload: top-level `type`, nested `questionData`.
    payload: {
      type: "question",
      basePoints: 10,
      questionData: { questionType: "text", maxLength: 500 },
    },
    orderIndex: 0,
    archivedAt: null,
  });
  // AnswerKey is NOT audit-stamped (no tenantId/createdBy/updatedBy) — write raw so
  // getItemForEdit's re-merged `answerKey` validates against AnswerKeySchema.
  writes.push({
    path: `tenants/${TENANT}/spaces/${SPACE_DSA}/storyPoints/${SP_ARRAYS}/items/${ITEM_Q1}/answerKeys/${ITEM_Q1}`,
    data: {
      id: ITEM_Q1,
      itemId: ITEM_Q1,
      questionType: "text",
      correctAnswer: "A contiguous block of memory",
      acceptableAnswers: ["contiguous memory"],
      evaluationGuidance: "Accept any phrasing of contiguous memory.",
      modelAnswer: "A contiguous block of memory.",
      createdAt: now,
      updatedAt: now,
    },
  });

  // ── exam + question + graded-but-unreleased submission ──
  put(`tenants/${TENANT}/exams/${EXAM_MID}`, {
    id: EXAM_MID,
    title: "Midterm",
    subject: "Mathematics",
    topics: ["algebra"],
    status: "grading",
    classIds: [CLASS_10A],
    examDate: now,
    duration: 60,
    totalMarks: 10,
    passingMarks: 4,
    createdBy: uid("teacher"),
    resultsReleased: false,
  });
  put(`tenants/${TENANT}/exams/${EXAM_MID}/questions/${EXAMQ_1}`, {
    id: EXAMQ_1,
    examId: EXAM_MID,
    prompt: "Explain Big-O.",
    maxScore: 10,
    rubric: {
      criteria: [
        {
          id: "c1",
          label: "Clarity",
          evaluatorGuidance: "secret guidance",
          modelAnswer: "secret model",
        },
      ],
    },
  });
  put(`tenants/${TENANT}/submissions/${SUB_S1}`, {
    // studentId is the CLAIM form so the owning-student gate (`sub.studentId ===
    // ctx.entityIds.studentId`) matches the signed-in student's claim.
    id: SUB_S1,
    examId: EXAM_MID,
    studentId: STUDENT_SAM_CLAIM,
    studentName: "Sam Stone",
    rollNumber: "R-001",
    classId: CLASS_10A,
    uploadedBy: uid("scanner"),
    answerSheets: {
      images: ["gs://demo/contract/s1.jpg"],
      uploadedAt: now,
      uploadedBy: uid("scanner"),
      uploadSource: "scanner",
    },
    // 'grading_complete' is a RELEASABLE pipeline status (graded-but-unreleased);
    // the prior 'graded' value is a question-grading status, not a submission
    // pipeline status, so releaseResults could never release it.
    pipelineStatus: "grading_complete",
    resultsReleased: false,
    resultsReleasedAt: null,
    summary: {
      totalScore: 8,
      maxScore: 10,
      grade: "A",
      percentage: 80,
      questionsGraded: 1,
      totalQuestions: 1,
      completedAt: now,
    },
    totalScore: 8,
    maxScore: 10,
    percentage: 80,
  });
  // questionSubmissions are modeled as FLAT `submissions` docs with a `_kind`
  // discriminator + `submissionId` back-ref (the service's `listQuestionSubmissions`
  // reads them via `submissions.list({where:{submissionId}, filter:_kind})`).
  put(`tenants/${TENANT}/submissions/${SUB_S1}_q_${EXAMQ_1}`, {
    id: `${SUB_S1}_q_${EXAMQ_1}`,
    _kind: "questionSubmission",
    submissionId: SUB_S1,
    questionId: EXAMQ_1,
    score: 8,
    maxScore: 10,
    gradingStatus: "graded",
    evaluation: { score: 8, feedback: "Good", costUsd: 0.002, tokenUsage: 120 },
  });
  // A DEDICATED graded-but-unreleased submission for the pre-release STRIP tests.
  // It belongs to a different exam (EXAM_MID2) that NO other suite ever releases,
  // so the release-gate strip assertions are order-independent of the suites that
  // call releaseResults on EXAM_MID/SUB_S1.
  put(`tenants/${TENANT}/exams/${EXAM_MID}_locked`, {
    id: `${EXAM_MID}_locked`,
    title: "Midterm (locked)",
    status: "grading",
    classIds: [CLASS_10A],
    createdBy: uid("teacher"),
    resultsReleased: false,
  });
  put(`tenants/${TENANT}/submissions/${SUB_S1}_locked`, {
    id: `${SUB_S1}_locked`,
    examId: `${EXAM_MID}_locked`,
    studentId: STUDENT_SAM_CLAIM,
    studentName: "Sam Stone",
    rollNumber: "R-001",
    classId: CLASS_10A,
    uploadedBy: uid("scanner"),
    pipelineStatus: "grading_complete",
    answerSheets: {
      images: ["gs://demo/contract/s1-locked.jpg"],
      uploadedAt: now,
      uploadedBy: uid("scanner"),
      uploadSource: "scanner",
    },
    resultsReleased: false,
    resultsReleasedAt: null,
    summary: {
      totalScore: 8,
      maxScore: 10,
      grade: "A",
      percentage: 80,
      questionsGraded: 1,
      totalQuestions: 1,
      completedAt: now,
    },
    totalScore: 8,
    maxScore: 10,
    percentage: 80,
  });
  put(`tenants/${TENANT}/submissions/${SUB_S1}_locked_q_${EXAMQ_1}`, {
    id: `${SUB_S1}_locked_q_${EXAMQ_1}`,
    _kind: "questionSubmission",
    submissionId: `${SUB_S1}_locked`,
    questionId: EXAMQ_1,
    score: 8,
    maxScore: 10,
    gradingStatus: "graded",
    evaluation: { score: 8, feedback: "Good", costUsd: 0.002, tokenUsage: 120 },
  });

  // ── DEDICATED released-gating exam + submissions (owned by released-gating.test.ts) ──
  // A releasable exam + graded-but-unreleased submission this one suite flips via
  // `releaseResults`, plus a permanently-locked submission for its pre-release strips.
  // No other suite references these ids, so the file is fully order-independent (and
  // its `afterAll` restores them, belt-and-suspenders).
  put(`tenants/${TENANT}/exams/${EXAM_RG}`, {
    id: EXAM_RG,
    title: "Released-Gating Exam",
    subject: "Mathematics",
    topics: ["algebra"],
    status: "grading",
    classIds: [CLASS_10A],
    examDate: now,
    duration: 60,
    totalMarks: 10,
    passingMarks: 4,
    createdBy: uid("teacher"),
    resultsReleased: false,
  });
  put(`tenants/${TENANT}/exams/${EXAM_RG}/questions/${EXAMQ_RG}`, {
    id: EXAMQ_RG,
    examId: EXAM_RG,
    prompt: "Explain Big-O.",
    maxScore: 10,
    rubric: {
      criteria: [
        {
          id: "c1",
          label: "Clarity",
          evaluatorGuidance: "secret guidance",
          modelAnswer: "secret model",
        },
      ],
    },
  });
  put(`tenants/${TENANT}/submissions/${SUB_RG}`, {
    id: SUB_RG,
    examId: EXAM_RG,
    studentId: STUDENT_SAM_CLAIM,
    studentName: "Sam Stone",
    rollNumber: "R-001",
    classId: CLASS_10A,
    uploadedBy: uid("scanner"),
    answerSheets: {
      images: ["gs://demo/contract/rg.jpg"],
      uploadedAt: now,
      uploadedBy: uid("scanner"),
      uploadSource: "scanner",
    },
    // 'ready_for_review' is a TERMINAL, releasable pipeline status — the
    // `onSubmissionUpdated` state-machine trigger has no action for it, so seeding
    // here (and any later reset) never re-fires `finalizeSubmission`, keeping this
    // dedicated fixture free of async-trigger churn.
    pipelineStatus: "ready_for_review",
    resultsReleased: false,
    resultsReleasedAt: null,
    summary: {
      totalScore: 8,
      maxScore: 10,
      grade: "A",
      percentage: 80,
      questionsGraded: 1,
      totalQuestions: 1,
      completedAt: now,
    },
    totalScore: 8,
    maxScore: 10,
    percentage: 80,
  });
  put(`tenants/${TENANT}/submissions/${SUB_RG}_q_${EXAMQ_RG}`, {
    id: `${SUB_RG}_q_${EXAMQ_RG}`,
    _kind: "questionSubmission",
    submissionId: SUB_RG,
    questionId: EXAMQ_RG,
    score: 8,
    maxScore: 10,
    gradingStatus: "graded",
    evaluation: { score: 8, feedback: "Good", costUsd: 0.002, tokenUsage: 120 },
  });
  put(`tenants/${TENANT}/exams/${EXAM_RG_LOCKED}`, {
    id: EXAM_RG_LOCKED,
    title: "Released-Gating Exam (locked)",
    status: "grading",
    classIds: [CLASS_10A],
    createdBy: uid("teacher"),
    resultsReleased: false,
  });
  put(`tenants/${TENANT}/submissions/${SUB_RG_LOCKED}`, {
    id: SUB_RG_LOCKED,
    examId: EXAM_RG_LOCKED,
    studentId: STUDENT_SAM_CLAIM,
    studentName: "Sam Stone",
    rollNumber: "R-001",
    classId: CLASS_10A,
    uploadedBy: uid("scanner"),
    pipelineStatus: "ready_for_review",
    answerSheets: {
      images: ["gs://demo/contract/rg-locked.jpg"],
      uploadedAt: now,
      uploadedBy: uid("scanner"),
      uploadSource: "scanner",
    },
    resultsReleased: false,
    resultsReleasedAt: null,
    summary: {
      totalScore: 8,
      maxScore: 10,
      grade: "A",
      percentage: 80,
      questionsGraded: 1,
      totalQuestions: 1,
      completedAt: now,
    },
    totalScore: 8,
    maxScore: 10,
    percentage: 80,
  });
  put(`tenants/${TENANT}/submissions/${SUB_RG_LOCKED}_q_${EXAMQ_RG}`, {
    id: `${SUB_RG_LOCKED}_q_${EXAMQ_RG}`,
    _kind: "questionSubmission",
    submissionId: SUB_RG_LOCKED,
    questionId: EXAMQ_RG,
    score: 8,
    maxScore: 10,
    gradingStatus: "graded",
    evaluation: { score: 8, feedback: "Good", costUsd: 0.002, tokenUsage: 120 },
  });

  // ── analytics materialized projections (dedicated tenant-scoped collections) ──
  // studentProgressSummary under BOTH id forms (getSummary keys on ctx.entityIds.studentId).
  // Shape mirrors the domain StudentProgressSummary (not audit-stamped — write raw).
  for (const sid of [STUDENT_SAM, STUDENT_SAM_CLAIM]) {
    writes.push({
      path: `tenants/${TENANT}/studentProgressSummaries/${sid}`,
      data: {
        id: sid,
        tenantId: TENANT,
        studentId: sid,
        autograde: {
          totalExams: 1,
          completedExams: 1,
          averageScore: 8,
          averagePercentage: 80,
          totalMarksObtained: 8,
          totalMarksAvailable: 10,
          subjectBreakdown: {},
          recentExams: [],
        },
        levelup: {
          totalSpaces: 1,
          completedSpaces: 1,
          averageCompletion: 100,
          totalPointsEarned: 10,
          totalPointsAvailable: 10,
          averageAccuracy: 0.8,
          streakDays: 1,
          subjectBreakdown: {},
          recentActivity: [],
        },
        overallScore: 80,
        strengthAreas: [],
        weaknessAreas: [],
        isAtRisk: false,
        atRiskReasons: [],
        lastUpdatedAt: now,
      },
    });
  }
  put(`tenants/${TENANT}/classProgressSummaries/${CLASS_10A}`, {
    id: CLASS_10A,
    classId: CLASS_10A,
    studentCount: 2,
    averageScore: 78,
    tenantRollup: { academyAvg: 78, perClass: [] },
    masteryDistribution: { notStarted: 0, inProgress: 1, mastered: 1 },
  });
  // ExamAnalytics (read-only projection; not audit-stamped — write raw).
  writes.push({
    path: `tenants/${TENANT}/examAnalytics/${EXAM_MID}`,
    data: {
      id: EXAM_MID,
      tenantId: TENANT,
      examId: EXAM_MID,
      totalSubmissions: 1,
      gradedSubmissions: 1,
      avgScore: 8,
      avgPercentage: 80,
      passRate: 1,
      medianScore: 8,
      scoreDistribution: { buckets: [{ label: "80-100", count: 1 }] },
      questionAnalytics: {},
      classBreakdown: {},
      topicPerformance: {},
      computedAt: now,
      lastUpdatedAt: now,
    },
  });
  put(`tenants/${TENANT}/insights/${INSIGHT_I1}`, {
    id: INSIGHT_I1,
    studentId: STUDENT_SAM_CLAIM,
    type: "at_risk_intervention",
    priority: "high",
    title: "Check-in",
    description: "Low recent average.",
    dismissed: false,
  });

  // ── active in_progress test session (submitTestSession / saveTestAnswer) ──
  // Not audit-stamped via `put` because DigitalTestSession has no createdBy/updatedBy.
  writes.push({
    path: `tenants/${TENANT}/digitalTestSessions/${SESSION_TS1}`,
    data: {
      id: SESSION_TS1,
      tenantId: TENANT,
      userId: uid("student"),
      spaceId: SPACE_DSA,
      storyPointId: SP_ARRAYS,
      sessionType: "practice",
      attemptNumber: 1,
      status: "in_progress",
      isLatest: true,
      startedAt: now,
      endedAt: null,
      durationMinutes: 30,
      serverDeadline: null,
      totalQuestions: 1,
      answeredQuestions: 0,
      questionOrder: [ITEM_Q1],
      visitedQuestions: {},
      markedForReview: {},
      submittedAt: null,
      autoSubmitted: false,
      createdAt: now,
      updatedAt: now,
    },
  });

  // ── spaceProgress for the enrolled student (read by getSpaceProgress) ──
  // Progress docs are NOT audit-stamped entities; write the exact SpaceProgress shape
  // (no createdBy/updatedBy/createdAt) so it validates against SpaceProgressSchema.
  writes.push({
    path: `tenants/${TENANT}/spaceProgress/${uid("student")}_${SPACE_DSA}`,
    data: {
      id: `${uid("student")}_${SPACE_DSA}`,
      userId: uid("student"),
      tenantId: TENANT,
      spaceId: SPACE_DSA,
      status: "in_progress",
      pointsEarned: 0,
      totalPoints: 10,
      percentage: 0,
      storyPoints: {},
      startedAt: now,
      completedAt: null,
      updatedAt: now,
    },
  });

  // Commit per-doc so one malformed path can't abort the whole set (and surfaces
  // a precise reason). The contract set is small (~40 docs) so this is cheap.
  for (const w of writes) {
    try {
      await db.doc(w.path).set(w.data, { merge: true });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[contract-seed] failed to write ${w.path}: ${(e as Error).message}`);
    }
  }

  // ── ensure the Auth-emulator users exist with claims matching auth-context ──
  // `getMe`/`createOrgUser`/claims-sync read the Admin Auth user record + custom
  // claims; create them here (idempotent) so the very first signed-in call resolves
  // a real user with the SAME `tenantId`/role claims `buildClaimsForRole` mints.
  const auth = adminAuth();
  const ROLES: Role[] = [
    "superAdmin",
    "tenantAdmin",
    "teacher",
    "student",
    "parent",
    "staff",
    "scanner",
  ];
  for (const role of ROLES) {
    const u = localSeedId("uid", DEMO_USER_KEYS[role as keyof typeof DEMO_USER_KEYS] ?? role);
    try {
      await auth.getUser(u);
    } catch {
      await auth
        .createUser({
          uid: u,
          email: `${role}@${CONTRACT_TENANT_KEY}.test`,
          emailVerified: true,
          displayName: role,
        })
        .catch(() => undefined);
    }
    // Mint claims with the CANONICAL `tenantId` key (domain `PlatformClaims`), not
    // the harness `activeTenantId` alias, so the seed-claims-parity assertion (a
    // seeded user carries a `tenantId` claim) holds for contract users too. We keep
    // `buildAuthContext`'s `activeTenantId` fallback for the wire-path sign-in too.
    const c = buildClaimsForRole(role) as unknown as Record<string, unknown>;
    const claims = { ...c, tenantId: c["activeTenantId"] ?? null };
    if (role === "superAdmin") delete (claims as { tenantId?: unknown }).tenantId;
    await auth.setCustomUserClaims(u, claims).catch(() => undefined);
  }
}
