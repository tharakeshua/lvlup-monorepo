/**
 * The config-to-database pipeline. Writes a SeedConfig in strict dependency order:
 *
 *   tenant -> users+auth+claims -> memberships -> classes/sessions
 *     -> spaces -> storyPoints -> items -> answerKeys (server-only subcollection)
 *     -> agents/rubricPresets/questionBank
 *     -> exams -> examQuestions -> evaluationSettings
 *     -> submissions -> questionSubmissions
 *     -> testSessions -> testSubmissions
 *     -> progress -> summaries
 *     -> gamification (achievements, levels, studentAchievements, goals, sessions)
 *     -> announcements -> notifications -> insights -> costSummaries
 *
 * Every write is an idempotent deterministic-id upsert (ensureDoc / ensureCollection). Auth
 * users are bound to deterministic uids so re-runs are no-ops. Claims are minted through the
 * single shared `buildPlatformClaims` path (T2 invariant).
 *
 * SEED-1 invariant: every doc this pipeline writes parses its STRICT domain Zod schema
 * (gate: packages/seed/scripts/audit-u4-2.mjs → 40/40 entity types clean). All
 * config→canonical vocabulary mapping lives in `canonical.ts`; audit fields are emitted
 * per-schema (never as a blanket superset), and required-nullable fields are explicit null.
 */

import type { SeedContext } from "./context.js";
import { Paths } from "./paths.js";
import { IdResolver, type ResolvedPerson } from "./resolver.js";
import {
  buildPlatformClaims,
  sortClaims,
  type MembershipForClaims,
  type TenantRole,
} from "./claims.js";
import { membershipId, seedId, spaceProgressId } from "./ids.js";
import { DAY_MS, HOUR_MS } from "./clock.js";
import {
  ACADEMIC_SESSION_STATUS_MAP,
  AGENT_TYPE_FOR_PURPOSE,
  ANNOUNCEMENT_SCOPE_MAP,
  ANNOUNCEMENT_TARGET_ROLES,
  EXAM_STATUS_MAP,
  GOAL_TARGET_TYPE_MAP,
  GRADING_STATUS_MAP,
  INSIGHT_MAP,
  INSIGHT_PRIORITY_MAP,
  NOTIFICATION_TYPE_MAP,
  PERSON_STATUS_MAP,
  SUBMISSION_STATUS_TO_PIPELINE,
  TENANT_PLAN_MAP,
  TENANT_STATUS_MAP,
  TEST_SESSION_STATUS_MAP,
  buildBankQuestionData,
  buildChatAgentAnswerKey,
  buildItemQuestionData,
  buildMaterialData,
  canonicalAchievement,
  canonicalCostBreakdown,
  canonicalEvaluation,
  canonicalFeatures,
  canonicalQuestionType,
  canonicalRubric,
  defaultHolisticRubric,
  fullStaffPermissions,
  fullTeacherPermissions,
  gradeFor,
  isoTimestamp,
  personNameFor,
  recipientRoleFor,
  rubricDimensions,
} from "./canonical.js";
import type {
  AnnouncementConfig,
  ChatAgentQuestionSeedConfig,
  CostSummaryConfig,
  ExamConfig,
  ItemConfig,
  NotificationConfig,
  QuestionItemConfig,
  SeedConfig,
  SpaceConfig,
  SpaceProgressConfig,
  StudentGamificationConfig,
  SubmissionConfig,
  TenantConfig,
  TestSessionConfig,
} from "../config/types.js";

const SYSTEM_UID = "seed-system";

/** Canonical zSubmissionGrade letters (summary.grade). */
const GRADE_LETTERS = new Set(["A+", "A", "B+", "B", "C+", "C", "D", "F"]);

const DEFAULT_DISPLAY_SETTINGS = {
  showStrengths: true,
  showKeyTakeaway: true,
  prioritizeByImportance: true,
};

export class SeedPipeline {
  private readonly log;

  constructor(private readonly ctx: SeedContext) {
    this.log = ctx.logger.child("pipeline");
  }

  /**
   * Audit-by pair for schemas that declare createdBy/updatedBy but NOT archivedAt
   * (identity people, memberships, tenant, agents, chat sessions, reviews …).
   */
  private auditBy(createdBy = SYSTEM_UID): { createdBy: string; updatedBy: string } {
    return { createdBy, updatedBy: createdBy };
  }

  /** Full audit triple for the schemas that also carry archivedAt (Space/StoryPoint/UnifiedItem). */
  private audit(createdBy = SYSTEM_UID): {
    createdBy: string;
    updatedBy: string;
    archivedAt: null;
  } {
    return { ...this.auditBy(createdBy), archivedAt: null };
  }

  async run(config: SeedConfig): Promise<void> {
    if (config.superAdmins?.length) await this.seedSuperAdmins(config.superAdmins);
    if (config.globalEvaluationPresets?.length) {
      await this.seedGlobalPresets(config.globalEvaluationPresets);
    }
    for (const tenant of config.tenants) {
      await this.seedTenant(tenant);
    }
    await this.ctx.flush();
  }

  // ───────────────────────── platform root ─────────────────────────

  private async seedSuperAdmins(admins: NonNullable<SeedConfig["superAdmins"]>): Promise<void> {
    this.log.info(`super-admins: ${admins.length}`);
    for (const a of admins) {
      const uid = seedId("user", `super:${a.key}`);
      const claims = sortClaims(
        buildPlatformClaims({
          uid,
          tenantId: "" as never,
          tenantCode: "",
          role: "superAdmin",
          isSuperAdmin: true,
        })
      );
      await this.ctx.ensureAuthUser({
        uid,
        email: a.email,
        password: a.password,
        displayName: a.displayName,
        photoURL: a.photoURL,
        claims,
      });
      await this.ctx.ensureDoc("user", Paths.user(uid), {
        uid,
        email: a.email,
        displayName: a.displayName,
        photoURL: a.photoURL,
        isSuperAdmin: true,
        status: "active",
        authProviders: ["email"],
        lastLogin: null,
        ...this.auditBy(uid),
      });
    }
    await this.ctx.flush();
  }

  /** Global presets share the canonical EvaluationSettings entity (same schema, root path). */
  private async seedGlobalPresets(
    presets: NonNullable<SeedConfig["globalEvaluationPresets"]>
  ): Promise<void> {
    await this.ctx.ensureCollection("globalPreset", presets, (p) => ({
      path: Paths.globalPreset(seedId("globalPreset", p.key)),
      data: {
        id: seedId("globalPreset", p.key),
        name: p.name,
        description: p.description,
        isDefault: p.key.includes("default"),
        enabledDimensions: rubricDimensions(p.rubric),
        displaySettings: DEFAULT_DISPLAY_SETTINGS,
        createdBy: SYSTEM_UID,
      },
    }));
    await this.ctx.flush();
  }

  // ───────────────────────── tenant subtree ─────────────────────────

  private async seedTenant(tc: TenantConfig): Promise<void> {
    const r = new IdResolver(tc.key);
    const tenantId = r.tenantId;
    const tlog = this.ctx.logger.child(`tenant:${tc.key}`);
    tlog.info(`seeding tenant ${tc.name} (${tenantId})`);

    // 1) register all people (resolve uids/ids) BEFORE any write, so cross-links
    //    (incl. the tenant doc's required ownerUid) resolve.
    this.registerPeople(tc, r);

    // 2) tenant doc + code index
    await this.seedTenantDoc(tc, r);

    // 3) academic sessions (shells first; denorm filled after people resolve)
    await this.seedAcademicSessions(tc, r);

    // 4) auth users + /users docs + tenant entity docs + memberships + claims
    await this.seedPeople(tc, r);

    // 5) classes (now that students/teachers resolve → denorm projections)
    await this.seedClasses(tc, r);

    // 6) content: agents, rubric presets, question bank, spaces->storyPoints->items->answerKeys
    await this.seedAgents(tc, r);
    await this.seedRubricPresets(tc, r);
    await this.seedQuestionBank(tc, r);
    await this.seedSpaces(tc, r);
    await this.seedSpaceReviews(tc, r);
    await this.seedChatSessions(tc, r);

    // 7) exams -> questions -> evaluation settings
    await this.seedEvaluationSettings(tc, r);
    await this.seedExams(tc, r);

    // 8) submissions -> questionSubmissions
    await this.seedSubmissions(tc, r);

    // 9) test sessions -> per-item submissions subcollection
    await this.seedTestSessions(tc, r);

    // 10) progress + summaries
    await this.seedProgress(tc, r);

    // 11) gamification (achievement catalog first — StudentAchievement embeds the full doc)
    const achievementDocs = await this.seedAchievements(tc, r);
    await this.seedStudentGamification(tc, r, achievementDocs);

    // 12) notifications / announcements / insights / cost
    await this.seedAnnouncements(tc, r);
    await this.seedNotifications(tc, r);
    await this.seedInsights(tc, r);
    await this.seedCostSummaries(tc, r);

    await this.ctx.flush();
    tlog.info("tenant complete");
  }

  private async seedTenantDoc(tc: TenantConfig, r: IdResolver): Promise<void> {
    const tenantId = r.tenantId;
    const ownerUid = tc.admins?.length ? r.admin(tc.admins[0]!.key).uid : SYSTEM_UID;
    const settings = tc.settings ?? {};
    await this.ctx.ensureDoc("tenant", Paths.tenant(tenantId), {
      id: tenantId,
      name: tc.name,
      tenantCode: tc.code,
      slug: tc.slug ?? slug(tc.name),
      status: TENANT_STATUS_MAP[tc.status ?? "active"] ?? "active",
      ownerUid,
      subscription: {
        plan: TENANT_PLAN_MAP[tc.plan ?? "premium"] ?? "premium",
        renewsAt: null,
      },
      features: canonicalFeatures(tc.features),
      settings: {
        geminiKeyRef: tc.geminiKeyRef,
        timezone: (settings.timezone as string | undefined) ?? "Asia/Kolkata",
        locale: (settings.defaultLanguage as string | undefined) ?? "en",
        gradingScale: settings.gradingScale as string | undefined,
      },
      stats: {
        totalStudents: tc.students?.length ?? 0,
        totalTeachers: tc.teachers?.length ?? 0,
        totalClasses: tc.classes?.length ?? 0,
        totalExams: tc.exams?.length ?? 0,
        totalSpaces: tc.spaces?.length ?? 0,
      },
      branding: tc.branding,
      contactEmail: tc.contact?.email,
      contactPhone: tc.contact?.phone,
      trialEndsAt: null,
      ...this.auditBy(ownerUid),
    });
    // tenant code index doc — canonical TenantCodeIndex is exactly {tenantId, createdAt}.
    await this.ctx.ensureDoc(
      "tenant",
      Paths.tenantCode(tc.code),
      { tenantId, createdAt: this.ctx.clock.now() },
      { stampAudit: false }
    );
  }

  private async seedAcademicSessions(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.academicSessions?.length) return;
    await this.ctx.ensureCollection("academicSession", tc.academicSessions, (s) => ({
      path: Paths.academicSession(r.tenantId, r.sessionId(s.key)),
      data: {
        id: r.sessionId(s.key),
        tenantId: r.tenantId,
        name: s.name,
        // canonical AcademicSession dates are zIsoDate (YYYY-MM-DD), not timestamps.
        startDate: s.startDate,
        endDate: s.endDate,
        isCurrent: s.isCurrent ?? false,
        status: ACADEMIC_SESSION_STATUS_MAP[s.status ?? "active"] ?? "active",
        ...this.auditBy(),
      },
    }));
  }

  // ── people ──

  private registerPeople(tc: TenantConfig, r: IdResolver): void {
    for (const t of tc.teachers ?? []) r.registerTeacher(t.key, t.email);
    for (const s of tc.students ?? []) r.registerStudent(s.key, s.email);
    for (const p of tc.parents ?? []) r.registerParent(p.key, p.email);
    for (const s of tc.staff ?? []) r.registerStaff(s.key, s.email);
    for (const s of tc.scanners ?? []) r.registerScanner(s.key, s.email);
    for (const a of tc.admins ?? []) r.registerAdmin(a.key, a.email);
  }

  private async seedPeople(tc: TenantConfig, r: IdResolver): Promise<void> {
    const tenantId = r.tenantId;

    // Admins (staff docs; the admin surface is conveyed by the tenantAdmin membership role)
    for (const a of tc.admins ?? []) {
      const person = r.admin(a.key);
      await this.seedAccountUser(
        person,
        {
          email: a.email,
          password: a.password,
          displayName: a.displayName ?? `${a.firstName} ${a.lastName}`,
          photoURL: a.photoURL,
          phone: a.phone,
        },
        tenantId
      );
      await this.ctx.ensureDoc("staff", Paths.staff(tenantId, person.entityId), {
        id: person.entityId,
        tenantId,
        authUid: person.uid,
        email: a.email,
        firstName: a.firstName,
        lastName: a.lastName,
        displayName: a.displayName ?? `${a.firstName} ${a.lastName}`,
        status: "active",
        ...this.auditBy(person.uid),
      });
      await this.writeMembership(r, person, "tenantAdmin", tc.code, {
        staffId: person.entityId,
        staffPermissions: a.staffPermissions,
      });
    }

    // Teachers
    for (const t of tc.teachers ?? []) {
      const person = r.teacher(t.key);
      await this.seedAccountUser(person, t, tenantId);
      await this.ctx.ensureDoc("teacher", Paths.teacher(tenantId, person.entityId), {
        id: person.entityId,
        tenantId,
        authUid: person.uid,
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        displayName: t.displayName ?? `${t.firstName} ${t.lastName}`,
        subjects: t.subjects ?? [],
        department: t.department,
        designation: t.designation,
        classIds: r.classIds(t.classKeys),
        status: PERSON_STATUS_MAP[t.status ?? "active"] ?? "active",
        lastLogin: null,
        ...this.auditBy(person.uid),
      });
      await this.writeMembership(r, person, "teacher", tc.code, {
        teacherId: person.entityId,
        managedClassIds: r.classIds(t.classKeys),
        permissions: t.permissions,
      });
    }

    // Students
    for (const s of tc.students ?? []) {
      const person = r.student(s.key);
      if (!s.noAccount) await this.seedAccountUser(person, s, tenantId);
      await this.ctx.ensureDoc("student", Paths.student(tenantId, person.entityId), {
        id: person.entityId,
        tenantId,
        // authUid is optional NON-nullable in the domain — omit for roster-only students.
        ...(s.noAccount ? {} : { authUid: person.uid }),
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        displayName: s.displayName ?? `${s.firstName} ${s.lastName}`,
        rollNumber: s.rollNumber,
        grade: s.grade,
        classIds: r.classIds(s.classKeys),
        status: PERSON_STATUS_MAP[s.status ?? "active"] ?? "active",
        ...this.auditBy(person.uid),
      });
      if (!s.noAccount) {
        await this.writeMembership(r, person, "student", tc.code, {
          studentId: person.entityId,
          managedClassIds: r.classIds(s.classKeys),
        });
      }
    }

    // Parents (link to children via parentLinkedStudentIds — D10)
    for (const p of tc.parents ?? []) {
      const person = r.parent(p.key);
      await this.seedAccountUser(person, p, tenantId);
      const childIds = r.studentIds(p.studentKeys);
      const childNames = (p.studentKeys ?? []).map((k) => personNameFor(tc, k));
      await this.ctx.ensureDoc("parent", Paths.parent(tenantId, person.entityId), {
        id: person.entityId,
        tenantId,
        authUid: person.uid,
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        displayName: p.displayName ?? `${p.firstName} ${p.lastName}`,
        studentIds: childIds, // canonical (drop childStudentIds — D10)
        linkedStudentNames: childNames,
        status: PERSON_STATUS_MAP[p.status ?? "active"] ?? "active",
        lastLogin: null,
        ...this.auditBy(person.uid),
      });
      await this.writeMembership(r, person, "parent", tc.code, {
        parentId: person.entityId,
        parentLinkedStudentIds: childIds,
      });
    }

    // Staff
    for (const s of tc.staff ?? []) {
      const person = r.staffMember(s.key);
      await this.seedAccountUser(person, s, tenantId);
      await this.ctx.ensureDoc("staff", Paths.staff(tenantId, person.entityId), {
        id: person.entityId,
        tenantId,
        authUid: person.uid,
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        displayName: s.displayName ?? `${s.firstName} ${s.lastName}`,
        department: s.department,
        status: PERSON_STATUS_MAP[s.status ?? "active"] ?? "active",
        ...this.auditBy(person.uid),
      });
      await this.writeMembership(r, person, "staff", tc.code, {
        staffId: person.entityId,
        staffPermissions: s.staffPermissions,
      });
    }

    // Scanners (D11 tenant-scoped)
    for (const sc of tc.scanners ?? []) {
      const person = r.scanner(sc.key);
      await this.seedAccountUser(
        person,
        {
          email: sc.email,
          password: sc.password,
          displayName: sc.label,
        },
        tenantId
      );
      await this.ctx.ensureDoc("scanner", Paths.scanner(tenantId, person.entityId), {
        id: person.entityId,
        tenantId,
        authUid: person.uid,
        name: sc.label,
        status: PERSON_STATUS_MAP[sc.status ?? "active"] ?? "active",
        ...this.auditBy(person.uid),
      });
      await this.writeMembership(r, person, "scanner", tc.code, {
        scannerId: person.entityId,
      });
    }

    await this.ctx.flush();
  }

  /**
   * Create the `/users/{uid}` platform doc. The Auth user itself is created by `ensureAuthUser`
   * (called from the role-specific seeders). `activeTenantId` is the tenant currently in scope.
   */
  private async seedAccountUser(
    person: ResolvedPerson,
    acc: {
      email: string;
      password: string;
      displayName?: string;
      photoURL?: string;
      phone?: string;
    },
    activeTenantId: string
  ): Promise<void> {
    // Create the Auth account (idempotent, deterministic uid) — claims minted later per membership.
    const res = await this.ctx.ensureAuthUser({
      uid: person.uid,
      email: acc.email,
      password: acc.password,
      displayName: acc.displayName,
      photoURL: acc.photoURL,
      phoneNumber: acc.phone,
    });
    // On the SHARED real-project Auth, an email may already map to a DIFFERENT uid than
    // our deterministic seedId — a legitimately multi-tenant/B2C user (one Auth account,
    // memberships in several tenants) or a pre-existing account. ensureAuthUser reconciles
    // to that existing uid; propagate it so the /users doc, membership, claims, and audit
    // all key off the REAL Auth uid (keeps setClaims valid; on the emulator this is a no-op
    // because Auth is cleared first so res.uid always equals person.uid).
    if (res.uid !== person.uid) {
      (person as { uid: string }).uid = res.uid;
    }
    await this.ctx.ensureDoc("user", Paths.user(person.uid), {
      uid: person.uid,
      email: acc.email,
      phone: acc.phone,
      displayName: acc.displayName ?? acc.email,
      photoURL: acc.photoURL,
      authProviders: ["email"],
      isSuperAdmin: false,
      activeTenantId,
      status: "active",
      lastLogin: null,
      ...this.auditBy(person.uid),
    });
  }

  /** Writes the membership doc AND mints claims through the single shared builder. */
  private async writeMembership(
    r: IdResolver,
    person: ResolvedPerson,
    role: TenantRole,
    tenantCode: string,
    extra: Partial<MembershipForClaims>
  ): Promise<void> {
    const tenantId = r.tenantId;
    const m: MembershipForClaims = {
      uid: person.uid,
      tenantId,
      tenantCode,
      role,
      teacherId: extra.teacherId,
      studentId: extra.studentId,
      parentId: extra.parentId,
      staffId: extra.staffId,
      scannerId: extra.scannerId,
      managedClassIds: extra.managedClassIds,
      parentLinkedStudentIds: extra.parentLinkedStudentIds,
      permissions: extra.permissions,
      staffPermissions: extra.staffPermissions,
    };
    const claims = sortClaims(buildPlatformClaims(m));

    // membership doc (⚷ admin-SDK write only). Canonical UserMembership: permission maps are
    // exhaustive enum-keyed records nested under `permissions.permissions`; joinSource is the
    // closed domain enum (seeded accounts are admin-provisioned); lastActive is required-null.
    const mid = membershipId(person.uid, tenantId);
    await this.ctx.ensureDoc("membership", Paths.membership(person.uid, tenantId), {
      id: mid,
      uid: person.uid,
      tenantId,
      tenantCode,
      role,
      status: "active",
      joinSource: "admin_created",
      teacherId: extra.teacherId,
      studentId: extra.studentId,
      parentId: extra.parentId,
      staffId: extra.staffId,
      scannerId: extra.scannerId,
      permissions: {
        ...(extra.permissions ? { permissions: fullTeacherPermissions(extra.permissions) } : {}),
        managedClassIds: extra.managedClassIds ?? [],
      },
      ...(extra.staffPermissions
        ? { staffPermissions: fullStaffPermissions(extra.staffPermissions) }
        : {}),
      parentLinkedStudentIds: extra.parentLinkedStudentIds,
      lastActive: null,
      ...this.auditBy(person.uid),
    });

    // mint claims (idempotent) — claims-only, does NOT touch the account password/profile.
    // This is the SAME PlatformClaims the server's syncMembershipClaims produces (T2 invariant).
    await this.ctx.setClaims(person.uid, claims as Record<string, unknown>);
  }

  private async seedClasses(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.classes?.length) return;
    await this.ctx.ensureCollection("class", tc.classes, (c) => {
      const studentIds = r.studentIds(c.studentKeys);
      return {
        path: Paths.klass(r.tenantId, r.classId(c.key)),
        data: {
          id: r.classId(c.key),
          tenantId: r.tenantId,
          name: c.name,
          grade: c.grade,
          section: c.section,
          academicSessionId: c.academicSessionKey ? r.sessionId(c.academicSessionKey) : undefined,
          teacherIds: r.teacherIds(c.teacherKeys),
          studentIds, // denorm projection (D7)
          studentCount: studentIds.length,
          // NOTE: `schedule` is not a canonical Class field — dropped at the builder (SEED-1).
          status: c.status ?? "active",
          ...this.auditBy(),
        },
      };
    });
  }

  // ── content ──

  private async seedAgents(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.agents?.length) return;
    await this.ctx.ensureCollection("agent", tc.agents, (a) => ({
      path: Paths.agent(r.tenantId, r.agentId(a.key)),
      logicalKey: `agent:${a.key}`,
      verifyAs: ["agent"],
      data: {
        id: r.agentId(a.key),
        spaceId: r.spaceId(a.spaceKey),
        tenantId: r.tenantId,
        type: a.type ?? AGENT_TYPE_FOR_PURPOSE[a.purpose ?? "tutoring"] ?? "tutor",
        name: a.name,
        publicDescription: a.publicDescription,
        identity: a.identity,
        isActive: a.isActive ?? true,
        // Legacy seed fixtures may still carry a provider model string. Never
        // write that through: canonical agents persist only stable policy IDs.
        modelPolicyId:
          a.modelPolicyId ??
          ((a.type ?? AGENT_TYPE_FOR_PURPOSE[a.purpose ?? "tutoring"] ?? "tutor") === "evaluator"
            ? "evaluation.quality"
            : "conversation.quality"),
        version: a.version ?? 1,
        systemPrompt: a.systemPrompt, // ⚷ authoring-only
        openingMessage: a.openingMessage,
        supportedLanguages: a.supportedLanguages,
        defaultLanguage: a.defaultLanguage,
        maxConversationTurns: a.maxConversationTurns,
        rules: a.rules ?? [],
        evaluationObjectives: a.evaluationObjectives,
        strictness: a.strictness,
        feedbackStyle: a.feedbackStyle,
        temperatureOverride: a.temperatureOverride,
        ...this.auditBy(),
      },
    }));
  }

  private async seedRubricPresets(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.rubricPresets?.length) return;
    await this.ctx.ensureCollection("rubricPreset", tc.rubricPresets, (p) => ({
      path: Paths.rubricPreset(r.tenantId, r.rubricPresetId(p.key)),
      data: {
        id: r.rubricPresetId(p.key),
        tenantId: r.tenantId,
        name: p.name,
        description: p.description,
        rubric: canonicalRubric(p.rubric),
        category: p.category ?? "general",
        isDefault: p.isDefault ?? false,
      },
    }));
  }

  private async seedQuestionBank(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.questionBank?.length) return;
    await this.ctx.ensureCollection("questionBankItem", tc.questionBank, (q) => ({
      path: Paths.questionBankItem(r.tenantId, r.bankItemId(q.key)),
      data: {
        id: r.bankItemId(q.key),
        tenantId: r.tenantId,
        questionType: canonicalQuestionType(q.questionType),
        content: q.prompt,
        basePoints: q.points ?? 1,
        // NOTE: bank items carry their answer in-line (questionData) for authoring; clients never read it.
        questionData: buildBankQuestionData(q),
        subject: q.subject ?? "General",
        topics: q.topics ?? q.tags ?? [],
        difficulty: q.difficulty ?? "medium",
        usageCount: 0,
        lastUsedAt: null,
        tags: q.tags ?? [],
      },
    }));
  }

  private async seedSpaces(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const space of tc.spaces ?? []) {
      await this.seedSpace(tc, r, space);
    }
  }

  private async seedSpace(tc: TenantConfig, r: IdResolver, space: SpaceConfig): Promise<void> {
    const tenantId = r.tenantId;
    const spaceId = r.spaceId(space.key);
    const ownerUid = space.ownerTeacherKey ? r.teacher(space.ownerTeacherKey).uid : SYSTEM_UID;
    const spCount = space.storyPoints?.length ?? 0;
    let itemCount = 0;
    for (const sp of space.storyPoints ?? []) itemCount += sp.items?.length ?? 0;

    await this.ctx.ensureDoc("space", Paths.space(tenantId, spaceId), {
      id: spaceId,
      tenantId,
      title: space.title,
      description: space.description,
      // canonical SpaceType (zSpaceType) — coerce legacy data values ('course'/'store'/…) to the enum.
      type: (
        ["learning", "practice", "assessment", "resource", "hybrid"] as readonly string[]
      ).includes(String(space.type))
        ? space.type
        : "learning",
      status: space.status ?? "published",
      subject: space.subject,
      classIds: r.classIds(space.classKeys),
      // accessType ∈ zSpaceAccessType — coerce legacy/missing values to the enum
      // (priced/store spaces are public_store; cohort spaces are class_assigned).
      accessType: (["class_assigned", "tenant_wide", "public_store"] as readonly string[]).includes(
        String((space as { accessType?: string }).accessType)
      )
        ? (space as { accessType?: string }).accessType
        : space.price != null && space.price !== 0
          ? "public_store"
          : "class_assigned",
      // price is optional zMoney {amountMinor,currency} — omit for free spaces; coerce a
      // bare number (data convenience) into the canonical Money object.
      ...(space.price != null && space.price !== 0
        ? {
            price: {
              amountMinor: typeof space.price === "number" ? space.price : Number(space.price),
              currency: "INR",
            },
          }
        : {}),
      // publishedAt is required (nullable) on SpaceSchema; stats/ratingAggregate field names
      // must match SpaceStatsSchema (enrolledCount) + SpaceRatingAggregateSchema.
      publishedAt: (space.status ?? "published") === "published" ? this.ctx.clock.now() : null,
      stats: { storyPointCount: spCount, itemCount, enrolledCount: 0 },
      ratingAggregate: { averageRating: 0, totalReviews: 0, distribution: {} },
      ...this.audit(ownerUid),
    });

    let spOrder = 0;
    for (const sp of space.storyPoints ?? []) {
      const storyPointId = r.storyPointId(space.key, sp.key);
      const items = sp.items ?? [];
      const spType = sp.type ?? "standard";
      const durationMinutes =
        typeof sp.durationSeconds === "number" && sp.durationSeconds > 0
          ? Math.max(1, Math.round(sp.durationSeconds / 60))
          : typeof (sp as { durationMinutes?: number }).durationMinutes === "number"
            ? Math.max(1, (sp as { durationMinutes: number }).durationMinutes)
            : undefined;
      // Timed tests need assessmentConfig.durationMinutes for startTestSession
      // (callable rejects durationMinutes <= 0) and for student /tests cards.
      const assessmentConfig =
        spType === "timed_test" || spType === "test"
          ? {
              durationMinutes: durationMinutes ?? 30,
              maxAttempts: 3,
              shuffle: false,
              passingPercentage: 50,
            }
          : undefined;
      const storyPointDoc = {
        id: storyPointId,
        tenantId,
        spaceId,
        title: sp.title,
        description: sp.description,
        type: spType,
        // canonical StoryPointSchema: `orderIndex` (int, required); legacy `order` +
        // `durationSeconds` are NOT schema keys (the read mapper also drops them).
        orderIndex: sp.order ?? spOrder++,
        ...(durationMinutes != null ? { durationMinutes } : {}),
        ...(assessmentConfig ? { assessmentConfig } : {}),
        stats: {
          itemCount: items.length,
          completionCount: 0,
          ...(assessmentConfig
            ? { totalQuestions: items.filter((i) => i.kind === "question").length }
            : {}),
        },
        ...this.audit(ownerUid),
      };
      // CANONICAL doc: the runtime (saveStoryPoint / listStoryPoints / getStoryPoint via
      // `entity('storyPoints')`) reads the FLAT `tenants/{t}/storyPoints/{id}` collection.
      // Items remain nested under `spaces/{s}/storyPoints/{sp}/items` (found via collection
      // group), so the nested storyPoint doc is only kept as a harmless mirror.
      await this.ctx.ensureDoc(
        "storyPointMirror",
        `${Paths.tenant(tenantId)}/storyPoints/${storyPointId}`,
        storyPointDoc
      );
      await this.ctx.ensureDoc(
        "storyPoint",
        Paths.storyPoint(tenantId, spaceId, storyPointId),
        storyPointDoc,
        { logicalKey: `storyPoint:${space.key}/${sp.key}`, verifyAs: ["storyPoint"] }
      );

      let itemOrder = 0;
      for (const item of items) {
        await this.seedItem(
          tc,
          r,
          space.key,
          spaceId,
          sp.key,
          storyPointId,
          item,
          itemOrder++,
          ownerUid
        );
      }
    }
  }

  /** Writes the item (answer-stripped) + the server-only answerKeys subcollection. */
  private async seedItem(
    _tc: TenantConfig,
    r: IdResolver,
    spaceKey: string,
    spaceId: string,
    spKey: string,
    storyPointId: string,
    item: ItemConfig,
    order: number,
    ownerUid: string
  ): Promise<void> {
    const tenantId = r.tenantId;
    const itemId = r.itemId(spaceKey, spKey, item.key);

    if (item.kind === "material") {
      await this.ctx.ensureDoc("item", Paths.item(tenantId, spaceId, storyPointId, itemId), {
        id: itemId,
        tenantId,
        spaceId,
        storyPointId,
        type: "material",
        title: item.title,
        // canonical UnifiedItemSchema: `orderIndex` (int, required) — legacy `order`
        // is renamed by the read mapper too (belt-and-suspenders).
        orderIndex: item.order ?? order,
        // two-level discriminated payload union: { type:'material', materialData:{ materialType, … } }
        payload: {
          type: "material",
          materialData: buildMaterialData(item),
        },
        ...this.audit(ownerUid),
      });
      return;
    }

    // question item — strip the answer into the server-only subcollection
    const q = item as QuestionItemConfig | ChatAgentQuestionSeedConfig;
    const isChatAssessment = q.questionType === "chat_agent_question";
    const chatAssessment = isChatAssessment ? (q as ChatAgentQuestionSeedConfig) : undefined;
    const rubricSnapshot = this.resolveRubricSnapshot(r, q);

    await this.ctx.ensureDoc(
      "item",
      Paths.item(tenantId, spaceId, storyPointId, itemId),
      {
        id: itemId,
        tenantId,
        spaceId,
        storyPointId,
        type: "question",
        content: q.prompt,
        // canonical UnifiedItemSchema: `orderIndex` (int, required).
        orderIndex: q.order ?? order,
        // answer-stripped payload (client-facing), canonical discriminated union
        payload: {
          type: "question",
          basePoints: isChatAssessment ? 1 : ((q as QuestionItemConfig).points ?? 1),
          questionData: isChatAssessment
            ? buildItemQuestionData(q, {
                interviewerAgentId: r.agentId(chatAssessment!.interviewerAgentKey),
              })
            : buildItemQuestionData(q),
        },
        ...(chatAssessment?.evaluatorAgentKey
          ? {
              meta: {
                evaluatorAgentId: r.agentId(chatAssessment.evaluatorAgentKey),
              },
            }
          : {}),
        // resolve-and-store at write (no grade-time settings re-read)
        rubricId: rubricSnapshot.rubricId,
        rubric: rubricSnapshot.rubric,
        ...this.audit(ownerUid),
      },
      {
        logicalKey: `item:${spaceKey}/${spKey}/${item.key}`,
        verifyAs: isChatAssessment ? ["item", "assessmentConfiguration"] : ["item"],
      }
    );

    // server-only AnswerKey (§6.4) — deny-all subcollection
    // The one canonical key doc is named after its parent item (same as
    // repo-admin's answerKeyDoc); never derive an independent answer-key id.
    const keyId = itemId;
    await this.ctx.ensureDoc(
      "answerKey",
      Paths.answerKey(tenantId, spaceId, storyPointId, itemId),
      isChatAssessment
        ? {
            id: keyId,
            itemId,
            tenantId,
            spaceId,
            storyPointId,
            ...buildChatAgentAnswerKey(q as ChatAgentQuestionSeedConfig),
          }
        : {
            id: keyId,
            itemId,
            tenantId,
            spaceId,
            storyPointId,
            questionType: canonicalQuestionType(q.questionType),
            correctAnswer: (q as QuestionItemConfig).answer.correctAnswer,
            acceptableAnswers: (q as QuestionItemConfig).answer.acceptableAnswers,
            evaluationGuidance: (q as QuestionItemConfig).answer.evaluationGuidance, // ⚷
            modelAnswer: (q as QuestionItemConfig).answer.modelAnswer, // ⚷
          },
      {
        logicalKey: `answerKey:${spaceKey}/${spKey}/${item.key}`,
        verifyAs: isChatAssessment ? ["answerKey", "assessmentConfiguration"] : ["answerKey"],
      }
    );
  }

  private resolveRubricSnapshot(
    r: IdResolver,
    q: QuestionItemConfig | ChatAgentQuestionSeedConfig
  ): { rubricId?: string; rubric?: Record<string, unknown> } {
    if (q.rubricPresetKey) {
      return {
        rubricId: r.rubricPresetId(q.rubricPresetKey),
        rubric: undefined, // snapshot resolved from preset; preset doc is the source
      };
    }
    if (q.rubric) {
      return {
        rubricId: undefined,
        rubric: canonicalRubric(
          q.rubric,
          q.questionType === "chat_agent_question" ? 1 : (q.points ?? 1)
        ),
      };
    }
    return {};
  }

  // ── space reviews + chat ──

  /** B2C/space reviews at `spaces/{s}/reviews/{reviewerUid}` (one per user per space). */
  private async seedSpaceReviews(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.spaceReviews?.length) return;
    for (const rev of tc.spaceReviews) {
      const spaceId = r.spaceId(rev.spaceKey);
      const reviewerUid = r.uidOf(rev.reviewerKey);
      const id = seedId("spaceReview", `${r.tenantKey}:${rev.spaceKey}:${rev.reviewerKey}`);
      await this.ctx.ensureDoc("spaceReview", Paths.spaceReview(r.tenantId, spaceId, reviewerUid), {
        id,
        tenantId: r.tenantId,
        spaceId,
        userId: reviewerUid,
        userName: personNameFor(tc, rev.reviewerKey),
        rating: rev.rating,
        comment: rev.comment,
        ...this.auditBy(reviewerUid),
      });
    }
  }

  /** AI-tutor chat sessions; messages ALWAYS a subcollection (D6). */
  private async seedChatSessions(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.chatSessions?.length) return;
    for (const cs of tc.chatSessions) {
      const sessionId = r.chatSessionId(cs.key);
      const ownerUid = r.uidOf(cs.studentKey);
      const messages = cs.messages ?? [];
      const preview = messages.length > 0 ? messages[messages.length - 1]!.text : "";
      await this.ctx.ensureDoc("chatSession", Paths.chatSession(r.tenantId, sessionId), {
        id: sessionId,
        tenantId: r.tenantId,
        userId: ownerUid,
        spaceId: r.spaceId(cs.spaceKey),
        // storyPointId/itemId are REQUIRED on the canonical ChatSession — a tutor chat is
        // always anchored to the item it was opened from.
        storyPointId:
          cs.storyPointKey != null ? r.storyPointId(cs.spaceKey, cs.storyPointKey) : undefined,
        itemId:
          cs.itemKey != null && cs.storyPointKey != null
            ? r.itemId(cs.spaceKey, cs.storyPointKey, cs.itemKey)
            : undefined,
        agentId: cs.agentKey != null ? r.agentId(cs.agentKey) : undefined,
        agentName:
          cs.agentKey != null ? tc.agents?.find((a) => a.key === cs.agentKey)?.name : undefined,
        sessionTitle: cs.title ?? "Tutor Session",
        previewMessage: preview,
        messageCount: messages.length, // ⚷ denormalized counter
        language: cs.language ?? "en",
        isActive: cs.isActive ?? true,
        systemPrompt: cs.systemPrompt, // ⚷ authoring-only
        ...this.auditBy(ownerUid),
      });

      let order = 0;
      for (const m of messages) {
        const msgId = seedId("chatMessage", `${r.tenantKey}:${cs.key}:${m.key}`);
        // canonical ChatMessage carries ONLY {id, role, text, timestamp, mediaUrls?, tokensUsed?}
        // — ordering rides on `timestamp` (chatStream orders by it), so unstamped messages get
        // deterministic 1s-spaced clock offsets.
        await this.ctx.ensureDoc(
          "chatMessage",
          Paths.chatMessage(r.tenantId, sessionId, msgId),
          {
            id: msgId,
            role: m.role,
            text: m.text,
            timestamp: m.timestamp ?? this.ctx.clock.at(order * 1000),
            mediaUrls: m.mediaUrls,
            tokensUsed: m.tokensUsed, // ⚷
          },
          { stampAudit: false }
        );
        order++;
      }
    }
  }

  // ── exams ──

  private async seedEvaluationSettings(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.evaluationSettings?.length) return;
    await this.ctx.ensureCollection("evaluationSettings", tc.evaluationSettings, (s) => {
      const presetRubric = s.rubricPresetKey
        ? tc.rubricPresets?.find((p) => p.key === s.rubricPresetKey)?.rubric
        : undefined;
      return {
        path: Paths.evaluationSettings(r.tenantId, r.evalSettingsId(s.key)),
        data: {
          id: r.evalSettingsId(s.key),
          name: s.name,
          isDefault: s.isDefault ?? s.key.includes("default"),
          enabledDimensions: rubricDimensions(presetRubric),
          displaySettings: DEFAULT_DISPLAY_SETTINGS,
          // ⚷ canonical confidence gates: low → needs-review threshold, high → auto-approve.
          confidenceConfig: s.confidenceConfig
            ? {
                confidenceThreshold: s.confidenceConfig.lowThreshold,
                autoApproveThreshold: s.confidenceConfig.highThreshold,
                requireReviewForPartialCredit: true,
              }
            : undefined,
          createdBy: SYSTEM_UID,
        },
      };
    });
  }

  private async seedExams(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const exam of tc.exams ?? []) {
      await this.seedExam(r, exam);
    }
  }

  private async seedExam(r: IdResolver, exam: ExamConfig): Promise<void> {
    const tenantId = r.tenantId;
    const examId = r.examId(exam.key);
    const ownerUid = exam.ownerTeacherKey ? r.teacher(exam.ownerTeacherKey).uid : SYSTEM_UID;
    const evaluationSettingsId = exam.evaluationSettingsKey
      ? r.evalSettingsId(exam.evaluationSettingsKey)
      : undefined;

    await this.ctx.ensureDoc("exam", Paths.exam(tenantId, examId), {
      id: examId,
      tenantId,
      title: exam.title,
      subject: exam.subject,
      topics: exam.topics ?? [],
      classIds: r.classIds(exam.classKeys),
      examDate: isoTimestamp(exam.examDate),
      duration: exam.durationMinutes ?? 60,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks ?? Math.round(exam.totalMarks * 0.4),
      academicSessionId: exam.academicSessionKey ? r.sessionId(exam.academicSessionKey) : undefined,
      status: EXAM_STATUS_MAP[exam.status ?? "published"] ?? "published",
      questionPaper: exam.questionPaperImages
        ? {
            images: exam.questionPaperImages,
            extractedAt: null,
            // Seeded questions always carry a rubric (canonicalRubric / holistic
            // fallback below), so the exam is rubric-complete by construction —
            // stamp the grading-eligibility gate field (uploadAnswerSheets
            // FAILED_PRECONDITIONs without it). Deterministic (seed-stable).
            ...(exam.questions && exam.questions.length > 0
              ? { rubricsGeneratedAt: isoTimestamp(exam.examDate) }
              : {}),
            questionCount: exam.questions?.length ?? 0,
            examType: "standard",
          }
        : undefined,
      gradingConfig: {
        autoGrade: true,
        allowRubricEdit: true,
        evaluationSettingsId,
        allowManualOverride: true,
        requireOverrideReason: true,
        releaseResultsAutomatically: false,
      },
      evaluationSettingsId,
      linkedSpaceId: exam.linkedSpaceKey ? r.spaceId(exam.linkedSpaceKey) : undefined,
      linkedStoryPointId:
        exam.linkedSpaceKey && exam.linkedStoryPointKey
          ? r.storyPointId(exam.linkedSpaceKey, exam.linkedStoryPointKey)
          : undefined,
      stats: { totalSubmissions: 0, gradedSubmissions: 0, avgScore: 0, passRate: 0 },
      createdBy: ownerUid,
    });

    let order = 0;
    for (const q of exam.questions ?? []) {
      const qid = r.examQuestionId(exam.key, q.key);
      await this.ctx.ensureDoc("examQuestion", Paths.examQuestion(tenantId, examId, qid), {
        id: qid,
        examId,
        text: q.text,
        imageUrls: q.imageUrls,
        maxMarks: q.maxMarks,
        order: q.order ?? order++,
        questionType: q.questionType ? canonicalQuestionType(q.questionType) : undefined,
        // rubric is REQUIRED on the canonical ExamQuestion — fall back to a holistic scale.
        rubric: q.rubric
          ? canonicalRubric(q.rubric, q.maxMarks)
          : defaultHolisticRubric(q.maxMarks),
        subQuestions: q.subQuestions?.map((sq) => ({
          label: sq.label,
          text: sq.text,
          maxMarks: sq.maxMarks,
          rubric: sq.rubric ? canonicalRubric(sq.rubric, sq.maxMarks) : undefined,
        })),
        extractedAt: null,
      });
    }
  }

  // ── submissions ──

  private async seedSubmissions(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const sub of tc.submissions ?? []) {
      await this.seedSubmission(tc, r, sub);
    }
  }

  private async seedSubmission(
    tc: TenantConfig,
    r: IdResolver,
    sub: SubmissionConfig
  ): Promise<void> {
    const tenantId = r.tenantId;
    const now = this.ctx.clock.now();
    const submissionId = r.submissionId(sub.key);
    const examId = r.examId(sub.examKey);
    const student = r.student(sub.studentKey);
    const uploadedBy = sub.uploadedByKey ? r.uidOf(sub.uploadedByKey) : student.uid;
    const status = sub.status ?? "finalized";
    const pipelineStatus =
      sub.pipelineStatus ?? SUBMISSION_STATUS_TO_PIPELINE[status] ?? "ready_for_review";
    const released = sub.resultsReleased ?? status === "released";
    const questionCount = sub.questionSubmissions?.length ?? 0;
    const gradedCount =
      sub.questionSubmissions?.filter((q) => (q.gradingStatus ?? "graded") === "graded").length ??
      0;

    // summary is REQUIRED (nullable completedAt): pre-grade submissions carry a zeroed block.
    const pct = sub.summary?.percentage ?? 0;
    const summary = {
      totalScore: sub.summary?.totalScore ?? 0,
      maxScore: sub.summary?.maxScore ?? 0,
      percentage: pct,
      grade:
        sub.summary?.grade && GRADE_LETTERS.has(sub.summary.grade)
          ? sub.summary.grade
          : gradeFor(pct),
      questionsGraded: sub.summary?.questionsGraded ?? gradedCount,
      totalQuestions: sub.summary?.totalQuestions ?? questionCount,
      completedAt: sub.summary ? now : null,
    };

    await this.ctx.ensureDoc("submission", Paths.submission(tenantId, submissionId), {
      id: submissionId,
      examId,
      studentId: student.entityId,
      // point-in-time denorm (PC-8) — required strings on the canonical Submission
      studentName: sub.studentName ?? personNameFor(tc, sub.studentKey),
      rollNumber:
        sub.rollNumber ?? tc.students?.find((s) => s.key === sub.studentKey)?.rollNumber ?? "—",
      classId: sub.classKey ? r.classId(sub.classKey) : r.classId("unassigned"),
      answerSheets: {
        images: sub.answerSheetImages ?? [],
        uploadedAt: now,
        uploadedBy,
        uploadSource: sub.uploadSource ?? "web",
      },
      scoutingResult: sub.scoutingResult
        ? {
            routingMap: Object.fromEntries(
              Object.entries(sub.scoutingResult.routingMap ?? {}).map(([qKey, pages]) => [
                r.examQuestionId(sub.examKey, qKey),
                pages,
              ])
            ),
            confidence: Object.fromEntries(
              Object.entries(sub.scoutingResult.confidence ?? {}).map(([qKey, c]) => [
                r.examQuestionId(sub.examKey, qKey),
                c,
              ])
            ),
            completedAt: sub.scoutingResult.completedAt
              ? isoTimestamp(sub.scoutingResult.completedAt)
              : now,
          }
        : undefined,
      summary,
      pipelineStatus,
      pipelineError: sub.pipelineError,
      retryCount: sub.retryCount ?? 0,
      gradingProgress: sub.gradingProgress,
      resultsReleased: released,
      resultsReleasedAt: released ? isoTimestamp(sub.resultsReleasedAt ?? now) : null,
      resultsReleasedBy: sub.resultsReleasedByKey ? r.uidOf(sub.resultsReleasedByKey) : undefined,
    });

    for (const qs of sub.questionSubmissions ?? []) {
      const qid = r.examQuestionId(sub.examKey, qs.questionKey);
      const qsId = seedId("questionSubmission", `${sub.key}/${qs.questionKey}`);
      await this.ctx.ensureDoc(
        "questionSubmission",
        Paths.questionSubmission(tenantId, submissionId, qid),
        {
          id: qsId,
          submissionId,
          questionId: qid,
          examId,
          // mapping (scouting output) is REQUIRED on the canonical QuestionSubmission.
          mapping: {
            pageIndices: qs.mapping?.pageIndices ?? [],
            imageUrls: qs.mapping?.imageUrls ?? [],
            scoutedAt: now,
          },
          gradingStatus: GRADING_STATUS_MAP[qs.gradingStatus ?? "graded"] ?? "graded",
          // ⚷ (score + cost) — server authority; canonical UnifiedEvaluationResult shape.
          evaluation: qs.evaluation ? canonicalEvaluation(qs.evaluation, now) : undefined,
          gradingError: qs.gradingError,
          gradingRetryCount: qs.gradingRetryCount ?? 0,
          manualOverride: qs.manualOverride
            ? {
                score: qs.manualOverride.score,
                reason: qs.manualOverride.reason ?? "Manual override",
                overriddenBy: r.uidOf(qs.manualOverride.by),
                overriddenAt: now,
                originalScore: qs.manualOverride.originalScore ?? qs.manualOverride.score,
              }
            : undefined,
        }
      );
    }
  }

  // ── test sessions ──

  private async seedTestSessions(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const ts of tc.testSessions ?? []) {
      await this.seedTestSession(tc, r, ts);
    }
  }

  /** Config question type of an authored item (for TestSubmission.questionType). */
  private itemQuestionType(
    tc: TenantConfig,
    spaceKey: string,
    storyPointKey: string,
    itemKey: string
  ): string {
    const item = tc.spaces
      ?.find((s) => s.key === spaceKey)
      ?.storyPoints?.find((sp) => sp.key === storyPointKey)
      ?.items?.find((i) => i.key === itemKey);
    return item && item.kind === "question"
      ? canonicalQuestionType((item as QuestionItemConfig).questionType)
      : "text";
  }

  private async seedTestSession(
    tc: TenantConfig,
    r: IdResolver,
    ts: TestSessionConfig
  ): Promise<void> {
    const tenantId = r.tenantId;
    const now = this.ctx.clock.now();
    const sessionId = seedId("testSession", `${r.tenantKey}:${ts.key}`);
    const student = r.student(ts.studentKey);
    const spaceId = r.spaceId(ts.spaceKey);
    const storyPointId = r.storyPointId(ts.spaceKey, ts.storyPointKey);
    const answers = ts.answers ?? [];

    const status = TEST_SESSION_STATUS_MAP[ts.status ?? "submitted"] ?? "completed";
    const startedAt = ts.startedAt ? isoTimestamp(ts.startedAt) : this.ctx.clock.at(-HOUR_MS);
    const serverDeadline = ts.serverDeadline
      ? isoTimestamp(ts.serverDeadline)
      : this.ctx.clock.at(HOUR_MS);
    const submittedAt = ts.submittedAt
      ? isoTimestamp(ts.submittedAt)
      : status === "completed"
        ? now
        : null;
    const endedAt = submittedAt ?? (status === "expired" ? serverDeadline : null);
    const durationMinutes = Math.max(
      1,
      Math.round((Date.parse(serverDeadline) - Date.parse(startedAt)) / 60000)
    );
    const evaluated = answers.filter((a) => a.evaluation);
    const pointsEarned = evaluated.reduce((s, a) => s + (a.evaluation?.score ?? 0), 0);
    const totalPoints = evaluated.reduce((s, a) => s + (a.evaluation?.maxScore ?? 0), 0);

    await this.ctx.ensureDoc(
      "testSession",
      Paths.testSession(tenantId, sessionId),
      {
        id: sessionId,
        tenantId,
        userId: student.uid,
        spaceId,
        storyPointId,
        sessionType: ts.sessionType ?? "timed_test",
        attemptNumber: ts.attemptNumber ?? 1,
        status,
        isLatest: ts.isLatest ?? true,
        startedAt,
        endedAt,
        durationMinutes,
        serverDeadline,
        totalQuestions: answers.length,
        answeredQuestions: answers.length,
        // small inline records kept on the doc (D6)
        visitedQuestions: {},
        markedForReview: {},
        ...(evaluated.length ? { pointsEarned, totalPoints } : {}),
        submittedAt,
      },
      { stampAudit: true }
    );

    // per-item answers → submissions/{itemId} subcollection (always-subcollection, D6)
    for (const ans of answers) {
      const itemId = r.itemId(ts.spaceKey, ts.storyPointKey, ans.itemKey);
      await this.ctx.ensureDoc(
        "testSession",
        Paths.testSubmission(tenantId, sessionId, itemId),
        {
          itemId,
          questionType: this.itemQuestionType(tc, ts.spaceKey, ts.storyPointKey, ans.itemKey),
          answer: ans.answer,
          submittedAt: submittedAt ?? now,
          // StoredEvaluation: answer+cost-stripped client projection (canonical shape)
          evaluation: ans.evaluation
            ? canonicalEvaluation(
                { ...ans.evaluation, feedback: ans.evaluation.feedback },
                submittedAt ?? now
              )
            : undefined,
          correct: ans.evaluation?.correct,
          ...(ans.evaluation
            ? { pointsEarned: ans.evaluation.score, totalPoints: ans.evaluation.maxScore }
            : {}),
        },
        { stampAudit: false }
      );
    }
  }

  // ── progress + summaries ──

  private async seedProgress(tc: TenantConfig, r: IdResolver): Promise<void> {
    const now = this.ctx.clock.now();
    for (const p of tc.progress ?? []) {
      await this.seedSpaceProgress(r, p);
    }
    // class + student summaries are derived; emit a canonical zeroed rollup per student that
    // has progress (StudentProgressSummary requires the full autograde/levelup blocks).
    const studentsWithProgress = new Set((tc.progress ?? []).map((p) => p.studentKey));
    for (const studentKey of studentsWithProgress) {
      const student = r.student(studentKey);
      const rows = (tc.progress ?? []).filter((p) => p.studentKey === studentKey);
      const avgPct = rows.length
        ? Math.round(rows.reduce((s, p) => s + (p.overallPercentage ?? 0), 0) / rows.length)
        : 0;
      await this.ctx.ensureDoc(
        "studentSummary",
        Paths.studentProgressSummary(r.tenantId, student.entityId),
        {
          id: student.entityId,
          tenantId: r.tenantId,
          studentId: student.entityId,
          autograde: {
            totalExams: 0,
            completedExams: 0,
            averageScore: 0,
            averagePercentage: 0,
            totalMarksObtained: 0,
            totalMarksAvailable: 0,
            subjectBreakdown: {},
            recentExams: [],
          },
          levelup: {
            totalSpaces: rows.length,
            completedSpaces: rows.filter((p) => (p.overallPercentage ?? 0) >= 100).length,
            averageCompletion: avgPct,
            totalPointsEarned: rows.reduce((s, p) => s + (p.pointsEarned ?? 0), 0),
            totalPointsAvailable: rows.reduce((s, p) => s + (p.totalPoints ?? 0), 0),
            averageAccuracy: avgPct,
            streakDays: 0,
            subjectBreakdown: {},
            recentActivity: [],
          },
          overallScore: avgPct,
          isAtRisk: false,
          lastUpdatedAt: now,
        },
        { stampAudit: false }
      );
    }
  }

  private async seedSpaceProgress(r: IdResolver, p: SpaceProgressConfig): Promise<void> {
    const tenantId = r.tenantId;
    const now = this.ctx.clock.now();
    const student = r.student(p.studentKey);
    const spaceId = r.spaceId(p.spaceKey);
    const docId = spaceProgressId(student.uid, spaceId); // D13 keyed userId_spaceId

    // bounded summary: one numeric block per story point (no nested per-item state, D6)
    const storyPoints: Record<string, unknown> = {};
    for (const sp of p.storyPoints ?? []) {
      const spId = r.storyPointId(p.spaceKey, sp.storyPointKey);
      // canonical StoryPointProgressSchema embed: storyPointId + percentage +
      // nullable completedAt are required (read mapper also backfills defensively).
      const pct = sp.totalPoints > 0 ? Math.round((sp.pointsEarned / sp.totalPoints) * 100) : 0;
      const spStatus = sp.status ?? "in_progress";
      storyPoints[spId] = {
        storyPointId: spId,
        status: spStatus,
        completedItems: sp.completedItems,
        totalItems: sp.totalItems,
        pointsEarned: sp.pointsEarned,
        totalPoints: sp.totalPoints,
        percentage: pct,
        completedAt: spStatus === "completed" ? now : null,
      };
    }

    const overallPct = p.overallPercentage ?? 0;
    // canonical SpaceProgress carries NO audit-by fields and no createdAt — updatedAt only.
    await this.ctx.ensureDoc(
      "spaceProgress",
      Paths.spaceProgress(tenantId, student.uid, spaceId),
      {
        id: docId,
        userId: student.uid, // D13
        tenantId,
        spaceId,
        status: overallPct >= 100 ? "completed" : overallPct > 0 ? "in_progress" : "not_started",
        pointsEarned: p.pointsEarned ?? 0,
        totalPoints: p.totalPoints ?? 0,
        percentage: overallPct,
        storyPoints,
        startedAt: now,
        completedAt: overallPct >= 100 ? now : null,
        updatedAt: now,
      },
      { stampAudit: false }
    );

    // per-story-point progress docs (D6 — per-item docs, not a fat record-map)
    for (const sp of p.storyPoints ?? []) {
      const spId = r.storyPointId(p.spaceKey, sp.storyPointKey);
      const pct = sp.totalPoints > 0 ? Math.round((sp.pointsEarned / sp.totalPoints) * 100) : 0;
      const spStatus = sp.status ?? "in_progress";
      await this.ctx.ensureDoc(
        "storyPointProgress",
        Paths.storyPointProgress(tenantId, student.uid, spaceId, spId),
        {
          storyPointId: spId,
          status: spStatus,
          pointsEarned: sp.pointsEarned,
          totalPoints: sp.totalPoints,
          percentage: pct,
          completedItems: sp.completedItems,
          totalItems: sp.totalItems,
          completedAt: spStatus === "completed" ? now : null,
          updatedAt: now,
        },
        { stampAudit: false }
      );
    }
  }

  // ── gamification ──

  /** Achievement catalog. Returns key→canonical doc (StudentAchievement embeds it verbatim). */
  private async seedAchievements(
    tc: TenantConfig,
    r: IdResolver
  ): Promise<Map<string, Record<string, unknown>>> {
    const docs = new Map<string, Record<string, unknown>>();
    const now = this.ctx.clock.now();
    for (const a of tc.achievements ?? []) {
      const doc = canonicalAchievement(
        a,
        { id: r.achievementId(a.key), tenantId: r.tenantId },
        now
      );
      docs.set(a.key, doc);
      await this.ctx.ensureDoc(
        "achievement",
        Paths.achievement(r.tenantId, r.achievementId(a.key)),
        doc
      );
    }
    return docs;
  }

  private async seedStudentGamification(
    tc: TenantConfig,
    r: IdResolver,
    achievementDocs: Map<string, Record<string, unknown>>
  ): Promise<void> {
    for (const g of tc.studentGamification ?? []) {
      await this.seedOneStudentGamification(r, g, achievementDocs);
    }
  }

  private async seedOneStudentGamification(
    r: IdResolver,
    g: StudentGamificationConfig,
    achievementDocs: Map<string, Record<string, unknown>>
  ): Promise<void> {
    const tenantId = r.tenantId;
    const now = this.ctx.clock.now();
    const student = r.student(g.studentKey);
    const uid = student.uid;

    if (g.level) {
      const tier = g.level.tier ?? "bronze";
      // canonical StudentLevel: XP triple + achievementCount; streaks live on the levelup
      // summary, not here — updatedAt only, no audit-by.
      await this.ctx.ensureDoc(
        "studentLevel",
        Paths.studentLevel(tenantId, uid),
        {
          id: uid,
          tenantId,
          userId: uid,
          level: g.level.level,
          currentXP: g.level.xp,
          xpToNextLevel: Math.max(0, g.level.level * 1000 - g.level.xp),
          totalXP: g.level.xp,
          tier,
          achievementCount: g.unlockedAchievementKeys?.length ?? 0,
          updatedAt: now,
        },
        { stampAudit: false }
      );
    }

    for (const achKey of g.unlockedAchievementKeys ?? []) {
      const achId = r.achievementId(achKey);
      // StudentAchievement embeds the FULL canonical achievement doc (denorm read model).
      const achievement =
        achievementDocs.get(achKey) ??
        canonicalAchievement({ key: achKey, name: achKey }, { id: achId, tenantId }, now);
      await this.ctx.ensureDoc(
        "studentAchievement",
        Paths.studentAchievement(tenantId, uid, achId),
        {
          id: `${uid}_${achId}`,
          tenantId,
          userId: uid,
          achievementId: achId,
          achievement,
          earnedAt: now,
          seen: false,
        },
        { stampAudit: false }
      );
    }

    for (const goal of g.studyGoals ?? []) {
      const goalId = seedId("studyGoal", `${r.tenantKey}:${g.studentKey}:${goal.key}`);
      const completed = goal.completed ?? false;
      await this.ctx.ensureDoc("studyGoal", Paths.studyGoal(tenantId, uid, goalId), {
        id: goalId,
        tenantId,
        userId: uid,
        title: goal.title,
        targetType: GOAL_TARGET_TYPE_MAP[goal.targetType] ?? "items",
        targetCount: goal.targetCount,
        currentCount: goal.currentCount ?? 0, // server-owned
        // canonical StudyGoal dates are zIsoDate (YYYY-MM-DD), not timestamps.
        startDate: goal.startDate,
        endDate: goal.endDate,
        completed, // server-owned
        completedAt: completed ? now : null,
        archivedAt: null,
      });
    }

    for (const ss of g.studySessions ?? []) {
      const ssId = seedId("studySession", `${r.tenantKey}:${g.studentKey}:${ss.key}`);
      // canonical StudySession is timestamp-less (keyed by IsoDate `date`).
      await this.ctx.ensureDoc(
        "studySession",
        Paths.studySession(tenantId, uid, ssId),
        {
          id: ssId,
          tenantId,
          userId: uid,
          date: ss.date, // IsoDate
          minutesStudied: ss.minutes,
          spacesWorked: [],
          itemsCompleted: ss.itemsCompleted ?? 0,
          pointsEarned: 0,
        },
        { stampAudit: false }
      );
    }
  }

  // ── notifications / announcements / insights / cost ──

  private async seedAnnouncements(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const a of tc.announcements ?? []) {
      await this.seedAnnouncement(tc, r, a);
    }
  }

  private async seedAnnouncement(
    tc: TenantConfig,
    r: IdResolver,
    a: AnnouncementConfig
  ): Promise<void> {
    const tenantId = r.tenantId;
    const now = this.ctx.clock.now();
    const id = seedId("announcement", `${r.tenantKey}:${a.key}`);
    const authorUid = a.authorKey ? r.uidOf(a.authorKey) : SYSTEM_UID;
    const status = a.status ?? "published";
    await this.ctx.ensureDoc("announcement", Paths.announcement(tenantId, id), {
      id,
      tenantId,
      title: a.title,
      body: a.body,
      authorUid,
      authorName: personNameFor(tc, a.authorKey),
      // class/role narrowing is expressed by targetClassIds/targetRoles — scope stays 'tenant'.
      scope: ANNOUNCEMENT_SCOPE_MAP[a.scope ?? "tenant"] ?? "tenant",
      targetRoles: a.targetRoles?.filter((role) => ANNOUNCEMENT_TARGET_ROLES.has(role)),
      targetClassIds: r.classIds(a.targetClassKeys),
      status,
      publishedAt: status === "published" ? now : null,
      archivedAt: status === "archived" ? now : null,
      expiresAt: null,
      // readBy[] removed (CD8) — read-state lives in /reads/{uid}
    });
    for (const readerKey of a.readByKeys ?? []) {
      const uid = r.uidOf(readerKey);
      await this.ctx.ensureDoc("announcement", Paths.announcementRead(tenantId, id, uid), {
        uid,
        readAt: now,
      });
    }
  }

  private async seedNotifications(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const n of tc.notifications ?? []) {
      await this.seedNotification(tc, r, n);
    }
  }

  private async seedNotification(
    tc: TenantConfig,
    r: IdResolver,
    n: NotificationConfig
  ): Promise<void> {
    const tenantId = r.tenantId;
    const now = this.ctx.clock.now();
    const id = seedId("notification", `${r.tenantKey}:${n.key}`);
    const recipientUid = r.uidOf(n.recipientKey);
    const isRead = n.isRead ?? false;
    // canonical Notification: closed type enum, required recipientRole, required-null readAt,
    // createdAt only (no updatedAt), no free-form payload.
    await this.ctx.ensureDoc(
      "notification",
      Paths.notification(tenantId, id),
      {
        id,
        tenantId,
        recipientUid, // canonical (D3/D12)
        recipientRole: recipientRoleFor(tc, n.recipientKey),
        type: NOTIFICATION_TYPE_MAP[n.type] ?? "system_announcement",
        title: n.title,
        body: n.body ?? "",
        isRead,
        readAt: isRead ? now : null,
        createdAt: now,
      },
      { stampAudit: false }
    );
  }

  private async seedInsights(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.insights?.length) return;
    const now = this.ctx.clock.now();
    await this.ctx.ensureCollection(
      "insight",
      tc.insights,
      (i) => {
        const student = r.student(i.studentKey);
        const id = seedId("insight", `${r.tenantKey}:${i.key}`);
        const mapped = INSIGHT_MAP[i.type] ?? INSIGHT_MAP.at_risk_intervention!;
        return {
          path: Paths.insight(r.tenantId, id),
          data: {
            id,
            tenantId: r.tenantId,
            studentId: student.entityId,
            type: mapped.type,
            priority: INSIGHT_PRIORITY_MAP[i.severity ?? "info"] ?? "low",
            title: mapped.title,
            description: i.message,
            actionType: mapped.actionType,
            createdAt: now,
            dismissedAt: (i.dismissed ?? false) ? now : null,
          },
        };
      },
      { stampAudit: false }
    );
  }

  private async seedCostSummaries(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const c of tc.costSummaries ?? []) {
      await this.seedCostSummary(r, c);
    }
  }

  private async seedCostSummary(r: IdResolver, c: CostSummaryConfig): Promise<void> {
    const tenantId = r.tenantId;
    const now = this.ctx.clock.now();
    const breakdown = canonicalCostBreakdown(c);
    const daily = c.granularity === "daily";
    const data = {
      id: daily ? `daily_${c.period}` : `monthly_${c.period}`,
      tenantId,
      ...(daily ? { date: c.period } : { month: c.period }),
      totalCalls: c.callCount,
      totalInputTokens: breakdown.totalInputTokens,
      totalOutputTokens: breakdown.totalOutputTokens,
      totalCostUsd: c.totalUsd,
      byPurpose: breakdown.byPurpose,
      byModel: breakdown.byModel,
      computedAt: now,
    };
    const path = daily
      ? Paths.dailyCostSummary(tenantId, c.period)
      : Paths.monthlyCostSummary(tenantId, c.period);
    await this.ctx.ensureDoc("costSummary", path, data, { stampAudit: false });
  }
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export { DAY_MS };
