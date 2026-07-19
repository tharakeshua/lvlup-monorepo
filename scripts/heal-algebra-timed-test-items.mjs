/**
 * Heal Algebra Foundations timed tests under v2_ Greenwood.
 *
 * Ensures Story Point 3/4 + Linear Equations have real question items under the
 * canonical nested path:
 *   v2_tenants/{t}/spaces/{space}/storyPoints/{sp}/items/{id}
 *
 * Also heals in_progress sessions with missing/empty questionOrder.
 * Does NOT rewrite tenantCodes.
 *
 * Usage: node scripts/heal-algebra-timed-test-items.mjs
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
const SPACE = "spc_greenwood-space-space-algebra_1d2ab9a5be";
const now = new Date().toISOString();

const TARGETS = [
  {
    id: "S1RJXVMhjh4j0cpd6Ngj",
    title: "Story Point 3",
    type: "timed_test",
    orderIndex: 2,
    questions: [
      {
        id: "itm_heal_sp3_q1_linear",
        prompt: "Solve for x: 2x + 6 = 14",
        questionType: "numeric",
        points: 2,
        answer: { correctAnswer: 4, acceptableAnswers: [4, "4"] },
      },
      {
        id: "itm_heal_sp3_q2_mcq",
        prompt: "Which of the following is a linear equation?",
        questionType: "mcq",
        points: 1,
        options: [
          { id: "a", text: "x² + 3 = 7" },
          { id: "b", text: "2x − 5 = 9" },
          { id: "c", text: "x³ = 8" },
          { id: "d", text: "1/x = 2" },
        ],
        answer: { correctAnswer: "b" },
      },
      {
        id: "itm_heal_sp3_q3_short",
        prompt: "In your own words, what does the solution of a linear equation mean?",
        questionType: "short_answer",
        points: 2,
        answer: {
          correctAnswer: "The value of the variable that makes the equation true.",
          modelAnswer:
            "The solution is the value of the unknown that makes both sides equal.",
        },
      },
    ],
  },
  {
    id: "WfosoPeHXXYwgGnE5dzR",
    title: "Story Point 4",
    type: "timed_test",
    orderIndex: 3,
    questions: [
      {
        id: "itm_heal_sp4_q1_linear",
        prompt: "Solve for y: 5y − 10 = 0",
        questionType: "numeric",
        points: 2,
        answer: { correctAnswer: 2, acceptableAnswers: [2, "2"] },
      },
      {
        id: "itm_heal_sp4_q2_mcq",
        prompt: "If 3x = 12, what is x?",
        questionType: "mcq",
        points: 1,
        options: [
          { id: "a", text: "2" },
          { id: "b", text: "3" },
          { id: "c", text: "4" },
          { id: "d", text: "6" },
        ],
        answer: { correctAnswer: "c" },
      },
      {
        id: "itm_heal_sp4_q3_num",
        prompt: "Solve for x: x/2 + 3 = 7",
        questionType: "numeric",
        points: 2,
        answer: { correctAnswer: 8, acceptableAnswers: [8, "8"] },
      },
    ],
  },
  {
    id: "stp_greenwood-storypoint-space-algebra-sp-eq_86801b99d6",
    title: "Linear Equations",
    type: "timed_test",
    orderIndex: 1,
    // Seed already has 2 questions; only add if empty.
    questions: [
      {
        id: "itm_greenwood-item-space-algebra-sp-equation_0acc7715b7",
        prompt: "Solve for x: 3x - 9 = 0",
        questionType: "numeric",
        points: 2,
        answer: { correctAnswer: 3, acceptableAnswers: [3, "3"] },
        existing: true,
      },
      {
        id: "itm_greenwood-item-space-algebra-sp-equation_68c5cb23ed",
        prompt: 'Explain what it means to "solve" a linear equation.',
        questionType: "short_answer",
        points: 3,
        answer: {
          correctAnswer: "Finding the value of the variable that makes the equation true.",
        },
        existing: true,
      },
    ],
  },
];

mkdirSync("tmp", { recursive: true });

async function ensureNestedStoryPoint(sp) {
  const flatRef = db.doc(`v2_tenants/${TID}/storyPoints/${sp.id}`);
  const nestedRef = db.doc(`v2_tenants/${TID}/spaces/${SPACE}/storyPoints/${sp.id}`);
  const flat = (await flatRef.get()).data() ?? {};
  const nested = {
    id: sp.id,
    tenantId: TID,
    spaceId: SPACE,
    title: flat.title ?? sp.title,
    type: flat.type ?? sp.type,
    orderIndex: flat.orderIndex ?? sp.orderIndex,
    durationMinutes: flat.durationMinutes ?? flat.assessmentConfig?.durationMinutes ?? 30,
    assessmentConfig: flat.assessmentConfig ?? {
      durationMinutes: 30,
      maxAttempts: 3,
      shuffleQuestions: false,
    },
    createdAt: flat.createdAt ?? now,
    updatedAt: now,
    createdBy: flat.createdBy ?? "heal-algebra-timed-test-items",
    updatedBy: "heal-algebra-timed-test-items",
  };
  await nestedRef.set(nested, { merge: true });
  await flatRef.set(
    {
      ...flat,
      id: sp.id,
      tenantId: TID,
      spaceId: SPACE,
      title: nested.title,
      type: nested.type,
      orderIndex: nested.orderIndex,
      durationMinutes: nested.durationMinutes,
      assessmentConfig: nested.assessmentConfig,
      updatedAt: now,
    },
    { merge: true }
  );
  return nested;
}

async function ensureQuestions(sp) {
  const itemsPath = `v2_tenants/${TID}/spaces/${SPACE}/storyPoints/${sp.id}/items`;
  const existing = await db.collection(itemsPath).get();
  const existingIds = new Set(existing.docs.map((d) => d.id));
  const created = [];

  if (existing.size > 0 && sp.questions.every((q) => q.existing)) {
    return { itemCount: existing.size, created, skipped: true };
  }

  let order = existing.size;
  for (const q of sp.questions) {
    if (existingIds.has(q.id)) continue;
    if (existing.size > 0 && q.existing) continue;
    // For SP3/4 (empty): create all. For Linear with items: skip if already present.
    if (existing.size > 0 && !q.existing) continue;

    const item = {
      id: q.id,
      tenantId: TID,
      spaceId: SPACE,
      storyPointId: sp.id,
      orderIndex: order,
      order,
      payload: {
        kind: "question",
        questionType: q.questionType,
        prompt: q.prompt,
        points: q.points,
        ...(q.options ? { options: q.options } : {}),
      },
      createdAt: now,
      updatedAt: now,
      createdBy: "heal-algebra-timed-test-items",
      updatedBy: "heal-algebra-timed-test-items",
      archivedAt: null,
    };
    await db.doc(`${itemsPath}/${q.id}`).set(item, { merge: true });

    // Answer key (deny-all subcollection)
    await db.doc(`${itemsPath}/${q.id}/answerKeys/${q.id}`).set(
      {
        id: q.id,
        itemId: q.id,
        tenantId: TID,
        ...q.answer,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    created.push(q.id);
    order += 1;
  }

  const after = await db.collection(itemsPath).get();
  return { itemCount: after.size, created, skipped: false };
}

async function healSessions(spId, questionIds) {
  if (questionIds.length === 0) return { healed: 0 };
  const snap = await db
    .collection(`v2_tenants/${TID}/digitalTestSessions`)
    .where("storyPointId", "==", spId)
    .where("status", "==", "in_progress")
    .get();
  let healed = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const qo = Array.isArray(d.questionOrder) ? d.questionOrder : [];
    if (qo.length === 0) {
      await doc.ref.update({
        questionOrder: questionIds,
        totalQuestions: questionIds.length,
        updatedAt: now,
      });
      healed += 1;
    }
  }
  return { healed };
}

async function main() {
  const report = { healedAt: now, tenantId: TID, spaceId: SPACE, storyPoints: [] };

  for (const sp of TARGETS) {
    await ensureNestedStoryPoint(sp);
    const items = await ensureQuestions(sp);
    const itemsSnap = await db
      .collection(`v2_tenants/${TID}/spaces/${SPACE}/storyPoints/${sp.id}/items`)
      .get();
    const questionIds = itemsSnap.docs
      .filter((d) => d.data()?.payload?.kind === "question")
      .sort(
        (a, b) =>
          Number(a.data().orderIndex ?? a.data().order ?? 0) -
          Number(b.data().orderIndex ?? b.data().order ?? 0)
      )
      .map((d) => d.id);
    const sessions = await healSessions(sp.id, questionIds);
    report.storyPoints.push({
      id: sp.id,
      title: sp.title,
      itemCount: items.itemCount,
      questionCount: questionIds.length,
      createdItems: items.created,
      sessionsHealed: sessions.healed,
      skipped: items.skipped ?? false,
    });
  }

  writeFileSync("tmp/heal-algebra-timed-test-items.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
