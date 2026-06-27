/**
 * Zod validation for SeedConfig — a lightweight authoring guard (NOT the domain entity schemas).
 *
 * The @levelup/domain schemas validate the WRITTEN entity shapes; this validates the seed
 * INPUT shape so config typos fail fast before any write. It is intentionally permissive on
 * payload internals (which the domain discriminated unions own) and strict on structural keys.
 */

import { z } from "zod";

const key = z.string().min(1).max(120);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const account = {
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
  photoURL: z.string().optional(),
  phone: z.string().optional(),
};

const rubric = z
  .object({
    dimensions: z
      .array(
        z.object({
          key,
          label: z.string(),
          weight: z.number(),
          promptGuidance: z.string().optional(),
        })
      )
      .optional(),
    totalPoints: z.number().optional(),
    passingScore: z.number().optional(),
    modelAnswer: z.string().optional(),
    evaluatorGuidance: z.string().optional(),
  })
  .partial();

const answerKey = z.object({
  correctAnswer: z.unknown(),
  acceptableAnswers: z.array(z.unknown()).optional(),
  evaluationGuidance: z.string().optional(),
  modelAnswer: z.string().optional(),
});

const item = z.discriminatedUnion("kind", [
  z.object({
    key,
    kind: z.literal("question"),
    questionType: z.string(),
    order: z.number().optional(),
    prompt: z.string(),
    options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
    points: z.number().optional(),
    answer: answerKey,
    rubricPresetKey: key.optional(),
    rubric: rubric.optional(),
  }),
  z.object({
    key,
    kind: z.literal("material"),
    materialType: z.string(),
    order: z.number().optional(),
    title: z.string(),
    body: z.string().optional(),
    url: z.string().optional(),
    durationSeconds: z.number().optional(),
  }),
]);

const storyPoint = z.object({
  key,
  title: z.string(),
  description: z.string().optional(),
  type: z.string().optional(),
  order: z.number().optional(),
  durationSeconds: z.number().optional(),
  items: z.array(item).optional(),
});

const space = z.object({
  key,
  title: z.string(),
  description: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  subject: z.string().optional(),
  classKeys: z.array(key).optional(),
  ownerTeacherKey: key.optional(),
  price: z.number().optional(),
  storyPoints: z.array(storyPoint).optional(),
});

const tenant = z
  .object({
    key,
    name: z.string(),
    code: z.string().min(1),
    slug: z.string().optional(),
    status: z.string().optional(),
    plan: z.string().optional(),
    contact: z.object({ email: z.string().email(), phone: z.string().optional() }).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    features: z.record(z.string(), z.boolean()).optional(),
    branding: z.record(z.string(), z.unknown()).optional(),
    geminiKeyRef: z.string().optional(),
    academicSessions: z
      .array(
        z.object({ key, name: z.string(), startDate: isoDate, endDate: isoDate }).passthrough()
      )
      .optional(),
    classes: z
      .array(z.object({ key, name: z.string(), grade: z.string() }).passthrough())
      .optional(),
    teachers: z
      .array(
        z.object({ key, firstName: z.string(), lastName: z.string(), ...account }).passthrough()
      )
      .optional(),
    students: z
      .array(z.object({ key, firstName: z.string(), lastName: z.string() }).passthrough())
      .optional(),
    parents: z
      .array(
        z
          .object({ key, firstName: z.string(), lastName: z.string(), studentKeys: z.array(key) })
          .passthrough()
      )
      .optional(),
    staff: z.array(z.object({ key }).passthrough()).optional(),
    scanners: z.array(z.object({ key, label: z.string() }).passthrough()).optional(),
    admins: z
      .array(
        z.object({ key, firstName: z.string(), lastName: z.string(), ...account }).passthrough()
      )
      .optional(),
    agents: z.array(z.object({ key, name: z.string() }).passthrough()).optional(),
    rubricPresets: z.array(z.object({ key, name: z.string(), rubric }).passthrough()).optional(),
    questionBank: z.array(z.object({ key, prompt: z.string() }).passthrough()).optional(),
    spaces: z.array(space).optional(),
    exams: z
      .array(
        z
          .object({
            key,
            title: z.string(),
            subject: z.string(),
            examDate: z.string(),
            totalMarks: z.number(),
          })
          .passthrough()
      )
      .optional(),
    evaluationSettings: z.array(z.object({ key, name: z.string() }).passthrough()).optional(),
    gradingDeadLetter: z
      .array(
        z
          .object({
            key,
            submissionKey: key,
            pipelineStep: z.enum(["scouting", "grading"]),
            error: z.string(),
            attempts: z.number(),
          })
          .passthrough()
      )
      .optional(),
    testSessions: z
      .array(z.object({ key, spaceKey: key, storyPointKey: key, studentKey: key }).passthrough())
      .optional(),
    submissions: z.array(z.object({ key, examKey: key, studentKey: key }).passthrough()).optional(),
    progress: z.array(z.object({ studentKey: key, spaceKey: key }).passthrough()).optional(),
    achievements: z.array(z.object({ key, name: z.string() }).passthrough()).optional(),
    studentGamification: z.array(z.object({ studentKey: key }).passthrough()).optional(),
    announcements: z
      .array(z.object({ key, title: z.string(), body: z.string() }).passthrough())
      .optional(),
    notifications: z
      .array(
        z.object({ key, recipientKey: key, type: z.string(), title: z.string() }).passthrough()
      )
      .optional(),
    insights: z
      .array(
        z.object({ key, studentKey: key, type: z.string(), message: z.string() }).passthrough()
      )
      .optional(),
    costSummaries: z
      .array(
        z
          .object({ key, granularity: z.enum(["daily", "monthly"]), period: z.string() })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export const SeedConfigSchema = z
  .object({
    version: z.string().optional(),
    superAdmins: z
      .array(
        z
          .object({
            key,
            email: z.string().email(),
            password: z.string().min(6),
            displayName: z.string(),
          })
          .passthrough()
      )
      .optional(),
    tenants: z.array(tenant).min(1),
    globalEvaluationPresets: z.array(z.object({ key, name: z.string() }).passthrough()).optional(),
  })
  .passthrough();

/** Validate a SeedConfig, returning the parsed value or throwing a readable error. */
export function validateSeedConfig(config: unknown): void {
  const res = SeedConfigSchema.safeParse(config);
  if (!res.success) {
    const issues = res.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid SeedConfig:\n${issues}`);
  }
}
