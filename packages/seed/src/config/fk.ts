/**
 * Cross-fragment FK consistency validation.
 *
 * The SeedConfig is authored as independent fragments (one per tenant subtree) that reference
 * each other ONLY by logical `key`. Before the engine resolves keys → deterministic ids, this
 * pass asserts every reference points at a declared key WITHIN its tenant — so a typo in a
 * `classKeys`/`studentKey`/`examKey`/`recipientKey` fails loudly at assembly time instead of
 * surfacing as an `unresolved … key` throw deep inside the pipeline (resolver.ts `must()`).
 *
 * It is structural (not a domain validator): it walks the same key graph the `IdResolver`
 * walks at write time, mirroring its dependency order (people → classes → spaces → storyPoints
 * → items → exams → submissions → sessions → progress → gamification → notifications).
 */

import type { SeedConfig, SpaceConfig, TenantConfig } from "./types.js";

/** A single FK violation (collected, then thrown together for a readable report). */
interface FkError {
  tenant: string;
  where: string;
  message: string;
}

/** Index of every declared logical key in one tenant, grouped by kind. */
interface TenantKeyIndex {
  people: Set<string>; // any uid-bearing actor (teacher/student/parent/staff/scanner/admin)
  students: Set<string>;
  teachers: Set<string>;
  classes: Set<string>;
  sessions: Set<string>;
  spaces: Set<string>;
  storyPoints: Map<string, Set<string>>; // spaceKey -> storyPointKeys
  items: Map<string, Set<string>>; // `${spaceKey}/${storyPointKey}` -> itemKeys
  agents: Set<string>;
  rubricPresets: Set<string>;
  exams: Set<string>;
  examQuestions: Map<string, Set<string>>; // examKey -> questionKeys
  evalSettings: Set<string>;
  submissions: Set<string>;
  achievements: Set<string>;
}

function indexTenant(tc: TenantConfig): TenantKeyIndex {
  const idx: TenantKeyIndex = {
    people: new Set(),
    students: new Set(),
    teachers: new Set(),
    classes: new Set(),
    sessions: new Set(),
    spaces: new Set(),
    storyPoints: new Map(),
    items: new Map(),
    agents: new Set(),
    rubricPresets: new Set(),
    exams: new Set(),
    examQuestions: new Map(),
    evalSettings: new Set(),
    submissions: new Set(),
    achievements: new Set(),
  };

  const addPerson = (key: string) => idx.people.add(key);
  for (const t of tc.teachers ?? []) {
    idx.teachers.add(t.key);
    addPerson(t.key);
  }
  for (const s of tc.students ?? []) {
    idx.students.add(s.key);
    if (!s.noAccount) addPerson(s.key);
  }
  for (const p of tc.parents ?? []) addPerson(p.key);
  for (const s of tc.staff ?? []) addPerson(s.key);
  for (const s of tc.scanners ?? []) addPerson(s.key);
  for (const a of tc.admins ?? []) addPerson(a.key);

  for (const c of tc.classes ?? []) idx.classes.add(c.key);
  for (const s of tc.academicSessions ?? []) idx.sessions.add(s.key);
  for (const a of tc.agents ?? []) idx.agents.add(a.key);
  for (const r of tc.rubricPresets ?? []) idx.rubricPresets.add(r.key);
  for (const e of tc.evaluationSettings ?? []) idx.evalSettings.add(e.key);
  for (const a of tc.achievements ?? []) idx.achievements.add(a.key);

  for (const space of tc.spaces ?? []) {
    idx.spaces.add(space.key);
    const sps = new Set<string>();
    for (const sp of space.storyPoints ?? []) {
      sps.add(sp.key);
      const items = new Set<string>();
      for (const item of sp.items ?? []) items.add(item.key);
      idx.items.set(`${space.key}/${sp.key}`, items);
    }
    idx.storyPoints.set(space.key, sps);
  }

  for (const exam of tc.exams ?? []) {
    idx.exams.add(exam.key);
    const qs = new Set<string>();
    for (const q of exam.questions ?? []) qs.add(q.key);
    idx.examQuestions.set(exam.key, qs);
  }
  for (const sub of tc.submissions ?? []) idx.submissions.add(sub.key);

  return idx;
}

/** Validate one tenant subtree's internal key references. */
function checkTenant(tc: TenantConfig, errs: FkError[]): void {
  const idx = indexTenant(tc);
  const tenant = tc.key;
  const err = (where: string, message: string) => errs.push({ tenant, where, message });

  const need = (set: Set<string>, key: string | undefined, where: string, kind: string) => {
    if (key == null) return;
    if (!set.has(key)) err(where, `references unknown ${kind} key "${key}"`);
  };
  const needAll = (
    set: Set<string>,
    keys: readonly string[] | undefined,
    where: string,
    kind: string
  ) => {
    for (const k of keys ?? []) need(set, k, where, kind);
  };

  // ── people → classes ──
  for (const t of tc.teachers ?? [])
    needAll(idx.classes, t.classKeys, `teacher ${t.key}.classKeys`, "class");
  for (const s of tc.students ?? [])
    needAll(idx.classes, s.classKeys, `student ${s.key}.classKeys`, "class");
  for (const p of tc.parents ?? []) {
    if (!p.studentKeys?.length)
      err(`parent ${p.key}`, "has no studentKeys (parentLinkedStudentIds, D10)");
    needAll(idx.students, p.studentKeys, `parent ${p.key}.studentKeys`, "student");
  }

  // ── classes → people / sessions ──
  for (const c of tc.classes ?? []) {
    needAll(idx.teachers, c.teacherKeys, `class ${c.key}.teacherKeys`, "teacher");
    needAll(idx.students, c.studentKeys, `class ${c.key}.studentKeys`, "student");
    need(
      idx.sessions,
      c.academicSessionKey,
      `class ${c.key}.academicSessionKey`,
      "academicSession"
    );
  }

  // ── spaces → classes / owner; items → rubric presets ──
  for (const space of tc.spaces ?? []) checkSpace(tc, space, idx, err, need, needAll);

  // ── space reviews / chat sessions ──
  for (const rev of tc.spaceReviews ?? []) {
    need(idx.spaces, rev.spaceKey, `spaceReview ${rev.key}.spaceKey`, "space");
    need(idx.people, rev.reviewerKey, `spaceReview ${rev.key}.reviewerKey`, "person");
  }
  for (const cs of tc.chatSessions ?? []) {
    need(idx.spaces, cs.spaceKey, `chatSession ${cs.key}.spaceKey`, "space");
    need(idx.people, cs.studentKey, `chatSession ${cs.key}.studentKey`, "person");
    if (cs.storyPointKey != null) {
      need(
        idx.storyPoints.get(cs.spaceKey) ?? new Set(),
        cs.storyPointKey,
        `chatSession ${cs.key}.storyPointKey`,
        "storyPoint"
      );
    }
    if (cs.itemKey != null && cs.storyPointKey != null) {
      need(
        idx.items.get(`${cs.spaceKey}/${cs.storyPointKey}`) ?? new Set(),
        cs.itemKey,
        `chatSession ${cs.key}.itemKey`,
        "item"
      );
    }
    if (cs.agentKey != null)
      need(idx.agents, cs.agentKey, `chatSession ${cs.key}.agentKey`, "agent");
  }

  // ── evaluation settings → rubric presets ──
  for (const es of tc.evaluationSettings ?? []) {
    need(
      idx.rubricPresets,
      es.rubricPresetKey,
      `evaluationSettings ${es.key}.rubricPresetKey`,
      "rubricPreset"
    );
  }

  // ── exams → classes / owner / sessions / settings / linked space ──
  for (const exam of tc.exams ?? []) {
    needAll(idx.classes, exam.classKeys, `exam ${exam.key}.classKeys`, "class");
    need(idx.teachers, exam.ownerTeacherKey, `exam ${exam.key}.ownerTeacherKey`, "teacher");
    need(
      idx.sessions,
      exam.academicSessionKey,
      `exam ${exam.key}.academicSessionKey`,
      "academicSession"
    );
    need(
      idx.evalSettings,
      exam.evaluationSettingsKey,
      `exam ${exam.key}.evaluationSettingsKey`,
      "evaluationSettings"
    );
    if (exam.linkedSpaceKey != null) {
      need(idx.spaces, exam.linkedSpaceKey, `exam ${exam.key}.linkedSpaceKey`, "space");
      if (exam.linkedStoryPointKey != null) {
        need(
          idx.storyPoints.get(exam.linkedSpaceKey) ?? new Set(),
          exam.linkedStoryPointKey,
          `exam ${exam.key}.linkedStoryPointKey`,
          "storyPoint"
        );
      }
    }
    for (const q of exam.questions ?? []) {
      if (
        q.linkedItemKey != null &&
        exam.linkedSpaceKey != null &&
        exam.linkedStoryPointKey != null
      ) {
        need(
          idx.items.get(`${exam.linkedSpaceKey}/${exam.linkedStoryPointKey}`) ?? new Set(),
          q.linkedItemKey,
          `exam ${exam.key} question ${q.key}.linkedItemKey`,
          "item"
        );
      }
    }
  }

  // ── submissions → exams / students / classes / questions ──
  for (const sub of tc.submissions ?? []) {
    need(idx.exams, sub.examKey, `submission ${sub.key}.examKey`, "exam");
    need(idx.students, sub.studentKey, `submission ${sub.key}.studentKey`, "student");
    need(idx.classes, sub.classKey, `submission ${sub.key}.classKey`, "class");
    if (sub.uploadedByKey != null)
      need(idx.people, sub.uploadedByKey, `submission ${sub.key}.uploadedByKey`, "person");
    const examQs = idx.examQuestions.get(sub.examKey) ?? new Set();
    for (const qs of sub.questionSubmissions ?? []) {
      need(
        examQs,
        qs.questionKey,
        `submission ${sub.key} questionSubmission.questionKey`,
        "examQuestion"
      );
    }
  }

  // ── grading dead-letter → submissions ──
  for (const dlq of tc.gradingDeadLetter ?? []) {
    need(
      idx.submissions,
      dlq.submissionKey,
      `gradingDeadLetter ${dlq.key}.submissionKey`,
      "submission"
    );
    if (dlq.resolvedByKey != null)
      need(idx.people, dlq.resolvedByKey, `gradingDeadLetter ${dlq.key}.resolvedByKey`, "person");
  }

  // ── test sessions → spaces / storyPoints / items / students ──
  for (const ts of tc.testSessions ?? []) {
    need(idx.spaces, ts.spaceKey, `testSession ${ts.key}.spaceKey`, "space");
    need(idx.students, ts.studentKey, `testSession ${ts.key}.studentKey`, "student");
    const sps = idx.storyPoints.get(ts.spaceKey) ?? new Set();
    need(sps, ts.storyPointKey, `testSession ${ts.key}.storyPointKey`, "storyPoint");
    const items = idx.items.get(`${ts.spaceKey}/${ts.storyPointKey}`) ?? new Set();
    for (const ans of ts.answers ?? []) {
      need(items, ans.itemKey, `testSession ${ts.key} answer.itemKey`, "item");
    }
  }

  // ── progress → students / spaces / storyPoints ──
  for (const p of tc.progress ?? []) {
    need(
      idx.students,
      p.studentKey,
      `progress(${p.studentKey},${p.spaceKey}).studentKey`,
      "student"
    );
    need(idx.spaces, p.spaceKey, `progress(${p.studentKey},${p.spaceKey}).spaceKey`, "space");
    const sps = idx.storyPoints.get(p.spaceKey) ?? new Set();
    for (const sp of p.storyPoints ?? []) {
      need(
        sps,
        sp.storyPointKey,
        `progress(${p.studentKey},${p.spaceKey}).storyPointKey`,
        "storyPoint"
      );
    }
  }

  // ── gamification → students / achievements ──
  for (const g of tc.studentGamification ?? []) {
    need(idx.students, g.studentKey, `studentGamification(${g.studentKey}).studentKey`, "student");
    needAll(
      idx.achievements,
      g.unlockedAchievementKeys,
      `studentGamification(${g.studentKey}).unlockedAchievementKeys`,
      "achievement"
    );
  }

  // ── announcements / notifications / insights → people / classes / students ──
  for (const a of tc.announcements ?? []) {
    if (a.authorKey != null)
      need(idx.people, a.authorKey, `announcement ${a.key}.authorKey`, "person");
    needAll(idx.classes, a.targetClassKeys, `announcement ${a.key}.targetClassKeys`, "class");
    needAll(idx.people, a.readByKeys, `announcement ${a.key}.readByKeys`, "person");
  }
  for (const n of tc.notifications ?? []) {
    need(idx.people, n.recipientKey, `notification ${n.key}.recipientKey`, "person");
  }
  for (const i of tc.insights ?? []) {
    need(idx.students, i.studentKey, `insight ${i.key}.studentKey`, "student");
  }
}

function checkSpace(
  _tc: TenantConfig,
  space: SpaceConfig,
  idx: TenantKeyIndex,
  err: (where: string, message: string) => void,
  need: (set: Set<string>, key: string | undefined, where: string, kind: string) => void,
  needAll: (
    set: Set<string>,
    keys: readonly string[] | undefined,
    where: string,
    kind: string
  ) => void
): void {
  needAll(idx.classes, space.classKeys, `space ${space.key}.classKeys`, "class");
  need(idx.teachers, space.ownerTeacherKey, `space ${space.key}.ownerTeacherKey`, "teacher");
  for (const sp of space.storyPoints ?? []) {
    for (const item of sp.items ?? []) {
      if (item.kind === "question" && item.rubricPresetKey != null) {
        need(
          idx.rubricPresets,
          item.rubricPresetKey,
          `item ${space.key}/${sp.key}/${item.key}.rubricPresetKey`,
          "rubricPreset"
        );
      }
    }
  }
}

/**
 * Assert global + per-tenant FK consistency across the assembled config. Throws a single,
 * readable error listing every violation. Also enforces global uniqueness invariants:
 *   - tenant `key`s are unique
 *   - tenant `code`s are unique (drives the `/tenantCodes/{code}` index)
 *   - super-admin keys/emails are unique
 */
export function assertFkConsistency(config: SeedConfig): void {
  const errs: FkError[] = [];

  // global uniqueness — tenant keys + codes
  const tenantKeys = new Set<string>();
  const tenantCodes = new Set<string>();
  for (const t of config.tenants) {
    if (tenantKeys.has(t.key))
      errs.push({ tenant: t.key, where: "tenant.key", message: `duplicate tenant key "${t.key}"` });
    tenantKeys.add(t.key);
    if (tenantCodes.has(t.code))
      errs.push({
        tenant: t.key,
        where: "tenant.code",
        message: `duplicate tenant code "${t.code}"`,
      });
    tenantCodes.add(t.code);
  }

  // super-admin uniqueness
  const saKeys = new Set<string>();
  const saEmails = new Set<string>();
  for (const sa of config.superAdmins ?? []) {
    if (saKeys.has(sa.key))
      errs.push({
        tenant: "(platform)",
        where: "superAdmin.key",
        message: `duplicate super-admin key "${sa.key}"`,
      });
    saKeys.add(sa.key);
    if (saEmails.has(sa.email))
      errs.push({
        tenant: "(platform)",
        where: "superAdmin.email",
        message: `duplicate super-admin email "${sa.email}"`,
      });
    saEmails.add(sa.email);
  }

  // per-tenant internal references
  for (const t of config.tenants) checkTenant(t, errs);

  if (errs.length > 0) {
    const lines = errs.map((e) => `  - [${e.tenant}] ${e.where}: ${e.message}`).join("\n");
    throw new Error(`SeedConfig FK consistency check failed (${errs.length} issue(s)):\n${lines}`);
  }
}
