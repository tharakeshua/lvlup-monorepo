/**
 * Riverside High — a smaller second tenant. Proves multi-tenant isolation: it deliberately reuses
 * some LOCAL keys (e.g. `g8-math`, `t-asha`) that also exist in Greenwood; the resolver namespaces
 * keys by tenant, so the deterministic ids never collide across tenants.
 */

import type { TenantConfig } from "../config/types.js";

export const riversideTenant: TenantConfig = {
  key: "riverside",
  name: "Riverside High",
  code: "RVS002",
  status: "trial",
  plan: "starter",
  contact: { email: "admin@riverside.edu" },
  features: { exams: true, spaces: true, gamification: false, ai: false },

  academicSessions: [
    {
      key: "2025-26",
      name: "2025-2026",
      startDate: "2025-06-01",
      endDate: "2026-04-30",
      isCurrent: true,
      status: "active",
    },
  ],

  classes: [
    {
      key: "g8-math",
      name: "Grade 8 - Mathematics",
      grade: "8",
      academicSessionKey: "2025-26",
      teacherKeys: ["t-asha"],
      studentKeys: ["s-nikhil", "s-riya"],
    },
  ],

  admins: [
    {
      key: "admin-main",
      email: "head@riverside.edu",
      password: "Admin@12345",
      firstName: "Suresh",
      lastName: "Menon",
      staffPermissions: { canManageUsers: true, canManageClasses: true },
    },
  ],

  teachers: [
    {
      key: "t-asha", // same local key as Greenwood — resolver namespaces by tenant
      email: "asha.kumar@riverside.edu",
      password: "Teacher@123",
      firstName: "Asha",
      lastName: "Kumar",
      subjects: ["Mathematics"],
      classKeys: ["g8-math"],
      permissions: { canCreateExams: true, canCreateSpaces: true },
    },
  ],

  students: [
    {
      key: "s-nikhil",
      email: "nikhil.saxena@riverside.edu",
      password: "Student@123",
      firstName: "Nikhil",
      lastName: "Saxena",
      rollNumber: "RV001",
      grade: "8",
      classKeys: ["g8-math"],
    },
    {
      key: "s-riya",
      email: "riya.chopra@riverside.edu",
      password: "Student@123",
      firstName: "Riya",
      lastName: "Chopra",
      rollNumber: "RV002",
      grade: "8",
      classKeys: ["g8-math"],
    },
  ],

  parents: [
    {
      key: "p-saxena",
      email: "arun.saxena@gmail.com",
      password: "Parent@123",
      firstName: "Arun",
      lastName: "Saxena",
      studentKeys: ["s-nikhil"],
    },
  ],

  spaces: [
    {
      key: "space-geometry",
      title: "Geometry Basics",
      type: "course",
      status: "published",
      subject: "Mathematics",
      classKeys: ["g8-math"],
      ownerTeacherKey: "t-asha",
      storyPoints: [
        {
          key: "sp-shapes",
          title: "Shapes & Angles",
          type: "quiz",
          order: 0,
          durationSeconds: 600,
          items: [
            {
              key: "i-tf-angle",
              kind: "question",
              questionType: "true_false",
              prompt: "A right angle measures 90 degrees.",
              points: 1,
              order: 0,
              answer: { correctAnswer: true },
            },
          ],
        },
      ],
    },
  ],

  announcements: [
    {
      key: "anc-welcome",
      title: "Welcome to Riverside on LevelUp",
      body: "We are piloting the platform this term.",
      scope: "tenant",
      status: "published",
      authorKey: "admin-main",
    },
  ],
};
