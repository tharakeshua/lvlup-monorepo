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
import type {
  AnnouncementConfig,
  CostSummaryConfig,
  ExamConfig,
  InsightConfig,
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
  UnifiedRubricInput,
} from "../config/types.js";

const SYSTEM_UID = "seed-system";

export class SeedPipeline {
  private readonly log;

  constructor(private readonly ctx: SeedContext) {
    this.log = ctx.logger.child("pipeline");
  }

  /** Audit-fill helper: createdBy/updatedBy default to a stable system actor. */
  private audit(createdBy = SYSTEM_UID): {
    createdBy: string;
    updatedBy: string;
    archivedAt: null;
  } {
    return { createdBy, updatedBy: createdBy, archivedAt: null };
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
        ...this.audit(uid),
      });
    }
    await this.ctx.flush();
  }

  private async seedGlobalPresets(
    presets: NonNullable<SeedConfig["globalEvaluationPresets"]>
  ): Promise<void> {
    await this.ctx.ensureCollection("globalPreset", presets, (p) => ({
      path: Paths.globalPreset(seedId("globalPreset", p.key)),
      data: {
        id: seedId("globalPreset", p.key),
        name: p.name,
        description: p.description,
        rubric: p.rubric ? this.serializeRubric(p.rubric) : undefined,
        status: p.status ?? "active",
        ...this.audit(),
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

    // 1) tenant doc + code index
    await this.seedTenantDoc(tc, r);

    // 2) academic sessions + classes (shells first; denorm filled after people resolve)
    await this.seedAcademicSessions(tc, r);

    // 3) register all people (resolve uids/ids) BEFORE writing, so cross-links resolve
    this.registerPeople(tc, r);

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

    // 11) gamification
    await this.seedAchievements(tc, r);
    await this.seedStudentGamification(tc, r);

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
    await this.ctx.ensureDoc("tenant", Paths.tenant(tenantId), {
      id: tenantId,
      name: tc.name,
      code: tc.code,
      slug: tc.slug ?? slug(tc.name),
      status: tc.status ?? "active",
      plan: tc.plan ?? "premium",
      contact: tc.contact ?? { email: `admin@${slug(tc.name)}.edu` },
      settings: { defaultLanguage: "en", timezone: "Asia/Kolkata", ...tc.settings },
      features: tc.features ?? {},
      branding: tc.branding ?? {},
      geminiKeyRef: tc.geminiKeyRef,
      stats: {
        totalStudents: tc.students?.length ?? 0,
        totalTeachers: tc.teachers?.length ?? 0,
        totalClasses: tc.classes?.length ?? 0,
        totalSpaces: tc.spaces?.length ?? 0,
      },
      ...this.audit(),
    });
    // tenant code index doc
    await this.ctx.ensureDoc("tenant", Paths.tenantCode(tc.code), {
      tenantId,
      code: tc.code,
      createdAt: this.ctx.clock.now(),
    });
  }

  private async seedAcademicSessions(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.academicSessions?.length) return;
    await this.ctx.ensureCollection("academicSession", tc.academicSessions, (s) => ({
      path: Paths.academicSession(r.tenantId, r.sessionId(s.key)),
      data: {
        id: r.sessionId(s.key),
        tenantId: r.tenantId,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        isCurrent: s.isCurrent ?? false,
        status: s.status ?? "active",
        ...this.audit(),
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

    // Admins
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
        isAdmin: true,
        status: "active",
        ...this.audit(person.uid),
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
        status: t.status ?? "active",
        ...this.audit(person.uid),
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
        authUid: s.noAccount ? null : person.uid,
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        displayName: s.displayName ?? `${s.firstName} ${s.lastName}`,
        rollNumber: s.rollNumber,
        grade: s.grade,
        classIds: r.classIds(s.classKeys),
        status: s.status ?? "active",
        ...this.audit(person.uid),
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
      const childNames = (p.studentKeys ?? []).map((k) => k);
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
        status: p.status ?? "active",
        ...this.audit(person.uid),
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
        status: s.status ?? "active",
        ...this.audit(person.uid),
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
        label: sc.label,
        email: sc.email,
        status: sc.status ?? "active",
        ...this.audit(person.uid),
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
      displayName: acc.displayName,
      photoURL: acc.photoURL,
      authProviders: ["email"],
      isSuperAdmin: false,
      activeTenantId,
      status: "active",
      ...this.audit(person.uid),
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

    // membership doc (⚷ admin-SDK write only)
    const mid = membershipId(person.uid, tenantId);
    await this.ctx.ensureDoc("membership", Paths.membership(person.uid, tenantId), {
      id: mid,
      uid: person.uid,
      tenantId,
      tenantCode,
      role,
      status: "active",
      joinSource: "seed",
      teacherId: extra.teacherId,
      studentId: extra.studentId,
      parentId: extra.parentId,
      staffId: extra.staffId,
      scannerId: extra.scannerId,
      permissions: {
        ...(extra.permissions ?? {}),
        managedClassIds: extra.managedClassIds ?? [],
      },
      staffPermissions: extra.staffPermissions,
      parentLinkedStudentIds: extra.parentLinkedStudentIds,
      ...this.audit(person.uid),
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
          schedule: c.schedule,
          status: c.status ?? "active",
          ...this.audit(),
        },
      };
    });
  }

  // ── content ──

  private async seedAgents(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.agents?.length) return;
    await this.ctx.ensureCollection("agent", tc.agents, (a) => ({
      path: Paths.agent(r.tenantId, r.agentId(a.key)),
      data: {
        id: r.agentId(a.key),
        tenantId: r.tenantId,
        name: a.name,
        purpose: a.purpose,
        systemPrompt: a.systemPrompt, // ⚷ authoring-only
        rules: a.rules ?? [],
        model: a.model ?? "gemini-2.0-flash",
        isActive: a.isActive ?? true,
        ...this.audit(),
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
        rubric: this.serializeRubric(p.rubric),
        ...this.audit(),
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
        questionType: q.questionType,
        prompt: q.prompt,
        options: q.options,
        points: q.points ?? 1,
        // NOTE: bank items also carry their answer in-line for authoring; clients never read it.
        answer: q.answer,
        tags: q.tags ?? [],
        usageCount: 0,
        ...this.audit(),
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
      const storyPointDoc = {
        id: storyPointId,
        tenantId,
        spaceId,
        title: sp.title,
        description: sp.description,
        type: sp.type ?? "standard",
        // canonical StoryPointSchema: `orderIndex` (int, required); legacy `order` +
        // `durationSeconds` are NOT schema keys (the read mapper also drops them).
        orderIndex: sp.order ?? spOrder++,
        stats: { itemCount: items.length, completionCount: 0 },
        ...this.audit(ownerUid),
      };
      // CANONICAL doc: the runtime (saveStoryPoint / listStoryPoints / getStoryPoint via
      // `entity('storyPoints')`) reads the FLAT `tenants/{t}/storyPoints/{id}` collection.
      // Items remain nested under `spaces/{s}/storyPoints/{sp}/items` (found via collection
      // group), so the nested storyPoint doc is only kept as a harmless mirror.
      await this.ctx.ensureDoc(
        "storyPoint",
        `${Paths.tenant(tenantId)}/storyPoints/${storyPointId}`,
        storyPointDoc
      );
      await this.ctx.ensureDoc(
        "storyPoint",
        Paths.storyPoint(tenantId, spaceId, storyPointId),
        storyPointDoc
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
        // canonical UnifiedItemSchema: `orderIndex` (int, required) — legacy `order`
        // is renamed by the read mapper too (belt-and-suspenders).
        orderIndex: item.order ?? order,
        // two-level discriminated payload union: { kind:'material', payload:{ type, ... } }
        payload: {
          kind: "material",
          materialType: item.materialType,
          title: item.title,
          body: item.body,
          url: item.url,
          durationSeconds: item.durationSeconds,
        },
        ...this.audit(ownerUid),
      });
      return;
    }

    // question item — strip the answer into the server-only subcollection
    const q = item as QuestionItemConfig;
    const rubricSnapshot = this.resolveRubricSnapshot(r, q);

    await this.ctx.ensureDoc("item", Paths.item(tenantId, spaceId, storyPointId, itemId), {
      id: itemId,
      tenantId,
      spaceId,
      storyPointId,
      // canonical UnifiedItemSchema: `orderIndex` (int, required).
      orderIndex: q.order ?? order,
      // answer-stripped payload (client-facing)
      payload: {
        kind: "question",
        questionType: q.questionType,
        prompt: q.prompt,
        options: q.options,
        points: q.points ?? 1,
      },
      // resolve-and-store at write (no grade-time settings re-read)
      rubricId: rubricSnapshot.rubricId,
      effectiveRubric: rubricSnapshot.effectiveRubric,
      ...this.audit(ownerUid),
    });

    // server-only AnswerKey (§6.4) — deny-all subcollection
    const keyId = seedId("answerKey", `${spaceKey}/${spKey}/${item.key}`);
    await this.ctx.ensureDoc(
      "answerKey",
      Paths.answerKey(tenantId, spaceId, storyPointId, itemId, keyId),
      {
        id: keyId,
        itemId,
        questionType: q.questionType,
        correctAnswer: q.answer.correctAnswer,
        acceptableAnswers: q.answer.acceptableAnswers,
        evaluationGuidance: q.answer.evaluationGuidance, // ⚷
        modelAnswer: q.answer.modelAnswer, // ⚷
        ...this.audit(ownerUid),
      }
    );
  }

  private resolveRubricSnapshot(
    r: IdResolver,
    q: QuestionItemConfig
  ): { rubricId?: string; effectiveRubric?: Record<string, unknown> } {
    if (q.rubricPresetKey) {
      return {
        rubricId: r.rubricPresetId(q.rubricPresetKey),
        effectiveRubric: undefined, // snapshot resolved from preset; preset doc is the source
      };
    }
    if (q.rubric) {
      return { rubricId: undefined, effectiveRubric: this.serializeRubric(q.rubric) };
    }
    return {};
  }

  private serializeRubric(rb: UnifiedRubricInput): Record<string, unknown> {
    return {
      dimensions: rb.dimensions ?? [],
      totalPoints: rb.totalPoints ?? 0,
      passingScore: rb.passingScore,
      modelAnswer: rb.modelAnswer, // ⚷
      evaluatorGuidance: rb.evaluatorGuidance, // ⚷
    };
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
        rating: rev.rating,
        comment: rev.comment,
        ...this.audit(reviewerUid),
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
      const preview = messages.length > 0 ? messages[messages.length - 1]!.text : undefined;
      await this.ctx.ensureDoc("chatSession", Paths.chatSession(r.tenantId, sessionId), {
        id: sessionId,
        tenantId: r.tenantId,
        userId: ownerUid,
        spaceId: r.spaceId(cs.spaceKey),
        storyPointId:
          cs.storyPointKey != null ? r.storyPointId(cs.spaceKey, cs.storyPointKey) : undefined,
        itemId:
          cs.itemKey != null && cs.storyPointKey != null
            ? r.itemId(cs.spaceKey, cs.storyPointKey, cs.itemKey)
            : undefined,
        agentId: cs.agentKey != null ? r.agentId(cs.agentKey) : undefined,
        sessionTitle: cs.title ?? "Tutor Session",
        previewMessage: preview,
        messageCount: messages.length, // ⚷ denormalized counter
        language: cs.language ?? "en",
        isActive: cs.isActive ?? true,
        systemPrompt: cs.systemPrompt, // ⚷ authoring-only
        ...this.audit(ownerUid),
      });

      let order = 0;
      for (const m of messages) {
        const msgId = seedId("chatMessage", `${r.tenantKey}:${cs.key}:${m.key}`);
        await this.ctx.ensureDoc("chatMessage", Paths.chatMessage(r.tenantId, sessionId, msgId), {
          id: msgId,
          role: m.role,
          text: m.text,
          order: order++,
          timestamp: m.timestamp ?? this.ctx.clock.now(),
          mediaUrls: m.mediaUrls,
          tokensUsed: m.tokensUsed, // ⚷
        });
      }
    }
  }

  // ── exams ──

  private async seedEvaluationSettings(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.evaluationSettings?.length) return;
    await this.ctx.ensureCollection("evaluationSettings", tc.evaluationSettings, (s) => ({
      path: Paths.evaluationSettings(r.tenantId, r.evalSettingsId(s.key)),
      data: {
        id: r.evalSettingsId(s.key),
        tenantId: r.tenantId,
        name: s.name,
        confidenceConfig: s.confidenceConfig, // ⚷
        autoReleaseThreshold: s.autoReleaseThreshold,
        rubricId: s.rubricPresetKey ? r.rubricPresetId(s.rubricPresetKey) : undefined,
        ...this.audit(),
      },
    }));
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

    await this.ctx.ensureDoc("exam", Paths.exam(tenantId, examId), {
      id: examId,
      tenantId,
      title: exam.title,
      subject: exam.subject,
      topics: exam.topics ?? [],
      classIds: r.classIds(exam.classKeys),
      examDate: exam.examDate,
      duration: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      academicSessionId: exam.academicSessionKey ? r.sessionId(exam.academicSessionKey) : undefined,
      status: exam.status ?? "published",
      questionPaper: exam.questionPaperImages
        ? {
            images: exam.questionPaperImages,
            questionCount: exam.questions?.length ?? 0,
            examType: "standard",
          }
        : undefined,
      evaluationSettingsId: exam.evaluationSettingsKey
        ? r.evalSettingsId(exam.evaluationSettingsKey)
        : undefined,
      linkedSpaceId: exam.linkedSpaceKey ? r.spaceId(exam.linkedSpaceKey) : undefined,
      linkedStoryPointId:
        exam.linkedSpaceKey && exam.linkedStoryPointKey
          ? r.storyPointId(exam.linkedSpaceKey, exam.linkedStoryPointKey)
          : undefined,
      stats: { submissionCount: 0, gradedCount: 0 },
      ...this.audit(ownerUid),
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
        questionType: q.questionType,
        rubric: q.rubric ? this.serializeRubric(q.rubric) : undefined, // ⚷ guidance projected out for non-authoring
        linkedItemId: undefined,
        subQuestions: q.subQuestions?.map((sq) => ({
          label: sq.label,
          text: sq.text,
          maxMarks: sq.maxMarks,
          rubric: sq.rubric ? this.serializeRubric(sq.rubric) : undefined,
        })),
        ...this.audit(ownerUid),
      });
    }
  }

  // ── submissions ──

  private async seedSubmissions(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const sub of tc.submissions ?? []) {
      await this.seedSubmission(r, sub);
    }
  }

  private async seedSubmission(r: IdResolver, sub: SubmissionConfig): Promise<void> {
    const tenantId = r.tenantId;
    const submissionId = r.submissionId(sub.key);
    const examId = r.examId(sub.examKey);
    const student = r.student(sub.studentKey);
    const uploadedBy = sub.uploadedByKey ? r.uidOf(sub.uploadedByKey) : student.uid;

    await this.ctx.ensureDoc("submission", Paths.submission(tenantId, submissionId), {
      id: submissionId,
      tenantId,
      examId,
      studentId: student.entityId,
      classId: sub.classKey ? r.classId(sub.classKey) : undefined,
      uploadSource: sub.uploadSource ?? "web",
      uploadedBy,
      status: sub.status ?? "finalized",
      // point-in-time denorm (PC-8)
      studentName: sub.studentName,
      rollNumber: sub.rollNumber,
      answerSheet: sub.answerSheetImages ? { images: sub.answerSheetImages } : undefined,
      // released summary only when released (⚷ until then)
      summary: sub.status === "released" ? sub.summary : undefined,
      ...this.audit(uploadedBy),
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
          gradingStatus: qs.gradingStatus ?? "graded",
          evaluation: qs.evaluation, // ⚷ (score + cost) — server authority
          manualOverride: qs.manualOverride,
          ...this.audit(uploadedBy),
        }
      );
    }
  }

  // ── test sessions ──

  private async seedTestSessions(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const ts of tc.testSessions ?? []) {
      await this.seedTestSession(r, ts);
    }
  }

  private async seedTestSession(r: IdResolver, ts: TestSessionConfig): Promise<void> {
    const tenantId = r.tenantId;
    const sessionId = seedId("testSession", `${r.tenantKey}:${ts.key}`);
    const student = r.student(ts.studentKey);
    const spaceId = r.spaceId(ts.spaceKey);
    const storyPointId = r.storyPointId(ts.spaceKey, ts.storyPointKey);

    await this.ctx.ensureDoc("testSession", Paths.testSession(tenantId, sessionId), {
      id: sessionId,
      tenantId,
      userId: student.uid,
      studentId: student.entityId,
      spaceId,
      storyPointId,
      sessionType: ts.sessionType ?? "timed_test",
      status: ts.status ?? "submitted",
      serverDeadline: ts.serverDeadline ?? this.ctx.clock.at(HOUR_MS),
      attemptNumber: ts.attemptNumber ?? 1,
      isLatest: ts.isLatest ?? true,
      startedAt: ts.startedAt ?? this.ctx.clock.at(-HOUR_MS),
      submittedAt: ts.submittedAt ?? this.ctx.clock.now(),
      // small inline booleans kept on the doc (D6)
      visitedQuestions: {},
      markedForReview: {},
      ...this.audit(student.uid),
    });

    // per-item answers → submissions/{itemId} subcollection (always-subcollection, D6)
    for (const ans of ts.answers ?? []) {
      const itemId = r.itemId(ts.spaceKey, ts.storyPointKey, ans.itemKey);
      await this.ctx.ensureDoc("testSession", Paths.testSubmission(tenantId, sessionId, itemId), {
        itemId,
        answer: ans.answer,
        markedForReview: ans.markedForReview ?? false,
        // StoredEvaluation: answer+cost-stripped client projection
        evaluation: ans.evaluation,
        ...this.audit(student.uid),
      });
    }
  }

  // ── progress + summaries ──

  private async seedProgress(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const p of tc.progress ?? []) {
      await this.seedSpaceProgress(r, p);
    }
    // class + student summaries are derived; emit a minimal rollup per student that has progress
    const studentsWithProgress = new Set((tc.progress ?? []).map((p) => p.studentKey));
    for (const studentKey of studentsWithProgress) {
      const student = r.student(studentKey);
      await this.ctx.ensureDoc(
        "studentSummary",
        Paths.studentProgressSummary(r.tenantId, student.entityId),
        {
          studentId: student.entityId,
          tenantId: r.tenantId,
          overallScore: 0,
          spacesInProgress: (tc.progress ?? []).filter((p) => p.studentKey === studentKey).length,
          teacherUids: [],
          parentUids: [],
          ...this.audit(student.uid),
        }
      );
    }
  }

  private async seedSpaceProgress(r: IdResolver, p: SpaceProgressConfig): Promise<void> {
    const tenantId = r.tenantId;
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
        completedAt: spStatus === "completed" ? this.ctx.clock.now() : null,
      };
    }

    const overallPct = p.overallPercentage ?? 0;
    await this.ctx.ensureDoc("spaceProgress", Paths.spaceProgress(tenantId, student.uid, spaceId), {
      id: docId,
      tenantId,
      userId: student.uid, // D13
      studentId: student.entityId,
      spaceId,
      // canonical SpaceProgressSchema view keys: `status` + `percentage` +
      // nullable started/completed timestamps (read mapper canonicalizes too).
      status: overallPct >= 100 ? "completed" : overallPct > 0 ? "in_progress" : "not_started",
      storyPoints,
      percentage: overallPct,
      overallPercentage: overallPct,
      pointsEarned: p.pointsEarned ?? 0,
      totalPoints: p.totalPoints ?? 0,
      startedAt: this.ctx.clock.now(),
      completedAt: overallPct >= 100 ? this.ctx.clock.now() : null,
      ...this.audit(student.uid),
    });

    // per-story-point progress docs (D6 — per-item docs, not a fat record-map)
    for (const sp of p.storyPoints ?? []) {
      const spId = r.storyPointId(p.spaceKey, sp.storyPointKey);
      await this.ctx.ensureDoc(
        "storyPointProgress",
        Paths.storyPointProgress(tenantId, student.uid, spId),
        {
          userId: student.uid,
          storyPointId: spId,
          spaceId,
          completedItems: sp.completedItems,
          totalItems: sp.totalItems,
          pointsEarned: sp.pointsEarned,
          totalPoints: sp.totalPoints,
          status: sp.status ?? "in_progress",
          ...this.audit(student.uid),
        }
      );
    }
  }

  // ── gamification ──

  private async seedAchievements(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.achievements?.length) return;
    await this.ctx.ensureCollection("achievement", tc.achievements, (a) => ({
      path: Paths.achievement(r.tenantId, r.achievementId(a.key)),
      data: {
        id: r.achievementId(a.key),
        tenantId: r.tenantId,
        name: a.name,
        description: a.description,
        tier: a.tier ?? "bronze",
        category: a.category,
        criteria: a.criteria,
        isActive: a.isActive ?? true,
        ...this.audit(),
      },
    }));
  }

  private async seedStudentGamification(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const g of tc.studentGamification ?? []) {
      await this.seedOneStudentGamification(r, g);
    }
  }

  private async seedOneStudentGamification(
    r: IdResolver,
    g: StudentGamificationConfig
  ): Promise<void> {
    const tenantId = r.tenantId;
    const student = r.student(g.studentKey);
    const uid = student.uid;

    if (g.level) {
      await this.ctx.ensureDoc("studentLevel", Paths.studentLevel(tenantId, uid), {
        userId: uid,
        level: g.level.level,
        xp: g.level.xp,
        tier: g.level.tier ?? "bronze",
        streakDays: g.streakDays ?? 0,
        longestStreak: g.longestStreak ?? 0,
        ...this.audit(uid),
      });
    }

    for (const achKey of g.unlockedAchievementKeys ?? []) {
      const achId = r.achievementId(achKey);
      await this.ctx.ensureDoc(
        "studentAchievement",
        Paths.studentAchievement(tenantId, uid, achId),
        {
          id: `${uid}_${achId}`,
          userId: uid,
          achievementId: achId,
          unlockedAt: this.ctx.clock.now(),
          seen: false,
          ...this.audit(uid),
        }
      );
    }

    for (const goal of g.studyGoals ?? []) {
      const goalId = seedId("studyGoal", `${r.tenantKey}:${g.studentKey}:${goal.key}`);
      await this.ctx.ensureDoc("studyGoal", Paths.studyGoal(tenantId, uid, goalId), {
        id: goalId,
        userId: uid,
        title: goal.title,
        targetType: goal.targetType,
        targetCount: goal.targetCount,
        startDate: goal.startDate,
        endDate: goal.endDate,
        currentCount: goal.currentCount ?? 0, // server-owned
        completed: goal.completed ?? false, // server-owned
        ...this.audit(uid),
      });
    }

    for (const ss of g.studySessions ?? []) {
      const ssId = seedId("studySession", `${r.tenantKey}:${g.studentKey}:${ss.key}`);
      await this.ctx.ensureDoc("studySession", Paths.studySession(tenantId, uid, ssId), {
        id: ssId,
        userId: uid,
        date: ss.date, // IsoDate
        minutes: ss.minutes,
        itemsCompleted: ss.itemsCompleted ?? 0,
        ...this.audit(uid),
      });
    }
  }

  // ── notifications / announcements / insights / cost ──

  private async seedAnnouncements(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const a of tc.announcements ?? []) {
      await this.seedAnnouncement(r, a);
    }
  }

  private async seedAnnouncement(r: IdResolver, a: AnnouncementConfig): Promise<void> {
    const tenantId = r.tenantId;
    const id = seedId("announcement", `${r.tenantKey}:${a.key}`);
    const authorUid = a.authorKey ? r.uidOf(a.authorKey) : SYSTEM_UID;
    await this.ctx.ensureDoc("announcement", Paths.announcement(tenantId, id), {
      id,
      tenantId,
      title: a.title,
      body: a.body,
      scope: a.scope ?? "tenant",
      targetClassIds: r.classIds(a.targetClassKeys),
      targetRoles: a.targetRoles ?? [],
      status: a.status ?? "published",
      authorUid,
      // readBy[] removed (CD8) — read-state lives in /reads/{uid}
      ...this.audit(authorUid),
    });
    for (const readerKey of a.readByKeys ?? []) {
      const uid = r.uidOf(readerKey);
      await this.ctx.ensureDoc("announcement", Paths.announcementRead(tenantId, id, uid), {
        uid,
        readAt: this.ctx.clock.now(),
      });
    }
  }

  private async seedNotifications(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const n of tc.notifications ?? []) {
      await this.seedNotification(r, n);
    }
  }

  private async seedNotification(r: IdResolver, n: NotificationConfig): Promise<void> {
    const tenantId = r.tenantId;
    const id = seedId("notification", `${r.tenantKey}:${n.key}`);
    const recipientUid = r.uidOf(n.recipientKey);
    await this.ctx.ensureDoc("notification", Paths.notification(tenantId, id), {
      id,
      tenantId,
      recipientUid, // canonical (D3/D12)
      type: n.type,
      title: n.title,
      body: n.body,
      payload: n.payload ?? {},
      isRead: n.isRead ?? false,
      ...this.audit(recipientUid),
    });
  }

  private async seedInsights(tc: TenantConfig, r: IdResolver): Promise<void> {
    if (!tc.insights?.length) return;
    await this.ctx.ensureCollection("insight", tc.insights, (i: InsightConfig) => {
      const student = r.student(i.studentKey);
      const id = seedId("insight", `${r.tenantKey}:${i.key}`);
      return {
        path: Paths.insight(r.tenantId, id),
        data: {
          id,
          tenantId: r.tenantId,
          studentId: student.entityId,
          type: i.type,
          severity: i.severity ?? "info",
          message: i.message,
          dismissed: i.dismissed ?? false,
          ...this.audit(student.uid),
        },
      };
    });
  }

  private async seedCostSummaries(tc: TenantConfig, r: IdResolver): Promise<void> {
    for (const c of tc.costSummaries ?? []) {
      await this.seedCostSummary(r, c);
    }
  }

  private async seedCostSummary(r: IdResolver, c: CostSummaryConfig): Promise<void> {
    const tenantId = r.tenantId;
    const data = {
      id: c.period,
      tenantId,
      period: c.period,
      totalUsd: c.totalUsd,
      totalTokens: c.totalTokens,
      callCount: c.callCount,
      byPurpose: c.byPurpose ?? {},
      ...this.audit(),
    };
    const path =
      c.granularity === "daily"
        ? Paths.dailyCostSummary(tenantId, c.period)
        : Paths.monthlyCostSummary(tenantId, c.period);
    await this.ctx.ensureDoc("costSummary", path, data);
  }
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export { DAY_MS };
