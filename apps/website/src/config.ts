export const APP_URLS = {
  admin: import.meta.env.PUBLIC_ADMIN_URL ?? "https://admin.lvlup.academy",
  teacher: import.meta.env.PUBLIC_TEACHER_URL ?? "https://teacher.lvlup.academy",
  student: import.meta.env.PUBLIC_STUDENT_URL ?? "https://student.lvlup.academy",
  parent: import.meta.env.PUBLIC_PARENT_URL ?? "https://parent.lvlup.academy",
} as const;

export const SITE = {
  name: "LvlUp Autograde",
  tagline: "AI grading for paper exams",
  description:
    "LvlUp Autograde reads scanned answer sheets, scores them against the rubric in your question paper, and shows each student where every mark went — with teacher review before anything is released.",
  url: "https://lvlup.academy",
} as const;

export const GUIDES = [
  {
    slug: "admin",
    title: "Admin Guide",
    role: "admin",
    description:
      "Onboard the school, share the join code, import staff and students, and keep AI grading running.",
  },
  {
    slug: "teacher",
    title: "Teacher Guide",
    role: "teacher",
    description:
      "Create the exam, check the AI-drafted rubric, upload answer sheets, review scores, release results.",
  },
  {
    slug: "student",
    title: "Student Guide",
    role: "student",
    description:
      "Log in, sit the exam on paper, and read your per-question feedback once results open.",
  },
  {
    slug: "parent",
    title: "Parent Guide",
    role: "parent",
    description:
      "Follow your child's released results, read the feedback, and download PDF reports.",
  },
] as const;
