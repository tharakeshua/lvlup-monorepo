/**
 * Heal Greenwood assign→take flow (v2_ SSOT only).
 *
 * Ensures Algebra Foundations has a timed test with assessmentConfig + questions,
 * assigned to Aarav’s G8 Math class. Does NOT rewrite tenantCodes / full reseed.
 *
 * Usage: node scripts/heal-greenwood-assign-take.mjs
 */
import admin from "firebase-admin";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const root = process.cwd();
const saFile = readdirSync(root).find(
  (f) => f.includes("firebase-adminsdk") && f.endsWith(".json")
);
if (!saFile) throw new Error("No firebase-adminsdk JSON in monorepo root");
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(join(root, saFile), "utf8"))),
  projectId: "lvlup-ff6fa",
});
const db = admin.firestore();

const TID = "tn_greenwood_524e429639";
const CLASS_MATH = "cls_greenwood-class-g8-math_db8edee86a";
const SPACE_ID = "spc_greenwood-space-space-algebra_1d2ab9a5be";
const SP_EQ = "stp_greenwood-storypoint-space-algebra-sp-eq_86801b99d6";
const ITEM_NUM = "itm_greenwood-item-space-algebra-sp-equation_0acc7715b7";
const ITEM_SHORT = "itm_greenwood-item-space-algebra-sp-equation_68c5cb23ed";
const TEACHER_ID = "tch_greenwood-teacher-t-priya_fix";
const STUDENT_ID = "stu_greenwood-student-s-aarav_80317ac983";
const now = new Date().toISOString();

mkdirSync("tmp", { recursive: true });

async function findPriyaTeacherId() {
  const snap = await db
    .collection(`v2_tenants/${TID}/teachers`)
    .where("email", "==", "priya.sharma@greenwood.edu")
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0].id;
  return TEACHER_ID;
}

/** Patch flat + nested story point mirrors. */
async function patchStoryPoint(spaceId, spId, patch) {
  const flatRef = db.doc(`v2_tenants/${TID}/storyPoints/${spId}`);
  const nestedRef = db.doc(`v2_tenants/${TID}/spaces/${spaceId}/storyPoints/${spId}`);
  await flatRef.set(patch, { merge: true });
  const nested = await nestedRef.get();
  if (nested.exists) await nestedRef.set(patch, { merge: true });
  else await nestedRef.set({ id: spId, spaceId, tenantId: TID, ...patch }, { merge: true });
}

async function ensureQuestionItem(spaceId, spId, itemId, spec) {
  const ref = db.doc(
    `v2_tenants/${TID}/spaces/${spaceId}/storyPoints/${spId}/items/${itemId}`
  );
  const existing = (await ref.get()).data() || {};
  const doc = {
    id: itemId,
    tenantId: TID,
    spaceId,
    storyPointId: spId,
    type: "question",
    content: spec.prompt,
    orderIndex: spec.orderIndex,
    order: spec.orderIndex,
    payload: {
      type: "question",
      basePoints: spec.points,
      questionData: {
        questionType: spec.questionType,
        ...(spec.questionData || {}),
      },
      // keep legacy aliases for older clients / seed mirrors
      kind: "question",
      prompt: spec.prompt,
      questionType: spec.questionType,
      points: spec.points,
    },
    createdAt: existing.createdAt || now,
    updatedAt: now,
    createdBy: existing.createdBy || "heal-assign-take",
    updatedBy: "heal-assign-take",
    archivedAt: null,
  };
  if (spec.rubricId) doc.rubricId = spec.rubricId;
  if (spec.effectiveRubric) doc.effectiveRubric = spec.effectiveRubric;
  await ref.set(doc, { merge: true });

  const keyId = `akey_heal_${itemId.slice(-12)}`;
  const akExisting = await ref.collection("answerKeys").limit(1).get();
  if (akExisting.empty) {
    await ref.collection("answerKeys").doc(keyId).set({
      id: keyId,
      itemId,
      questionType: spec.questionType,
      correctAnswer: spec.correctAnswer,
      acceptableAnswers: spec.acceptableAnswers,
      modelAnswer: spec.modelAnswer,
      evaluationGuidance: spec.evaluationGuidance,
    });
  }
  return { itemId, answerKeys: akExisting.empty ? 1 : akExisting.size };
}

async function main() {
  const report = {
    healedAt: now,
    tenantId: TID,
    goal: "assign→take: Algebra Foundations timed test → G8 Math → Aarav",
    steps: [],
    note: "Did NOT rewrite tenantCodes. v2_ paths only. No full reseed.",
  };

  const teacherId = await findPriyaTeacherId();
  report.teacherId = teacherId;
  report.studentId = STUDENT_ID;
  report.classId = CLASS_MATH;

  // ── Space: published + assigned to G8 Math + Priya on teacherIds ──
  const spaceRef = db.doc(`v2_tenants/${TID}/spaces/${SPACE_ID}`);
  const spaceSnap = await spaceRef.get();
  if (!spaceSnap.exists) {
    throw new Error(`Missing Algebra Foundations space ${SPACE_ID}`);
  }
  const space = spaceSnap.data();
  const classIds = [...new Set([...(space.classIds || []), CLASS_MATH])];
  const teacherIds = [...new Set([...(space.teacherIds || []), teacherId])];
  await spaceRef.set(
    {
      status: "published",
      publishedAt: space.publishedAt || now,
      classIds,
      teacherIds,
      accessType: space.accessType || "class_assigned",
      updatedAt: now,
    },
    { merge: true }
  );
  report.spaceId = SPACE_ID;
  report.steps.push({
    space: SPACE_ID,
    title: space.title,
    status: "published",
    classIds,
    teacherIds,
  });

  // ── Timed test story point: assessmentConfig required for Start Test ──
  const durationMinutes = 30;
  const assessmentConfig = {
    durationMinutes,
    maxAttempts: 3,
    shuffle: false,
    passingPercentage: 50,
  };
  const spPatch = {
    title: "Linear Equations",
    type: "timed_test",
    orderIndex: 1,
    durationMinutes,
    assessmentConfig,
    stats: { itemCount: 2, completionCount: 0, totalQuestions: 2 },
    updatedAt: now,
    updatedBy: "heal-assign-take",
  };
  await patchStoryPoint(SPACE_ID, SP_EQ, spPatch);
  report.storyPointId = SP_EQ;
  report.steps.push({
    storyPoint: SP_EQ,
    type: "timed_test",
    assessmentConfig,
  });

  // ── Questions (canonical type + payload so listItems / startTest populate questionOrder) ──
  const item1 = await ensureQuestionItem(SPACE_ID, SP_EQ, ITEM_NUM, {
    orderIndex: 0,
    prompt: "Solve for x: 3x - 9 = 0",
    questionType: "numeric",
    points: 2,
    correctAnswer: 3,
    acceptableAnswers: [3, "3"],
    questionData: { questionType: "numeric" },
    rubricId: "rbp_greenwood-rubricpreset-short-answer-5pt_cd8a655c3d",
  });
  const item2 = await ensureQuestionItem(SPACE_ID, SP_EQ, ITEM_SHORT, {
    orderIndex: 1,
    prompt: 'Explain what it means to "solve" a linear equation.',
    questionType: "short_answer",
    points: 3,
    correctAnswer: "Finding the value of the variable that makes the equation true.",
    modelAnswer:
      "To solve a linear equation is to find the value of the unknown that makes both sides equal.",
    evaluationGuidance: 'Accept any phrasing capturing "value that satisfies the equation".',
    questionData: { questionType: "text" },
    effectiveRubric: {
      totalPoints: 3,
      passingScore: 2,
      dimensions: [
        { key: "accuracy", label: "Accuracy", weight: 0.6 },
        { key: "clarity", label: "Clarity", weight: 0.4 },
      ],
    },
  });
  report.itemIds = [ITEM_NUM, ITEM_SHORT];
  report.steps.push({ items: [item1, item2] });

  // ── Heal orphan UI-created timed tests on this space (duration only; may lack items) ──
  const flatSps = await db
    .collection(`v2_tenants/${TID}/storyPoints`)
    .where("spaceId", "==", SPACE_ID)
    .get();
  const orphanHeals = [];
  for (const d of flatSps.docs) {
    if (d.id === SP_EQ) continue;
    const data = d.data();
    if (data.type !== "timed_test" && data.type !== "test") continue;
    const mins =
      data.assessmentConfig?.durationMinutes ||
      data.durationMinutes ||
      (typeof data.durationSeconds === "number"
        ? Math.max(1, Math.round(data.durationSeconds / 60))
        : 30);
    await patchStoryPoint(SPACE_ID, d.id, {
      type: "timed_test",
      durationMinutes: mins,
      assessmentConfig: {
        ...(data.assessmentConfig || {}),
        durationMinutes: mins,
        maxAttempts: data.assessmentConfig?.maxAttempts ?? 3,
      },
      updatedAt: now,
    });
    orphanHeals.push({ id: d.id, title: data.title, durationMinutes: mins });
  }
  if (orphanHeals.length) report.steps.push({ orphanTimedTestsHealed: orphanHeals });

  // ── Priya managedClassIds includes G8 Math (teacher assign scope) ──
  const tRef = db.doc(`v2_tenants/${TID}/teachers/${teacherId}`);
  const tData = (await tRef.get()).data() || {};
  const managed = [
    ...new Set([...(tData.classIds || []), ...(tData.managedClassIds || []), CLASS_MATH]),
  ];
  await tRef.set(
    {
      classIds: managed,
      managedClassIds: managed,
      updatedAt: now,
    },
    { merge: true }
  );
  report.steps.push({ teacherScope: { teacherId, managedClassIds: managed } });

  writeFileSync("tmp/qa-assign-take-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
