/**
 * IdResolver — turns logical config `key`s into deterministic branded ids, and resolves
 * cross-entity references (e.g. a class's `studentKeys` → `StudentId[]`).
 *
 * One resolver per tenant subtree. All ids come from `seedId(kind, namespacedKey)` so they are
 * stable across runs. Keys are namespaced by tenant (`{tenantKey}:{kind}:{key}`) so two tenants
 * may reuse the same local key without collision.
 */

import {
  seedId,
  type AcademicSessionId,
  type AchievementId,
  type AgentId,
  type ClassId,
  type ExamId,
  type ExamQuestionId,
  type ItemId,
  type ParentId,
  type RubricPresetId,
  type ScannerId,
  type SpaceId,
  type StaffId,
  type StoryPointId,
  type StudentId,
  type SubmissionId,
  type TeacherId,
  type TenantId,
  type EvaluationSettingsId,
  type QuestionBankItemId,
  type ChatSessionId,
} from "./ids.js";

export interface ResolvedPerson {
  /** Deterministic Auth uid (also the `/users/{uid}` id and tenant-entity `authUid`). */
  uid: string;
  /** Tenant-entity id (StudentId/TeacherId/...). */
  entityId: string;
  email: string;
}

export class IdResolver {
  readonly tenantKey: string;
  readonly tenantId: TenantId;

  // key -> id maps, per kind
  private students = new Map<string, ResolvedPerson>();
  private teachers = new Map<string, ResolvedPerson>();
  private parents = new Map<string, ResolvedPerson>();
  private staff = new Map<string, ResolvedPerson>();
  private scanners = new Map<string, ResolvedPerson>();
  private admins = new Map<string, ResolvedPerson>();
  private classes = new Map<string, ClassId>();
  private sessions = new Map<string, AcademicSessionId>();
  private spaces = new Map<string, SpaceId>();
  private storyPoints = new Map<string, StoryPointId>(); // key: `${spaceKey}/${spKey}`
  private items = new Map<string, ItemId>(); // key: `${spaceKey}/${spKey}/${itemKey}`
  private agents = new Map<string, AgentId>();
  private rubricPresets = new Map<string, RubricPresetId>();
  private bankItems = new Map<string, QuestionBankItemId>();
  private exams = new Map<string, ExamId>();
  private examQuestions = new Map<string, ExamQuestionId>(); // key: `${examKey}/${qKey}`
  private evalSettings = new Map<string, EvaluationSettingsId>();
  private submissions = new Map<string, SubmissionId>();
  private achievements = new Map<string, AchievementId>();

  constructor(tenantKey: string) {
    this.tenantKey = tenantKey;
    this.tenantId = seedId<"TenantId">("tenant", tenantKey);
  }

  private ns(kind: string, key: string): string {
    return `${this.tenantKey}:${kind}:${key}`;
  }

  // ---- people ----
  registerStudent(key: string, email: string): ResolvedPerson {
    const entityId = seedId<"StudentId">("student", this.ns("student", key));
    const uid = seedId("user", this.ns("user-student", key));
    const r: ResolvedPerson = { uid, entityId, email };
    this.students.set(key, r);
    return r;
  }
  registerTeacher(key: string, email: string): ResolvedPerson {
    const entityId = seedId<"TeacherId">("teacher", this.ns("teacher", key));
    const uid = seedId("user", this.ns("user-teacher", key));
    const r: ResolvedPerson = { uid, entityId, email };
    this.teachers.set(key, r);
    return r;
  }
  registerParent(key: string, email: string): ResolvedPerson {
    const entityId = seedId<"ParentId">("parent", this.ns("parent", key));
    const uid = seedId("user", this.ns("user-parent", key));
    const r: ResolvedPerson = { uid, entityId, email };
    this.parents.set(key, r);
    return r;
  }
  registerStaff(key: string, email: string): ResolvedPerson {
    const entityId = seedId<"StaffId">("staff", this.ns("staff", key));
    const uid = seedId("user", this.ns("user-staff", key));
    const r: ResolvedPerson = { uid, entityId, email };
    this.staff.set(key, r);
    return r;
  }
  registerScanner(key: string, email: string): ResolvedPerson {
    const entityId = seedId<"ScannerId">("scanner", this.ns("scanner", key));
    const uid = seedId("user", this.ns("user-scanner", key));
    const r: ResolvedPerson = { uid, entityId, email };
    this.scanners.set(key, r);
    return r;
  }
  registerAdmin(key: string, email: string): ResolvedPerson {
    // Admins are staff-shaped tenant actors with a dedicated user.
    const entityId = seedId<"StaffId">("staff", this.ns("admin", key));
    const uid = seedId("user", this.ns("user-admin", key));
    const r: ResolvedPerson = { uid, entityId, email };
    this.admins.set(key, r);
    return r;
  }

  student(key: string): ResolvedPerson {
    return this.must(this.students, key, "student");
  }
  teacher(key: string): ResolvedPerson {
    return this.must(this.teachers, key, "teacher");
  }
  parent(key: string): ResolvedPerson {
    return this.must(this.parents, key, "parent");
  }
  staffMember(key: string): ResolvedPerson {
    return this.must(this.staff, key, "staff");
  }
  scanner(key: string): ResolvedPerson {
    return this.must(this.scanners, key, "scanner");
  }
  admin(key: string): ResolvedPerson {
    return this.must(this.admins, key, "admin");
  }
  /** Resolve a uid by any person key (search across maps). */
  uidOf(key: string): string {
    for (const m of [
      this.students,
      this.teachers,
      this.parents,
      this.staff,
      this.scanners,
      this.admins,
    ]) {
      const r = m.get(key);
      if (r) return r.uid;
    }
    throw new Error(`[${this.tenantKey}] unknown person key for uid: ${key}`);
  }

  // ---- structural ----
  classId(key: string): ClassId {
    return seedId<"ClassId">("class", this.ns("class", key));
  }
  sessionId(key: string): AcademicSessionId {
    return seedId<"AcademicSessionId">("academicSession", this.ns("session", key));
  }
  spaceId(key: string): SpaceId {
    return seedId<"SpaceId">("space", this.ns("space", key));
  }
  storyPointId(spaceKey: string, spKey: string): StoryPointId {
    return seedId<"StoryPointId">("storyPoint", this.ns("storyPoint", `${spaceKey}/${spKey}`));
  }
  itemId(spaceKey: string, spKey: string, itemKey: string): ItemId {
    return seedId<"ItemId">("item", this.ns("item", `${spaceKey}/${spKey}/${itemKey}`));
  }
  agentId(key: string): AgentId {
    return seedId<"AgentId">("agent", this.ns("agent", key));
  }
  rubricPresetId(key: string): RubricPresetId {
    return seedId<"RubricPresetId">("rubricPreset", this.ns("rubricPreset", key));
  }
  bankItemId(key: string): QuestionBankItemId {
    return seedId<"QuestionBankItemId">("questionBankItem", this.ns("bankItem", key));
  }
  examId(key: string): ExamId {
    return seedId<"ExamId">("exam", this.ns("exam", key));
  }
  examQuestionId(examKey: string, qKey: string): ExamQuestionId {
    return seedId<"ExamQuestionId">("examQuestion", this.ns("examQuestion", `${examKey}/${qKey}`));
  }
  evalSettingsId(key: string): EvaluationSettingsId {
    return seedId<"EvaluationSettingsId">("evaluationSettings", this.ns("evalSettings", key));
  }
  submissionId(key: string): SubmissionId {
    return seedId<"SubmissionId">("submission", this.ns("submission", key));
  }
  achievementId(key: string): AchievementId {
    return seedId<"AchievementId">("achievement", this.ns("achievement", key));
  }
  chatSessionId(key: string): ChatSessionId {
    return seedId<"ChatSessionId">("chatSession", this.ns("chatSession", key));
  }

  // ---- batch reference resolution ----
  classIds(keys: readonly string[] = []): ClassId[] {
    return keys.map((k) => this.classId(k));
  }
  studentIds(keys: readonly string[] = []): StudentId[] {
    return keys.map((k) => this.student(k).entityId as StudentId);
  }
  teacherIds(keys: readonly string[] = []): TeacherId[] {
    return keys.map((k) => this.teacher(k).entityId as TeacherId);
  }
  studentUids(keys: readonly string[] = []): string[] {
    return keys.map((k) => this.student(k).uid);
  }

  private must<T>(map: Map<string, T>, key: string, kind: string): T {
    const v = map.get(key);
    if (v === undefined) {
      throw new Error(`[${this.tenantKey}] unresolved ${kind} key: "${key}"`);
    }
    return v;
  }
}
