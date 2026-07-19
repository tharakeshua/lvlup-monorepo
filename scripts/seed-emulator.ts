/**
 * Emulator seed script — populates Firebase Auth + Firestore emulators
 * with comprehensive test data for E2E testing.
 *
 * Creates:
 *   - 1 Super Admin
 *   - 1 Tenant (Greenwood International School, code: GRN001)
 *   - 1 Academic Session (2025-26)
 *   - 5 Classes (Grade 8 Math, Grade 8 Science, Grade 10 Physics, Grade 10 Chemistry, Grade 12 CS)
 *   - 1 Tenant Admin + 4 Teachers
 *   - 20 Students (distributed across classes)
 *   - 8 Parents (linked to students)
 *   - 5 Learning Spaces with Story Points and Items (questions + materials)
 *   - 3 AutoGrade Exams with Questions
 *   - Student progress data
 *   - Sample chat session
 *   - 1 additional tenant (Riverside School, code: RVS002) for multi-org tests
 *
 * Usage: npx tsx scripts/seed-emulator.ts
 *
 * Idempotent: clears existing data before recreating.
 */

import admin from "firebase-admin";

// ---------------------------------------------------------------------------
// 1. Point at emulators
// ---------------------------------------------------------------------------
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

const PROJECT_ID = "lvlup-ff6fa";

admin.initializeApp({ projectId: PROJECT_ID });

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MAX_CLAIM_CLASS_IDS = 15;
const now = Date.now();

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ts(daysAgo = 0): admin.firestore.Timestamp {
  return Timestamp.fromMillis(now - daysAgo * 86400000);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface MembershipLike {
  role: string;
  tenantId: string;
  tenantCode: string;
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  scannerId?: string;
  permissions?: { managedClassIds?: string[] };
  parentLinkedStudentIds?: string[];
}

function buildClaimsForMembership(m: MembershipLike): Record<string, unknown> {
  const classIds = m.permissions?.managedClassIds ?? [];
  const claims: Record<string, unknown> = {
    role: m.role,
    tenantId: m.tenantId,
    tenantCode: m.tenantCode,
  };
  switch (m.role) {
    case "teacher":
      claims.teacherId = m.teacherId;
      claims.classIds = classIds.slice(0, MAX_CLAIM_CLASS_IDS);
      claims.classIdsOverflow = classIds.length > MAX_CLAIM_CLASS_IDS;
      break;
    case "student":
      claims.studentId = m.studentId;
      claims.classIds = classIds.slice(0, MAX_CLAIM_CLASS_IDS);
      claims.classIdsOverflow = classIds.length > MAX_CLAIM_CLASS_IDS;
      break;
    case "parent":
      claims.parentId = m.parentId;
      claims.studentIds = m.parentLinkedStudentIds ?? [];
      break;
    case "scanner":
      claims.scannerId = m.scannerId;
      break;
    case "tenantAdmin":
      break;
  }
  return claims;
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------
async function deleteAllAuthUsers(): Promise<void> {
  let pageToken: string | undefined;
  do {
    const result = await auth.listUsers(1000, pageToken);
    const uids = result.users.map((u) => u.uid);
    if (uids.length > 0) {
      await auth.deleteUsers(uids);
    }
    pageToken = result.pageToken;
  } while (pageToken);
}

async function deleteCollection(path: string): Promise<void> {
  const snap = await db.collection(path).listDocuments();
  const batch = db.batch();
  for (const doc of snap) {
    batch.delete(doc);
  }
  await batch.commit();
}

async function clearFirestore(): Promise<void> {
  const topLevel = ["users", "userMemberships", "tenants", "tenantCodes"];
  for (const col of topLevel) {
    await deleteCollection(col);
  }
}

// ---------------------------------------------------------------------------
// Auth user creation (with retry for existing users)
// ---------------------------------------------------------------------------
async function ensureAuthUser(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    return existing.uid;
  } catch {
    const userRecord = await auth.createUser({ email, password, displayName });
    return userRecord.uid;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TENANT_CODE = "GRN001";
const SCHOOL_NAME = "Greenwood International School";
const DEFAULT_PASSWORD = "Test@12345";

// ID tracking
const IDS: Record<string, string> = {};
const STUDENT_UIDS: string[] = [];
const STUDENT_ENTITY_IDS: string[] = [];
const TEACHER_ENTITY_IDS: string[] = [];
const CLASS_IDS: string[] = [];
const SPACE_IDS: string[] = [];

// ---------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------
const CLASSES = [
  {
    id: "cls_g8_math",
    name: "Grade 8 — Mathematics",
    subject: "Mathematics",
    grade: "8",
    displayOrder: 1,
  },
  { id: "cls_g8_sci", name: "Grade 8 — Science", subject: "Science", grade: "8", displayOrder: 2 },
  {
    id: "cls_g10_phy",
    name: "Grade 10 — Physics",
    subject: "Physics",
    grade: "10",
    displayOrder: 3,
  },
  {
    id: "cls_g10_chem",
    name: "Grade 10 — Chemistry",
    subject: "Chemistry",
    grade: "10",
    displayOrder: 4,
  },
  {
    id: "cls_g12_cs",
    name: "Grade 12 — Computer Science",
    subject: "Computer Science",
    grade: "12",
    displayOrder: 5,
  },
];

const TEACHERS = [
  {
    email: "priya.sharma@greenwood.edu",
    firstName: "Priya",
    lastName: "Sharma",
    subjects: ["Mathematics"],
    classIds: ["cls_g8_math"],
    employeeId: "GRN-T001",
    department: "Mathematics",
    permissions: {
      canCreateExams: true,
      canEditRubrics: true,
      canManuallyGrade: true,
      canViewAllExams: false,
      canCreateSpaces: true,
      canManageContent: true,
      canViewAnalytics: true,
      canConfigureAgents: false,
      managedSpaceIds: [] as string[],
      managedClassIds: ["cls_g8_math"],
    },
  },
  {
    email: "rajesh.kumar@greenwood.edu",
    firstName: "Rajesh",
    lastName: "Kumar",
    subjects: ["Science", "Physics"],
    classIds: ["cls_g8_sci", "cls_g10_phy"],
    employeeId: "GRN-T002",
    department: "Science",
    permissions: {
      canCreateExams: true,
      canEditRubrics: true,
      canManuallyGrade: true,
      canViewAllExams: false,
      canCreateSpaces: true,
      canManageContent: true,
      canViewAnalytics: true,
      canConfigureAgents: false,
      managedSpaceIds: [] as string[],
      managedClassIds: ["cls_g8_sci", "cls_g10_phy"],
    },
  },
  {
    email: "anita.desai@greenwood.edu",
    firstName: "Anita",
    lastName: "Desai",
    subjects: ["Chemistry"],
    classIds: ["cls_g10_chem"],
    employeeId: "GRN-T003",
    department: "Science",
    permissions: {
      canCreateExams: true,
      canEditRubrics: true,
      canManuallyGrade: true,
      canViewAllExams: false,
      canCreateSpaces: true,
      canManageContent: true,
      canViewAnalytics: true,
      canConfigureAgents: false,
      managedSpaceIds: [] as string[],
      managedClassIds: ["cls_g10_chem"],
    },
  },
  {
    email: "vikram.singh@greenwood.edu",
    firstName: "Vikram",
    lastName: "Singh",
    subjects: ["Computer Science"],
    classIds: ["cls_g12_cs"],
    employeeId: "GRN-T004",
    department: "Computer Science",
    permissions: {
      canCreateExams: true,
      canEditRubrics: true,
      canManuallyGrade: true,
      canViewAllExams: false,
      canCreateSpaces: true,
      canManageContent: true,
      canViewAnalytics: true,
      canConfigureAgents: true,
      managedSpaceIds: [] as string[],
      managedClassIds: ["cls_g12_cs"],
    },
  },
];

const STUDENTS = [
  {
    email: "aarav.patel@greenwood.edu",
    firstName: "Aarav",
    lastName: "Patel",
    rollNumber: "2025001",
    classIds: ["cls_g8_math", "cls_g8_sci"],
    grade: "8",
  },
  {
    email: "diya.gupta@greenwood.edu",
    firstName: "Diya",
    lastName: "Gupta",
    rollNumber: "2025002",
    classIds: ["cls_g8_math", "cls_g8_sci"],
    grade: "8",
  },
  {
    email: "arjun.nair@greenwood.edu",
    firstName: "Arjun",
    lastName: "Nair",
    rollNumber: "2025003",
    classIds: ["cls_g8_math", "cls_g8_sci"],
    grade: "8",
  },
  {
    email: "ananya.reddy@greenwood.edu",
    firstName: "Ananya",
    lastName: "Reddy",
    rollNumber: "2025004",
    classIds: ["cls_g8_math", "cls_g8_sci"],
    grade: "8",
  },
  {
    email: "rohan.sharma@greenwood.edu",
    firstName: "Rohan",
    lastName: "Sharma",
    rollNumber: "2025005",
    classIds: ["cls_g8_math"],
    grade: "8",
  },
  {
    email: "meera.iyer@greenwood.edu",
    firstName: "Meera",
    lastName: "Iyer",
    rollNumber: "2025006",
    classIds: ["cls_g8_sci"],
    grade: "8",
  },
  {
    email: "karan.singh@greenwood.edu",
    firstName: "Karan",
    lastName: "Singh",
    rollNumber: "2025007",
    classIds: ["cls_g10_phy", "cls_g10_chem"],
    grade: "10",
  },
  {
    email: "priya.menon@greenwood.edu",
    firstName: "Priya",
    lastName: "Menon",
    rollNumber: "2025008",
    classIds: ["cls_g10_phy", "cls_g10_chem"],
    grade: "10",
  },
  {
    email: "aditya.joshi@greenwood.edu",
    firstName: "Aditya",
    lastName: "Joshi",
    rollNumber: "2025009",
    classIds: ["cls_g10_phy", "cls_g10_chem"],
    grade: "10",
  },
  {
    email: "sneha.das@greenwood.edu",
    firstName: "Sneha",
    lastName: "Das",
    rollNumber: "2025010",
    classIds: ["cls_g10_phy", "cls_g10_chem"],
    grade: "10",
  },
  {
    email: "vivek.tiwari@greenwood.edu",
    firstName: "Vivek",
    lastName: "Tiwari",
    rollNumber: "2025011",
    classIds: ["cls_g10_phy"],
    grade: "10",
  },
  {
    email: "ishita.verma@greenwood.edu",
    firstName: "Ishita",
    lastName: "Verma",
    rollNumber: "2025012",
    classIds: ["cls_g10_chem"],
    grade: "10",
  },
  {
    email: "rahul.mehta@greenwood.edu",
    firstName: "Rahul",
    lastName: "Mehta",
    rollNumber: "2025013",
    classIds: ["cls_g10_phy", "cls_g10_chem"],
    grade: "10",
  },
  {
    email: "kavya.pillai@greenwood.edu",
    firstName: "Kavya",
    lastName: "Pillai",
    rollNumber: "2025014",
    classIds: ["cls_g10_phy"],
    grade: "10",
  },
  {
    email: "nikhil.saxena@greenwood.edu",
    firstName: "Nikhil",
    lastName: "Saxena",
    rollNumber: "2025015",
    classIds: ["cls_g12_cs"],
    grade: "12",
  },
  {
    email: "riya.chopra@greenwood.edu",
    firstName: "Riya",
    lastName: "Chopra",
    rollNumber: "2025016",
    classIds: ["cls_g12_cs"],
    grade: "12",
  },
  {
    email: "amit.pandey@greenwood.edu",
    firstName: "Amit",
    lastName: "Pandey",
    rollNumber: "2025017",
    classIds: ["cls_g12_cs"],
    grade: "12",
  },
  {
    email: "sanya.rao@greenwood.edu",
    firstName: "Sanya",
    lastName: "Rao",
    rollNumber: "2025018",
    classIds: ["cls_g12_cs"],
    grade: "12",
  },
  {
    email: "dev.kulkarni@greenwood.edu",
    firstName: "Dev",
    lastName: "Kulkarni",
    rollNumber: "2025019",
    classIds: ["cls_g12_cs"],
    grade: "12",
  },
  {
    email: "nisha.bhat@greenwood.edu",
    firstName: "Nisha",
    lastName: "Bhat",
    rollNumber: "2025020",
    classIds: ["cls_g12_cs"],
    grade: "12",
  },
];

const PARENTS = [
  {
    email: "suresh.patel@gmail.com",
    firstName: "Suresh",
    lastName: "Patel",
    linkedStudentIndexes: [0],
    relationship: "father" as const,
  },
  {
    email: "meena.gupta@gmail.com",
    firstName: "Meena",
    lastName: "Gupta",
    linkedStudentIndexes: [1],
    relationship: "mother" as const,
  },
  {
    email: "ramesh.nair@gmail.com",
    firstName: "Ramesh",
    lastName: "Nair",
    linkedStudentIndexes: [2, 3],
    relationship: "father" as const,
  },
  {
    email: "sunita.sharma@gmail.com",
    firstName: "Sunita",
    lastName: "Sharma",
    linkedStudentIndexes: [4],
    relationship: "mother" as const,
  },
  {
    email: "mohit.singh@gmail.com",
    firstName: "Mohit",
    lastName: "Singh",
    linkedStudentIndexes: [6, 7],
    relationship: "father" as const,
  },
  {
    email: "neeta.joshi@gmail.com",
    firstName: "Neeta",
    lastName: "Joshi",
    linkedStudentIndexes: [8, 9],
    relationship: "mother" as const,
  },
  {
    email: "dinesh.saxena@gmail.com",
    firstName: "Dinesh",
    lastName: "Saxena",
    linkedStudentIndexes: [14, 15],
    relationship: "father" as const,
  },
  {
    email: "pooja.pandey@gmail.com",
    firstName: "Pooja",
    lastName: "Pandey",
    linkedStudentIndexes: [16, 17],
    relationship: "mother" as const,
  },
];

// ===========================================================================
// CONTENT DATA: Spaces, Story Points, Items
// ===========================================================================

interface SpaceSeed {
  title: string;
  description: string;
  subject: string;
  classIds: string[];
  teacherIndex: number;
  type: "learning" | "practice" | "assessment" | "hybrid";
  storyPoints: StoryPointSeed[];
}

interface StoryPointSeed {
  title: string;
  description: string;
  type: "standard" | "timed_test" | "practice";
  sections: { id: string; title: string; orderIndex: number }[];
  items: ItemSeed[];
}

interface ItemSeed {
  title: string;
  type: "question" | "material";
  sectionId?: string;
  difficulty?: "easy" | "medium" | "hard";
  payload: any;
}

// Space 1: Grade 8 Mathematics
const mathSpace: SpaceSeed = {
  title: "Mathematics Fundamentals",
  description:
    "Core mathematics concepts for Grade 8 covering algebra, geometry, and data handling.",
  subject: "Mathematics",
  classIds: ["cls_g8_math"],
  teacherIndex: 0,
  type: "learning",
  storyPoints: [
    {
      title: "Algebraic Expressions",
      description: "Learn to simplify, evaluate, and factorize algebraic expressions.",
      type: "standard",
      sections: [
        { id: "sec_intro", title: "Introduction", orderIndex: 0 },
        { id: "sec_practice", title: "Practice Problems", orderIndex: 1 },
      ],
      items: [
        {
          title: "What are Algebraic Expressions?",
          type: "material",
          sectionId: "sec_intro",
          payload: {
            type: "material",
            data: {
              materialType: "rich",
              richContent: {
                title: "Introduction to Algebraic Expressions",
                blocks: [
                  {
                    id: "b1",
                    type: "heading",
                    content: "What is an Algebraic Expression?",
                    metadata: { level: 2 },
                  },
                  {
                    id: "b2",
                    type: "paragraph",
                    content:
                      "An algebraic expression is a mathematical phrase that contains numbers, variables (letters), and operations (+, -, x, /). For example, 3x + 5 is an algebraic expression where x is a variable.",
                  },
                  { id: "b3", type: "heading", content: "Key Terms", metadata: { level: 3 } },
                  {
                    id: "b4",
                    type: "list",
                    content: "",
                    metadata: {
                      listType: "unordered",
                      items: [
                        "Variable: A letter representing an unknown value (e.g., x, y)",
                        "Coefficient: The number multiplied by a variable (e.g., 3 in 3x)",
                        "Constant: A fixed number (e.g., 5 in 3x + 5)",
                        "Term: Each part separated by + or - (e.g., 3x and 5 are terms)",
                      ],
                    },
                  },
                ],
                readingTime: 3,
              },
            },
          },
        },
        {
          title: "Simplify: 3x + 5x",
          type: "question",
          sectionId: "sec_practice",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "Simplify the expression: 3x + 5x",
              explanation:
                "When adding like terms, add the coefficients: 3 + 5 = 8. So 3x + 5x = 8x.",
              basePoints: 10,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "8x", isCorrect: true },
                  { id: "b", text: "15x", isCorrect: false },
                  { id: "c", text: "8x^2", isCorrect: false },
                  { id: "d", text: "35x", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Evaluate 2a + 3b when a=4, b=2",
          type: "question",
          sectionId: "sec_practice",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "numerical",
              content: "Evaluate the expression 2a + 3b when a = 4 and b = 2.",
              explanation: "2(4) + 3(2) = 8 + 6 = 14",
              basePoints: 10,
              difficulty: "easy",
              questionData: { correctAnswer: 14, tolerance: 0 },
            },
          },
        },
        {
          title: "Like terms identification",
          type: "question",
          sectionId: "sec_practice",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "mcaq",
              content: "Select ALL pairs that are like terms:",
              explanation: "Like terms have the same variable raised to the same power.",
              basePoints: 15,
              difficulty: "medium",
              questionData: {
                options: [
                  { id: "a", text: "3x and 7x", isCorrect: true },
                  { id: "b", text: "5y^2 and 2y^2", isCorrect: true },
                  { id: "c", text: "4x and 4y", isCorrect: false },
                  { id: "d", text: "6 and -3", isCorrect: true },
                ],
              },
            },
          },
        },
        {
          title: "Factorize: x^2 + 5x + 6",
          type: "question",
          sectionId: "sec_practice",
          difficulty: "hard",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "Factorize the quadratic expression: x^2 + 5x + 6",
              explanation:
                "Find two numbers that multiply to 6 and add to 5. These are 2 and 3. So x^2 + 5x + 6 = (x + 2)(x + 3).",
              basePoints: 20,
              difficulty: "hard",
              questionData: {
                options: [
                  { id: "a", text: "(x + 2)(x + 3)", isCorrect: true },
                  { id: "b", text: "(x + 1)(x + 6)", isCorrect: false },
                  { id: "c", text: "(x - 2)(x - 3)", isCorrect: false },
                  { id: "d", text: "(x + 5)(x + 1)", isCorrect: false },
                ],
              },
            },
          },
        },
      ],
    },
    {
      title: "Linear Equations",
      description: "Solve linear equations in one and two variables.",
      type: "standard",
      sections: [
        { id: "sec_theory", title: "Theory", orderIndex: 0 },
        { id: "sec_problems", title: "Problems", orderIndex: 1 },
      ],
      items: [
        {
          title: "Solving Linear Equations",
          type: "material",
          sectionId: "sec_theory",
          payload: {
            type: "material",
            data: {
              materialType: "rich",
              richContent: {
                title: "How to Solve Linear Equations",
                blocks: [
                  { id: "b1", type: "heading", content: "Steps to Solve", metadata: { level: 2 } },
                  {
                    id: "b2",
                    type: "list",
                    content: "",
                    metadata: {
                      listType: "ordered",
                      items: [
                        "Simplify both sides of the equation",
                        "Move all variable terms to one side",
                        "Move all constants to the other side",
                        "Divide both sides by the coefficient of the variable",
                      ],
                    },
                  },
                  {
                    id: "b3",
                    type: "paragraph",
                    content:
                      "Example: Solve 2x + 3 = 11\nStep 1: 2x = 11 - 3 = 8\nStep 2: x = 8/2 = 4",
                  },
                ],
                readingTime: 4,
              },
            },
          },
        },
        {
          title: "Solve: 3x + 7 = 22",
          type: "question",
          sectionId: "sec_problems",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "numerical",
              content: "Solve for x: 3x + 7 = 22",
              explanation: "3x = 22 - 7 = 15, so x = 15/3 = 5",
              basePoints: 10,
              difficulty: "easy",
              questionData: { correctAnswer: 5, tolerance: 0 },
            },
          },
        },
        {
          title: "Which is a linear equation?",
          type: "question",
          sectionId: "sec_problems",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "Which of the following is a linear equation?",
              explanation: "A linear equation has variables with power 1 only.",
              basePoints: 10,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "2x + 3 = 7", isCorrect: true },
                  { id: "b", text: "x^2 + 1 = 5", isCorrect: false },
                  { id: "c", text: "1/x = 3", isCorrect: false },
                  { id: "d", text: "x^3 = 8", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Word problem",
          type: "question",
          sectionId: "sec_problems",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "text",
              content:
                "A number is 5 more than twice another number. If their sum is 35, write the equation and find both numbers.",
              explanation:
                "Let the smaller number be x. Then the larger is 2x + 5. x + (2x + 5) = 35 => 3x + 5 = 35 => x = 10. Numbers are 10 and 25.",
              basePoints: 20,
              difficulty: "medium",
              questionData: { sampleAnswer: "x = 10, y = 25" },
            },
          },
        },
      ],
    },
    {
      title: "Geometry - Triangles",
      description: "Properties of triangles, angle sum property, and congruence.",
      type: "standard",
      sections: [{ id: "sec_all", title: "Triangles", orderIndex: 0 }],
      items: [
        {
          title: "Sum of angles in a triangle",
          type: "question",
          sectionId: "sec_all",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "true-false",
              content: "The sum of all angles in a triangle is always 180 degrees.",
              explanation: "This is the Angle Sum Property of triangles.",
              basePoints: 5,
              difficulty: "easy",
              questionData: { correctAnswer: true },
            },
          },
        },
        {
          title: "Find the missing angle",
          type: "question",
          sectionId: "sec_all",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "numerical",
              content:
                "In a triangle, two angles measure 60 and 70 degrees. Find the third angle (in degrees).",
              explanation: "180 - 60 - 70 = 50",
              basePoints: 10,
              difficulty: "easy",
              questionData: { correctAnswer: 50, tolerance: 0 },
            },
          },
        },
        {
          title: "Triangle congruence",
          type: "question",
          sectionId: "sec_all",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "matching",
              content: "Match each triangle congruence criterion with its description:",
              basePoints: 15,
              difficulty: "medium",
              questionData: {
                pairs: [
                  { left: "SSS", right: "All three sides are equal" },
                  { left: "SAS", right: "Two sides and included angle are equal" },
                  { left: "ASA", right: "Two angles and included side are equal" },
                  { left: "RHS", right: "Right angle, hypotenuse, and one side are equal" },
                ],
              },
            },
          },
        },
      ],
    },
    {
      title: "Math Quiz 1",
      description: "Timed test covering algebra and geometry basics.",
      type: "timed_test",
      sections: [],
      items: [
        {
          title: "Quiz Q1",
          type: "question",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "What is the value of 5^2 - 3^2?",
              basePoints: 5,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "16", isCorrect: true },
                  { id: "b", text: "4", isCorrect: false },
                  { id: "c", text: "34", isCorrect: false },
                  { id: "d", text: "8", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Quiz Q2",
          type: "question",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "Solve: 2(x + 3) = 14",
              basePoints: 10,
              difficulty: "medium",
              questionData: {
                options: [
                  { id: "a", text: "x = 4", isCorrect: true },
                  { id: "b", text: "x = 7", isCorrect: false },
                  { id: "c", text: "x = 5", isCorrect: false },
                  { id: "d", text: "x = 3", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Quiz Q3",
          type: "question",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "true-false",
              content: "An equilateral triangle has all angles equal to 60 degrees.",
              basePoints: 5,
              difficulty: "easy",
              questionData: { correctAnswer: true },
            },
          },
        },
      ],
    },
  ],
};

// Space 2: Grade 8 Science
const scienceSpace: SpaceSeed = {
  title: "General Science",
  description:
    "Introduction to key science concepts covering physics, chemistry, and biology for Grade 8.",
  subject: "Science",
  classIds: ["cls_g8_sci"],
  teacherIndex: 1,
  type: "learning",
  storyPoints: [
    {
      title: "Force and Pressure",
      description: "Understanding forces, their effects, and pressure in everyday life.",
      type: "standard",
      sections: [{ id: "sec_main", title: "Force & Pressure", orderIndex: 0 }],
      items: [
        {
          title: "What is Force?",
          type: "material",
          sectionId: "sec_main",
          payload: {
            type: "material",
            data: {
              materialType: "rich",
              richContent: {
                title: "Understanding Force",
                blocks: [
                  {
                    id: "b1",
                    type: "paragraph",
                    content:
                      "A force is a push or pull acting on an object. Forces can change the speed, direction, or shape of an object. The SI unit of force is Newton (N).",
                  },
                  { id: "b2", type: "heading", content: "Types of Forces", metadata: { level: 3 } },
                  {
                    id: "b3",
                    type: "list",
                    content: "",
                    metadata: {
                      listType: "unordered",
                      items: [
                        "Contact forces: Friction, Normal force, Tension",
                        "Non-contact forces: Gravity, Magnetic force, Electrostatic force",
                      ],
                    },
                  },
                ],
                readingTime: 3,
              },
            },
          },
        },
        {
          title: "Contact vs Non-contact force",
          type: "question",
          sectionId: "sec_main",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "Which of the following is a non-contact force?",
              explanation: "Gravity acts at a distance without physical contact.",
              basePoints: 10,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "Gravity", isCorrect: true },
                  { id: "b", text: "Friction", isCorrect: false },
                  { id: "c", text: "Tension", isCorrect: false },
                  { id: "d", text: "Normal force", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Pressure formula",
          type: "question",
          sectionId: "sec_main",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "Pressure is defined as:",
              explanation: "Pressure = Force / Area. Its unit is Pascal (Pa) = N/m^2",
              basePoints: 10,
              difficulty: "medium",
              questionData: {
                options: [
                  { id: "a", text: "Force per unit area", isCorrect: true },
                  { id: "b", text: "Force times area", isCorrect: false },
                  { id: "c", text: "Mass per unit volume", isCorrect: false },
                  { id: "d", text: "Work per unit time", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Pressure is a scalar",
          type: "question",
          sectionId: "sec_main",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "true-false",
              content: "Pressure is a scalar quantity (has no direction).",
              explanation: "Yes, pressure acts equally in all directions at a point in a fluid.",
              basePoints: 5,
              difficulty: "easy",
              questionData: { correctAnswer: true },
            },
          },
        },
      ],
    },
    {
      title: "Cell Structure",
      description: "The fundamental unit of life — cell organelles and their functions.",
      type: "standard",
      sections: [{ id: "sec_bio", title: "Cell Biology", orderIndex: 0 }],
      items: [
        {
          title: "Cell organelles",
          type: "question",
          sectionId: "sec_bio",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "matching",
              content: "Match each organelle with its function:",
              basePoints: 15,
              difficulty: "medium",
              questionData: {
                pairs: [
                  { left: "Nucleus", right: "Controls cell activities, contains DNA" },
                  { left: "Mitochondria", right: "Powerhouse of the cell, produces energy" },
                  { left: "Ribosome", right: "Protein synthesis" },
                  { left: "Cell membrane", right: "Controls entry and exit of substances" },
                ],
              },
            },
          },
        },
        {
          title: "Plant vs Animal cell",
          type: "question",
          sectionId: "sec_bio",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcaq",
              content: "Which of these are found in plant cells but NOT in animal cells?",
              explanation:
                "Plant cells have cell wall, chloroplasts, and large central vacuole that animal cells lack.",
              basePoints: 10,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "Cell wall", isCorrect: true },
                  { id: "b", text: "Chloroplasts", isCorrect: true },
                  { id: "c", text: "Mitochondria", isCorrect: false },
                  { id: "d", text: "Nucleus", isCorrect: false },
                ],
              },
            },
          },
        },
      ],
    },
    {
      title: "Chemical Reactions Basics",
      description: "Introduction to chemical reactions, reactants and products.",
      type: "standard",
      sections: [{ id: "sec_chem", title: "Reactions", orderIndex: 0 }],
      items: [
        {
          title: "Balancing equations",
          type: "question",
          sectionId: "sec_chem",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "fill-blanks",
              content: "Balance: __H2 + __O2 -> __H2O",
              explanation: "2H2 + O2 -> 2H2O",
              basePoints: 15,
              difficulty: "medium",
              questionData: {
                blanks: [
                  { id: "b1", correctAnswer: "2" },
                  { id: "b2", correctAnswer: "1" },
                  { id: "b3", correctAnswer: "2" },
                ],
              },
            },
          },
        },
        {
          title: "Types of reactions",
          type: "question",
          sectionId: "sec_chem",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "When iron rusts, what type of chemical reaction occurs?",
              explanation: "Rusting is a slow oxidation reaction.",
              basePoints: 10,
              difficulty: "medium",
              questionData: {
                options: [
                  { id: "a", text: "Oxidation", isCorrect: true },
                  { id: "b", text: "Decomposition", isCorrect: false },
                  { id: "c", text: "Neutralization", isCorrect: false },
                  { id: "d", text: "Displacement", isCorrect: false },
                ],
              },
            },
          },
        },
      ],
    },
  ],
};

// Space 3: Grade 10 Physics
const physicsSpace: SpaceSeed = {
  title: "Physics — Mechanics",
  description: "Newtonian mechanics covering kinematics, laws of motion, and energy.",
  subject: "Physics",
  classIds: ["cls_g10_phy"],
  teacherIndex: 1,
  type: "learning",
  storyPoints: [
    {
      title: "Kinematics",
      description:
        "Motion in a straight line — distance, displacement, speed, velocity, acceleration.",
      type: "standard",
      sections: [
        { id: "sec_concepts", title: "Concepts", orderIndex: 0 },
        { id: "sec_problems", title: "Numericals", orderIndex: 1 },
      ],
      items: [
        {
          title: "Introduction to Motion",
          type: "material",
          sectionId: "sec_concepts",
          payload: {
            type: "material",
            data: {
              materialType: "rich",
              richContent: {
                title: "Motion in One Dimension",
                blocks: [
                  { id: "b1", type: "heading", content: "Key Definitions", metadata: { level: 2 } },
                  {
                    id: "b2",
                    type: "list",
                    content: "",
                    metadata: {
                      listType: "unordered",
                      items: [
                        "Distance: Total path length (scalar)",
                        "Displacement: Shortest distance from start to end (vector)",
                        "Speed: Distance / Time (scalar)",
                        "Velocity: Displacement / Time (vector)",
                        "Acceleration: Rate of change of velocity",
                      ],
                    },
                  },
                ],
                readingTime: 5,
              },
            },
          },
        },
        {
          title: "Speed vs Velocity",
          type: "question",
          sectionId: "sec_concepts",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "true-false",
              content: "Speed and velocity are the same physical quantity.",
              explanation: "Speed is a scalar, while velocity is a vector.",
              basePoints: 5,
              difficulty: "easy",
              questionData: { correctAnswer: false },
            },
          },
        },
        {
          title: "Acceleration problem",
          type: "question",
          sectionId: "sec_problems",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "numerical",
              content:
                "A car accelerates from rest to 20 m/s in 5 seconds. Find the acceleration (in m/s^2).",
              explanation: "a = (v - u) / t = (20 - 0) / 5 = 4 m/s^2",
              basePoints: 10,
              difficulty: "medium",
              questionData: { correctAnswer: 4, tolerance: 0.1 },
            },
          },
        },
        {
          title: "Distance covered",
          type: "question",
          sectionId: "sec_problems",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "numerical",
              content:
                "A ball is thrown upward with initial velocity 30 m/s. How high does it go? (g = 10 m/s^2). Answer in meters.",
              explanation: "At max height, v = 0. Using v^2 = u^2 - 2gs: 0 = 900 - 20s, s = 45m",
              basePoints: 15,
              difficulty: "medium",
              questionData: { correctAnswer: 45, tolerance: 0.5 },
            },
          },
        },
      ],
    },
    {
      title: "Newton's Laws of Motion",
      description: "The three fundamental laws governing motion.",
      type: "standard",
      sections: [{ id: "sec_laws", title: "Laws", orderIndex: 0 }],
      items: [
        {
          title: "Newton's First Law",
          type: "question",
          sectionId: "sec_laws",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "Newton's First Law is also known as the Law of:",
              explanation:
                "An object at rest stays at rest unless acted upon by an external force.",
              basePoints: 10,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "Inertia", isCorrect: true },
                  { id: "b", text: "Acceleration", isCorrect: false },
                  { id: "c", text: "Reaction", isCorrect: false },
                  { id: "d", text: "Gravity", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "F = ma calculation",
          type: "question",
          sectionId: "sec_laws",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "numerical",
              content:
                "A 5 kg object accelerates at 3 m/s^2. What is the net force acting on it? (in Newtons)",
              explanation: "F = ma = 5 x 3 = 15 N",
              basePoints: 10,
              difficulty: "medium",
              questionData: { correctAnswer: 15, tolerance: 0 },
            },
          },
        },
        {
          title: "Newton's Third Law",
          type: "question",
          sectionId: "sec_laws",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "text",
              content: "Explain Newton's Third Law with a real-life example.",
              explanation: "For every action, there is an equal and opposite reaction.",
              basePoints: 15,
              difficulty: "easy",
              questionData: {
                sampleAnswer:
                  "For every action there is an equal and opposite reaction. Example: Rocket propulsion.",
              },
            },
          },
        },
      ],
    },
    {
      title: "Work, Energy, and Power",
      description: "Concepts of work done, kinetic and potential energy, and power.",
      type: "standard",
      sections: [{ id: "sec_wep", title: "Work & Energy", orderIndex: 0 }],
      items: [
        {
          title: "Work done formula",
          type: "question",
          sectionId: "sec_wep",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "The formula for work done is:",
              basePoints: 5,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "W = F x d x cos(theta)", isCorrect: true },
                  { id: "b", text: "W = m x v", isCorrect: false },
                  { id: "c", text: "W = F / d", isCorrect: false },
                  { id: "d", text: "W = P x t^2", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "KE calculation",
          type: "question",
          sectionId: "sec_wep",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "numerical",
              content: "Find the kinetic energy of a 2 kg object moving at 10 m/s (in Joules).",
              explanation: "KE = 1/2 mv^2 = 1/2 x 2 x 100 = 100 J",
              basePoints: 10,
              difficulty: "medium",
              questionData: { correctAnswer: 100, tolerance: 0 },
            },
          },
        },
      ],
    },
  ],
};

// Space 4: Grade 10 Chemistry
const chemistrySpace: SpaceSeed = {
  title: "Chemistry Foundations",
  description: "Atomic structure, periodic table, chemical bonding, and reactions for Grade 10.",
  subject: "Chemistry",
  classIds: ["cls_g10_chem"],
  teacherIndex: 2,
  type: "learning",
  storyPoints: [
    {
      title: "Atomic Structure",
      description:
        "Structure of atoms — protons, neutrons, electrons, and electron configurations.",
      type: "standard",
      sections: [{ id: "sec_atoms", title: "Atoms", orderIndex: 0 }],
      items: [
        {
          title: "Subatomic particles",
          type: "question",
          sectionId: "sec_atoms",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "matching",
              content: "Match each subatomic particle with its properties:",
              basePoints: 10,
              difficulty: "easy",
              questionData: {
                pairs: [
                  { left: "Proton", right: "Positive charge, in nucleus" },
                  { left: "Neutron", right: "No charge, in nucleus" },
                  { left: "Electron", right: "Negative charge, orbits nucleus" },
                ],
              },
            },
          },
        },
        {
          title: "Atomic number",
          type: "question",
          sectionId: "sec_atoms",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "The atomic number of an element is equal to the number of:",
              explanation: "Atomic number = number of protons.",
              basePoints: 10,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "Protons", isCorrect: true },
                  { id: "b", text: "Neutrons", isCorrect: false },
                  { id: "c", text: "Electrons + Neutrons", isCorrect: false },
                  { id: "d", text: "Protons + Neutrons", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Electron config of Sodium",
          type: "question",
          sectionId: "sec_atoms",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "The electron configuration of Sodium (Na, Z=11) is:",
              explanation: "Na has 11 electrons: 2 in first shell, 8 in second, 1 in third.",
              basePoints: 10,
              difficulty: "medium",
              questionData: {
                options: [
                  { id: "a", text: "2, 8, 1", isCorrect: true },
                  { id: "b", text: "2, 8, 2", isCorrect: false },
                  { id: "c", text: "2, 7, 2", isCorrect: false },
                  { id: "d", text: "8, 2, 1", isCorrect: false },
                ],
              },
            },
          },
        },
      ],
    },
    {
      title: "Periodic Table",
      description: "Organization of elements, groups, periods, and trends.",
      type: "standard",
      sections: [{ id: "sec_pt", title: "Periodic Table", orderIndex: 0 }],
      items: [
        {
          title: "Group vs Period",
          type: "question",
          sectionId: "sec_pt",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "true-false",
              content:
                "In the periodic table, elements in the same group have similar chemical properties.",
              explanation: "Elements in the same group have the same number of valence electrons.",
              basePoints: 5,
              difficulty: "easy",
              questionData: { correctAnswer: true },
            },
          },
        },
        {
          title: "Noble gases",
          type: "question",
          sectionId: "sec_pt",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcaq",
              content: "Select ALL noble gases:",
              explanation: "Noble gases are in Group 18.",
              basePoints: 10,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "Helium", isCorrect: true },
                  { id: "b", text: "Neon", isCorrect: true },
                  { id: "c", text: "Argon", isCorrect: true },
                  { id: "d", text: "Chlorine", isCorrect: false },
                ],
              },
            },
          },
        },
      ],
    },
    {
      title: "Chemical Bonding",
      description: "Ionic bonds, covalent bonds, and metallic bonds.",
      type: "standard",
      sections: [{ id: "sec_bonds", title: "Bonding", orderIndex: 0 }],
      items: [
        {
          title: "Ionic vs Covalent",
          type: "question",
          sectionId: "sec_bonds",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "NaCl is an example of which type of bond?",
              explanation: "NaCl forms by transfer of electron from Na to Cl.",
              basePoints: 10,
              difficulty: "medium",
              questionData: {
                options: [
                  { id: "a", text: "Ionic bond", isCorrect: true },
                  { id: "b", text: "Covalent bond", isCorrect: false },
                  { id: "c", text: "Metallic bond", isCorrect: false },
                  { id: "d", text: "Hydrogen bond", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Explain ionic bonding",
          type: "question",
          sectionId: "sec_bonds",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "paragraph",
              content: "Explain how an ionic bond forms between Sodium and Chlorine.",
              explanation:
                "Sodium donates its valence electron to Chlorine. Na becomes Na+ and Cl becomes Cl-. Electrostatic attraction forms the bond.",
              basePoints: 20,
              difficulty: "medium",
              questionData: {
                minWords: 30,
                sampleAnswer: "Sodium has one valence electron which it transfers to chlorine...",
              },
            },
          },
        },
      ],
    },
  ],
};

// Space 5: Grade 12 Computer Science
const csSpace: SpaceSeed = {
  title: "Python Programming",
  description:
    "Learn Python from basics to intermediate — variables, control flow, functions, data structures.",
  subject: "Computer Science",
  classIds: ["cls_g12_cs"],
  teacherIndex: 3,
  type: "learning",
  storyPoints: [
    {
      title: "Python Basics",
      description: "Variables, data types, input/output, and basic operations.",
      type: "standard",
      sections: [
        { id: "sec_intro", title: "Introduction", orderIndex: 0 },
        { id: "sec_code", title: "Coding Practice", orderIndex: 1 },
      ],
      items: [
        {
          title: "Getting Started with Python",
          type: "material",
          sectionId: "sec_intro",
          payload: {
            type: "material",
            data: {
              materialType: "rich",
              richContent: {
                title: "Python Basics",
                blocks: [
                  { id: "b1", type: "heading", content: "Why Python?", metadata: { level: 2 } },
                  {
                    id: "b2",
                    type: "paragraph",
                    content:
                      "Python is a high-level, interpreted programming language known for its simplicity and readability.",
                  },
                ],
                readingTime: 5,
              },
            },
          },
        },
        {
          title: "Python data types",
          type: "question",
          sectionId: "sec_intro",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "What is the data type of the value 3.14 in Python?",
              explanation: "3.14 is a decimal number, which is a float.",
              basePoints: 5,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "float", isCorrect: true },
                  { id: "b", text: "int", isCorrect: false },
                  { id: "c", text: "str", isCorrect: false },
                  { id: "d", text: "double", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Sum of two numbers",
          type: "question",
          sectionId: "sec_code",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "code",
              content: "Write a Python function that takes two numbers and returns their sum.",
              explanation: "def add(a, b): return a + b",
              basePoints: 15,
              difficulty: "easy",
              questionData: {
                language: "python",
                starterCode: "def add(a, b):\n    pass",
                testCases: [
                  { input: "add(3, 5)", expectedOutput: "8" },
                  { input: "add(-1, 1)", expectedOutput: "0" },
                ],
              },
            },
          },
        },
        {
          title: "String reversal",
          type: "question",
          sectionId: "sec_code",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "code",
              content: "Write a function that reverses a given string without slicing.",
              explanation: "Use a loop.",
              basePoints: 20,
              difficulty: "medium",
              questionData: {
                language: "python",
                starterCode: "def reverse_string(s):\n    pass",
                testCases: [{ input: 'reverse_string("hello")', expectedOutput: '"olleh"' }],
              },
            },
          },
        },
      ],
    },
    {
      title: "Control Flow",
      description: "Conditionals (if/elif/else) and loops (for, while).",
      type: "standard",
      sections: [{ id: "sec_cf", title: "Control Flow", orderIndex: 0 }],
      items: [
        {
          title: "If-else basics",
          type: "question",
          sectionId: "sec_cf",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content:
                'What will be the output of:\nx = 10\nif x > 5:\n    print("High")\nelse:\n    print("Low")',
              basePoints: 5,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "High", isCorrect: true },
                  { id: "b", text: "Low", isCorrect: false },
                  { id: "c", text: "Error", isCorrect: false },
                  { id: "d", text: "None", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "FizzBuzz",
          type: "question",
          sectionId: "sec_cf",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "code",
              content:
                'Write fizzbuzz(n) that returns a list of strings from 1 to n. Multiples of 3: "Fizz", 5: "Buzz", both: "FizzBuzz".',
              basePoints: 25,
              difficulty: "medium",
              questionData: {
                language: "python",
                starterCode: "def fizzbuzz(n):\n    pass",
                testCases: [
                  { input: "fizzbuzz(5)", expectedOutput: '["1", "2", "Fizz", "4", "Buzz"]' },
                ],
              },
            },
          },
        },
        {
          title: "While loop output",
          type: "question",
          sectionId: "sec_cf",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "numerical",
              content: "How many times will this loop execute?\ni = 1\nwhile i <= 100:\n    i *= 2",
              explanation: "i goes: 1->2->4->8->16->32->64->128. Loop runs 7 times.",
              basePoints: 10,
              difficulty: "medium",
              questionData: { correctAnswer: 7, tolerance: 0 },
            },
          },
        },
      ],
    },
    {
      title: "Functions & Modules",
      description: "Defining functions, parameters, return values, and using modules.",
      type: "standard",
      sections: [{ id: "sec_fn", title: "Functions", orderIndex: 0 }],
      items: [
        {
          title: "Default parameters",
          type: "question",
          sectionId: "sec_fn",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content:
                'What is the output of:\ndef greet(name="World"):\n    return f"Hello, {name}!"\nprint(greet())',
              basePoints: 5,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "Hello, World!", isCorrect: true },
                  { id: "b", text: "Hello, name!", isCorrect: false },
                  { id: "c", text: "Error", isCorrect: false },
                  { id: "d", text: "Hello, None!", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Fibonacci function",
          type: "question",
          sectionId: "sec_fn",
          difficulty: "hard",
          payload: {
            type: "question",
            data: {
              questionType: "code",
              content: "Write fibonacci(n) that returns the first n Fibonacci numbers as a list.",
              basePoints: 30,
              difficulty: "hard",
              questionData: {
                language: "python",
                starterCode: "def fibonacci(n):\n    pass",
                testCases: [{ input: "fibonacci(5)", expectedOutput: "[0, 1, 1, 2, 3]" }],
              },
            },
          },
        },
      ],
    },
    {
      title: "Python Quiz",
      description: "Timed assessment covering Python fundamentals.",
      type: "timed_test",
      sections: [],
      items: [
        {
          title: "Quiz Q1",
          type: "question",
          difficulty: "easy",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "Which keyword is used to define a function in Python?",
              basePoints: 5,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "def", isCorrect: true },
                  { id: "b", text: "function", isCorrect: false },
                  { id: "c", text: "func", isCorrect: false },
                  { id: "d", text: "define", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Quiz Q2",
          type: "question",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: 'What is the output of: len("Hello")',
              basePoints: 5,
              difficulty: "easy",
              questionData: {
                options: [
                  { id: "a", text: "5", isCorrect: true },
                  { id: "b", text: "4", isCorrect: false },
                  { id: "c", text: "6", isCorrect: false },
                  { id: "d", text: "Error", isCorrect: false },
                ],
              },
            },
          },
        },
        {
          title: "Quiz Q3",
          type: "question",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "true-false",
              content: "Python lists are immutable.",
              basePoints: 5,
              difficulty: "easy",
              questionData: { correctAnswer: false },
            },
          },
        },
        {
          title: "Quiz Q4",
          type: "question",
          difficulty: "medium",
          payload: {
            type: "question",
            data: {
              questionType: "mcq",
              content: "Which of the following creates a dictionary in Python?",
              basePoints: 5,
              difficulty: "medium",
              questionData: {
                options: [
                  { id: "a", text: '{"key": "value"}', isCorrect: true },
                  { id: "b", text: '["key", "value"]', isCorrect: false },
                  { id: "c", text: '("key", "value")', isCorrect: false },
                  { id: "d", text: "{key = value}", isCorrect: false },
                ],
              },
            },
          },
        },
      ],
    },
  ],
};

const ALL_SPACES = [mathSpace, scienceSpace, physicsSpace, chemistrySpace, csSpace];

// Exam data (AutoGrade)
const EXAMS = [
  {
    title: "Grade 8 — Math Mid-Term Exam",
    subject: "Mathematics",
    topics: ["Algebra", "Geometry", "Arithmetic"],
    classIds: ["cls_g8_math"],
    duration: 90,
    totalMarks: 50,
    passingMarks: 20,
    questions: [
      { text: "Simplify: (3x + 2)(x - 4)", marks: 5, type: "short_answer" },
      {
        text: "Find the area of a triangle with base 10cm and height 6cm.",
        marks: 5,
        type: "short_answer",
      },
      { text: "Solve for x: 5x - 3 = 2x + 9", marks: 5, type: "short_answer" },
      {
        text: "Prove that the sum of angles of a triangle is 180 degrees.",
        marks: 10,
        type: "long_answer",
      },
      {
        text: "A shopkeeper buys 100 pens at Rs.5 each and sells at Rs.7 each. Find profit percentage.",
        marks: 10,
        type: "long_answer",
      },
      { text: "Draw the graph of y = 2x + 1 for x = -2 to 3.", marks: 15, type: "diagram" },
    ],
  },
  {
    title: "Grade 10 — Physics Unit Test",
    subject: "Physics",
    topics: ["Kinematics", "Laws of Motion"],
    classIds: ["cls_g10_phy"],
    duration: 60,
    totalMarks: 40,
    passingMarks: 16,
    questions: [
      { text: "State Newton's three laws of motion.", marks: 6, type: "short_answer" },
      {
        text: "A car starts from rest and attains a velocity of 72 km/h in 10s. Find acceleration and distance covered.",
        marks: 8,
        type: "long_answer",
      },
      { text: "Derive the equation s = ut + 1/2 at^2.", marks: 8, type: "long_answer" },
      {
        text: "A ball is thrown vertically upward with u = 40 m/s. Find max height and time of flight. (g = 10 m/s^2)",
        marks: 10,
        type: "long_answer",
      },
      {
        text: "Explain the concept of inertia with three examples.",
        marks: 8,
        type: "long_answer",
      },
    ],
  },
  {
    title: "Grade 12 — CS Practical Exam",
    subject: "Computer Science",
    topics: ["Python Basics", "Control Flow", "Functions"],
    classIds: ["cls_g12_cs"],
    duration: 120,
    totalMarks: 50,
    passingMarks: 20,
    questions: [
      {
        text: "Write a Python program to check if a number is palindrome.",
        marks: 10,
        type: "code",
      },
      { text: "Implement bubble sort. Show dry run for [5,3,8,1,2].", marks: 15, type: "code" },
      {
        text: "Create a program to read a text file and count word frequencies.",
        marks: 15,
        type: "code",
      },
      {
        text: "Explain the difference between list, tuple, and dictionary with examples.",
        marks: 10,
        type: "long_answer",
      },
    ],
  },
];

// ===========================================================================
// MAIN SEED FUNCTION
// ===========================================================================
async function seed(): Promise<void> {
  console.log("==============================================================");
  console.log("  EMULATOR SEED SCRIPT — Greenwood International School");
  console.log("  Target: Emulators (Auth: localhost:9099, Firestore: localhost:8080)");
  console.log("==============================================================\n");

  // =========================================================================
  // STEP 1: Cleanup
  // =========================================================================
  console.log("[1/14] Clearing existing data...");
  await deleteAllAuthUsers();
  await clearFirestore();
  console.log("  Done.\n");

  // =========================================================================
  // STEP 2: Create Greenwood Tenant
  // =========================================================================
  console.log("[2/14] Creating tenant...");
  const tenantRef = db.collection("tenants").doc();
  const tenantId = tenantRef.id;
  IDS["tenantId"] = tenantId;

  await tenantRef.set({
    id: tenantId,
    name: SCHOOL_NAME,
    shortName: "Greenwood",
    slug: generateSlug(SCHOOL_NAME),
    description:
      "A premier K-12 international school offering CBSE curriculum with focus on technology-integrated learning.",
    tenantCode: TENANT_CODE,
    ownerUid: "placeholder",
    contactEmail: "admin@greenwood.edu",
    contactPhone: "+91-80-2345-6789",
    contactPerson: "Dr. Ramesh Krishnan",
    logoUrl: null,
    bannerUrl: null,
    website: "https://greenwood.edu",
    address: {
      street: "42 Knowledge Park",
      city: "Bangalore",
      state: "Karnataka",
      country: "India",
      zipCode: "560001",
    },
    status: "active",
    subscription: {
      plan: "premium",
      expiresAt: Timestamp.fromDate(new Date("2027-03-31")),
      maxStudents: 500,
      maxTeachers: 50,
      maxSpaces: 50,
      maxExamsPerMonth: 100,
    },
    features: {
      autoGradeEnabled: true,
      levelUpEnabled: true,
      scannerAppEnabled: true,
      aiChatEnabled: true,
      aiGradingEnabled: true,
      analyticsEnabled: true,
      parentPortalEnabled: true,
      bulkImportEnabled: true,
      apiAccessEnabled: true,
    },
    settings: {
      geminiKeySet: false,
      timezone: "Asia/Kolkata",
      locale: "en-IN",
    },
    stats: {
      totalStudents: 20,
      totalTeachers: 5,
      totalClasses: 5,
      totalSpaces: 5,
      totalExams: 3,
    },
    createdAt: ts(60),
    updatedAt: ts(0),
  });

  await db.doc(`tenantCodes/${TENANT_CODE}`).set({
    tenantId,
    createdAt: ts(60),
  });

  // Also create Riverside tenant for multi-org tests
  const riversideRef = db.collection("tenants").doc();
  const riversideId = riversideRef.id;
  await riversideRef.set({
    id: riversideId,
    name: "Riverside School",
    slug: "riverside-school",
    tenantCode: "RVS002",
    ownerUid: "placeholder",
    contactEmail: "admin@riverside.test",
    status: "active",
    subscription: {
      plan: "basic",
      maxStudents: 100,
      maxTeachers: 10,
      maxSpaces: 10,
      maxExamsPerMonth: 20,
    },
    features: {
      autoGradeEnabled: true,
      levelUpEnabled: true,
      scannerAppEnabled: false,
      aiChatEnabled: false,
      aiGradingEnabled: false,
      analyticsEnabled: true,
      parentPortalEnabled: true,
      bulkImportEnabled: false,
      apiAccessEnabled: false,
    },
    settings: { geminiKeySet: false, timezone: "America/Chicago", locale: "en-US" },
    stats: { totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalSpaces: 0, totalExams: 0 },
    createdAt: ts(60),
    updatedAt: ts(0),
  });
  await db.doc("tenantCodes/RVS002").set({ tenantId: riversideId, createdAt: ts(60) });

  console.log(`  Greenwood International School: ${tenantId}`);
  console.log(`  Riverside School: ${riversideId}\n`);

  // =========================================================================
  // STEP 3: Academic Session
  // =========================================================================
  console.log("[3/14] Creating academic session...");
  const sessionRef = db.collection(`tenants/${tenantId}/academicSessions`).doc();
  await sessionRef.set({
    id: sessionRef.id,
    tenantId,
    name: "2025-26",
    type: "annual",
    startDate: Timestamp.fromDate(new Date("2025-04-01")),
    endDate: Timestamp.fromDate(new Date("2026-03-31")),
    isCurrent: true,
    status: "active",
    createdAt: ts(60),
    updatedAt: ts(0),
  });
  IDS["academicSessionId"] = sessionRef.id;
  console.log(`  Session: 2025-26 (${sessionRef.id})\n`);

  // =========================================================================
  // STEP 4: Classes
  // =========================================================================
  console.log("[4/14] Creating classes...");
  for (const cls of CLASSES) {
    await db.doc(`tenants/${tenantId}/classes/${cls.id}`).set({
      id: cls.id,
      tenantId,
      name: cls.name,
      subject: cls.subject,
      grade: cls.grade,
      displayOrder: cls.displayOrder,
      academicSessionId: sessionRef.id,
      teacherIds: [],
      studentCount: 0,
      status: "active",
      createdAt: ts(55),
      updatedAt: ts(0),
    });
    CLASS_IDS.push(cls.id);
    console.log(`    ${cls.name}`);
  }
  console.log("");

  // =========================================================================
  // STEP 5: Super Admin
  // =========================================================================
  console.log("[5/14] Creating Super Admin...");
  const superAdminUid = await ensureAuthUser(
    "superadmin@levelup.app",
    DEFAULT_PASSWORD,
    "Super Admin"
  );
  await db.doc(`users/${superAdminUid}`).set({
    uid: superAdminUid,
    email: "superadmin@levelup.app",
    phone: null,
    authProviders: ["email"],
    displayName: "Super Admin",
    firstName: "Super",
    lastName: "Admin",
    photoURL: null,
    isSuperAdmin: true,
    consumerProfile: null,
    status: "active",
    createdAt: ts(30),
    updatedAt: ts(0),
  });
  await auth.setCustomUserClaims(superAdminUid, { role: "superAdmin" });
  console.log(`  superadmin@levelup.app (${superAdminUid})\n`);

  // =========================================================================
  // STEP 6: Tenant Admin
  // =========================================================================
  console.log("[6/14] Creating Tenant Admin...");
  const tenantAdminUid = await ensureAuthUser(
    "admin@greenwood.edu",
    DEFAULT_PASSWORD,
    "Dr. Ramesh Krishnan"
  );
  await db.doc(`users/${tenantAdminUid}`).set({
    uid: tenantAdminUid,
    email: "admin@greenwood.edu",
    phone: "+91-80-2345-6789",
    authProviders: ["email"],
    displayName: "Dr. Ramesh Krishnan",
    firstName: "Ramesh",
    lastName: "Krishnan",
    photoURL: null,
    isSuperAdmin: false,
    consumerProfile: null,
    status: "active",
    createdAt: ts(55),
    updatedAt: ts(0),
  });

  const taEntityRef = db.collection(`tenants/${tenantId}/teachers`).doc();
  await taEntityRef.set({
    id: taEntityRef.id,
    tenantId,
    authUid: tenantAdminUid,
    email: "admin@greenwood.edu",
    phone: "+91-80-2345-6789",
    firstName: "Ramesh",
    lastName: "Krishnan",
    displayName: "Dr. Ramesh Krishnan",
    employeeId: "GRN-ADMIN",
    department: "Administration",
    classIds: CLASS_IDS,
    subjects: [],
    status: "active",
    createdAt: ts(55),
    updatedAt: ts(0),
  });

  const taMembershipId = `${tenantAdminUid}_${tenantId}`;
  await db.doc(`userMemberships/${taMembershipId}`).set({
    id: taMembershipId,
    uid: tenantAdminUid,
    tenantId,
    tenantCode: TENANT_CODE,
    role: "tenantAdmin",
    status: "active",
    joinSource: "admin_created",
    teacherId: taEntityRef.id,
    permissions: null,
    createdAt: ts(55),
    updatedAt: ts(0),
  });

  await auth.setCustomUserClaims(
    tenantAdminUid,
    buildClaimsForMembership({
      role: "tenantAdmin",
      tenantId,
      tenantCode: TENANT_CODE,
      teacherId: taEntityRef.id,
    })
  );
  await tenantRef.update({ ownerUid: tenantAdminUid });
  console.log(`  admin@greenwood.edu (${tenantAdminUid})\n`);

  // =========================================================================
  // STEP 7: Teachers
  // =========================================================================
  console.log("[7/14] Creating teachers...");
  for (let i = 0; i < TEACHERS.length; i++) {
    const t = TEACHERS[i];
    const uid = await ensureAuthUser(t.email, DEFAULT_PASSWORD, `${t.firstName} ${t.lastName}`);
    await db.doc(`users/${uid}`).set({
      uid,
      email: t.email,
      phone: null,
      authProviders: ["email"],
      displayName: `${t.firstName} ${t.lastName}`,
      firstName: t.firstName,
      lastName: t.lastName,
      photoURL: null,
      isSuperAdmin: false,
      consumerProfile: null,
      status: "active",
      createdAt: ts(50),
      updatedAt: ts(0),
    });

    const entityRef = db.collection(`tenants/${tenantId}/teachers`).doc();
    await entityRef.set({
      id: entityRef.id,
      tenantId,
      authUid: uid,
      email: t.email,
      firstName: t.firstName,
      lastName: t.lastName,
      displayName: `${t.firstName} ${t.lastName}`,
      employeeId: t.employeeId,
      department: t.department,
      classIds: t.classIds,
      subjects: t.subjects,
      status: "active",
      createdAt: ts(50),
      updatedAt: ts(0),
    });

    TEACHER_ENTITY_IDS.push(entityRef.id);
    IDS[`teacher${i}Uid`] = uid;
    IDS[`teacher${i}EntityId`] = entityRef.id;

    const membershipId = `${uid}_${tenantId}`;
    await db.doc(`userMemberships/${membershipId}`).set({
      id: membershipId,
      uid,
      tenantId,
      tenantCode: TENANT_CODE,
      role: "teacher",
      status: "active",
      joinSource: "admin_created",
      teacherId: entityRef.id,
      permissions: t.permissions,
      createdAt: ts(50),
      updatedAt: ts(0),
    });

    await auth.setCustomUserClaims(
      uid,
      buildClaimsForMembership({
        role: "teacher",
        tenantId,
        tenantCode: TENANT_CODE,
        teacherId: entityRef.id,
        permissions: { managedClassIds: t.classIds },
      })
    );

    for (const classId of t.classIds) {
      await db.doc(`tenants/${tenantId}/classes/${classId}`).update({
        teacherIds: FieldValue.arrayUnion(uid),
      });
    }
    console.log(`    ${t.firstName} ${t.lastName} — ${t.subjects.join(", ")}`);
  }

  // Also add a multi-org teacher in Riverside for multi-org tests
  const teacher2Uid = IDS["teacher1Uid"]!; // Rajesh Kumar
  const teacher2RvsEntityId = await (async () => {
    const ref = db.collection(`tenants/${riversideId}/teachers`).doc();
    await ref.set({
      id: ref.id,
      tenantId: riversideId,
      authUid: teacher2Uid,
      email: "rajesh.kumar@greenwood.edu",
      firstName: "Rajesh",
      lastName: "Kumar",
      displayName: "Rajesh Kumar",
      subjects: ["Science"],
      status: "active",
      createdAt: ts(50),
      updatedAt: ts(0),
    });
    return ref.id;
  })();
  await db.doc(`userMemberships/${teacher2Uid}_${riversideId}`).set({
    id: `${teacher2Uid}_${riversideId}`,
    uid: teacher2Uid,
    tenantId: riversideId,
    tenantCode: "RVS002",
    role: "teacher",
    status: "active",
    joinSource: "admin_created",
    teacherId: teacher2RvsEntityId,
    permissions: { managedClassIds: [] },
    createdAt: ts(50),
    updatedAt: ts(0),
  });
  console.log("    Rajesh Kumar — also added to Riverside School\n");

  // =========================================================================
  // STEP 8: Students
  // =========================================================================
  console.log("[8/14] Creating students...");
  for (let i = 0; i < STUDENTS.length; i++) {
    const s = STUDENTS[i];
    const uid = await ensureAuthUser(s.email, DEFAULT_PASSWORD, `${s.firstName} ${s.lastName}`);
    STUDENT_UIDS.push(uid);

    await db.doc(`users/${uid}`).set({
      uid,
      email: s.email,
      phone: null,
      authProviders: ["email"],
      displayName: `${s.firstName} ${s.lastName}`,
      firstName: s.firstName,
      lastName: s.lastName,
      photoURL: null,
      isSuperAdmin: false,
      consumerProfile: null,
      grade: s.grade,
      status: "active",
      createdAt: ts(45),
      updatedAt: ts(0),
    });

    const entityRef = db.collection(`tenants/${tenantId}/students`).doc();
    await entityRef.set({
      id: entityRef.id,
      tenantId,
      authUid: uid,
      email: s.email,
      firstName: s.firstName,
      lastName: s.lastName,
      displayName: `${s.firstName} ${s.lastName}`,
      rollNumber: s.rollNumber,
      classIds: s.classIds,
      parentIds: [],
      status: "active",
      metadata: { admissionYear: "2025" },
      createdAt: ts(45),
      updatedAt: ts(0),
    });

    STUDENT_ENTITY_IDS.push(entityRef.id);
    IDS[`student${i}Uid`] = uid;
    IDS[`student${i}EntityId`] = entityRef.id;

    const membershipId = `${uid}_${tenantId}`;
    await db.doc(`userMemberships/${membershipId}`).set({
      id: membershipId,
      uid,
      tenantId,
      tenantCode: TENANT_CODE,
      role: "student",
      status: "active",
      joinSource: "admin_created",
      studentId: entityRef.id,
      permissions: { managedClassIds: s.classIds },
      createdAt: ts(45),
      updatedAt: ts(0),
    });

    await auth.setCustomUserClaims(
      uid,
      buildClaimsForMembership({
        role: "student",
        tenantId,
        tenantCode: TENANT_CODE,
        studentId: entityRef.id,
        permissions: { managedClassIds: s.classIds },
      })
    );

    for (const classId of s.classIds) {
      await db.doc(`tenants/${tenantId}/classes/${classId}`).update({
        studentCount: FieldValue.increment(1),
      });
    }
    console.log(`    ${s.firstName} ${s.lastName} (${s.rollNumber}) — ${s.classIds.join(", ")}`);
  }

  // Consumer user
  const consumerUid = await ensureAuthUser("consumer@gmail.test", "Consumer123!", "Consumer User");
  await db.doc(`users/${consumerUid}`).set({
    uid: consumerUid,
    email: "consumer@gmail.test",
    phone: null,
    authProviders: ["email"],
    displayName: "Consumer User",
    firstName: "Consumer",
    lastName: "User",
    photoURL: null,
    isSuperAdmin: false,
    consumerProfile: { plan: "free", enrolledSpaceIds: [] },
    status: "active",
    createdAt: ts(30),
    updatedAt: ts(0),
  });
  console.log("    Consumer User (consumer@gmail.test)\n");

  // =========================================================================
  // STEP 9: Parents
  // =========================================================================
  console.log("[9/14] Creating parents...");
  for (let i = 0; i < PARENTS.length; i++) {
    const p = PARENTS[i];
    const uid = await ensureAuthUser(p.email, DEFAULT_PASSWORD, `${p.firstName} ${p.lastName}`);
    const linkedStudentEntityIds = p.linkedStudentIndexes.map((idx) => STUDENT_ENTITY_IDS[idx]);
    const linkedStudentUids = p.linkedStudentIndexes.map((idx) => STUDENT_UIDS[idx]);

    await db.doc(`users/${uid}`).set({
      uid,
      email: p.email,
      phone: null,
      authProviders: ["email"],
      displayName: `${p.firstName} ${p.lastName}`,
      firstName: p.firstName,
      lastName: p.lastName,
      photoURL: null,
      isSuperAdmin: false,
      consumerProfile: null,
      status: "active",
      createdAt: ts(40),
      updatedAt: ts(0),
    });

    const entityRef = db.collection(`tenants/${tenantId}/parents`).doc();
    await entityRef.set({
      id: entityRef.id,
      tenantId,
      authUid: uid,
      email: p.email,
      firstName: p.firstName,
      lastName: p.lastName,
      displayName: `${p.firstName} ${p.lastName}`,
      linkedStudentIds: linkedStudentEntityIds,
      relationship: p.relationship,
      notificationPreferences: {
        emailNotifications: true,
        resultReleaseAlerts: true,
        weeklyProgressDigest: true,
        atRiskAlerts: true,
      },
      status: "active",
      createdAt: ts(40),
      updatedAt: ts(0),
    });

    const membershipId = `${uid}_${tenantId}`;
    await db.doc(`userMemberships/${membershipId}`).set({
      id: membershipId,
      uid,
      tenantId,
      tenantCode: TENANT_CODE,
      role: "parent",
      status: "active",
      joinSource: "admin_created",
      parentId: entityRef.id,
      parentLinkedStudentIds: linkedStudentUids,
      createdAt: ts(40),
      updatedAt: ts(0),
    });

    await auth.setCustomUserClaims(
      uid,
      buildClaimsForMembership({
        role: "parent",
        tenantId,
        tenantCode: TENANT_CODE,
        parentId: entityRef.id,
        parentLinkedStudentIds: linkedStudentUids,
      })
    );

    for (const idx of p.linkedStudentIndexes) {
      await db.doc(`tenants/${tenantId}/students/${STUDENT_ENTITY_IDS[idx]}`).update({
        parentIds: FieldValue.arrayUnion(entityRef.id),
      });
    }
    console.log(
      `    ${p.firstName} ${p.lastName} -> ${p.linkedStudentIndexes.map((idx) => STUDENTS[idx].firstName).join(", ")}`
    );
  }
  console.log("");

  // =========================================================================
  // STEP 10: Learning Spaces + Story Points + Items
  // =========================================================================
  console.log("[10/14] Creating spaces, story points, and items...");
  for (let si = 0; si < ALL_SPACES.length; si++) {
    const space = ALL_SPACES[si];
    const spaceRef = db.collection(`tenants/${tenantId}/spaces`).doc();
    const spaceId = spaceRef.id;
    SPACE_IDS.push(spaceId);
    IDS[`space${si}Id`] = spaceId;

    const teacherUid = IDS[`teacher${space.teacherIndex}Uid`]!;

    let totalItems = 0;
    for (const sp of space.storyPoints) totalItems += sp.items.length;

    await spaceRef.set({
      id: spaceId,
      tenantId,
      title: space.title,
      description: space.description,
      thumbnailUrl: null,
      slug: generateSlug(space.title),
      type: space.type,
      classIds: space.classIds,
      teacherIds: [teacherUid],
      accessType: "class_assigned",
      subject: space.subject,
      labels: [space.subject.toLowerCase()],
      academicSessionId: sessionRef.id,
      defaultTimeLimitMinutes: 30,
      allowRetakes: true,
      maxRetakes: 3,
      status: "published",
      publishedAt: ts(30),
      stats: {
        totalStoryPoints: space.storyPoints.length,
        totalItems,
        totalStudents: 0,
        avgCompletionRate: 0,
      },
      createdBy: teacherUid,
      createdAt: ts(35),
      updatedAt: ts(0),
    });
    console.log(`  Space: ${space.title} (${spaceId})`);

    for (let spi = 0; spi < space.storyPoints.length; spi++) {
      const sp = space.storyPoints[spi];
      const spRef = db.collection(`tenants/${tenantId}/spaces/${spaceId}/storyPoints`).doc();

      await spRef.set({
        id: spRef.id,
        courseId: spaceId,
        spaceId,
        tenantId,
        title: sp.title,
        description: sp.description,
        orderIndex: spi,
        type: sp.type,
        sections: sp.sections,
        createdAt: ts(30),
        updatedAt: ts(0),
      });

      IDS[`space${si}_sp${spi}Id`] = spRef.id;
      console.log(`    SP: ${sp.title} (${spRef.id})`);

      for (let ii = 0; ii < sp.items.length; ii++) {
        const item = sp.items[ii];
        const itemRef = db.collection(`tenants/${tenantId}/spaces/${spaceId}/items`).doc();
        const basePoints = item.payload?.data?.basePoints ?? 10;

        await itemRef.set({
          id: itemRef.id,
          courseId: spaceId,
          storyPointId: spRef.id,
          sectionId: item.sectionId || null,
          type: item.type,
          title: item.title,
          content: item.payload?.data?.content || null,
          difficulty: item.difficulty || null,
          payload: item.payload,
          meta: {
            totalPoints: item.type === "question" ? basePoints : 0,
            tags: [space.subject.toLowerCase()],
          },
          sect_order_idx: ii,
          orderIndex: ii,
          createdAt: ts(28),
          updatedAt: ts(0),
        });
        console.log(`      Item: ${item.title} (${item.type})`);
      }
    }
  }
  console.log("");

  // =========================================================================
  // STEP 11: AutoGrade Exams
  // =========================================================================
  console.log("[11/14] Creating AutoGrade exams...");
  for (let ei = 0; ei < EXAMS.length; ei++) {
    const exam = EXAMS[ei];
    const examRef = db.collection(`tenants/${tenantId}/exams`).doc();

    await examRef.set({
      id: examRef.id,
      tenantId,
      title: exam.title,
      subject: exam.subject,
      topics: exam.topics,
      classIds: exam.classIds,
      examDate: ts(14 - ei * 7),
      duration: exam.duration,
      academicSessionId: sessionRef.id,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      gradingConfig: {
        autoGrade: true,
        allowRubricEdit: true,
        questionPaperType: "standard",
        allowManualOverride: true,
        requireOverrideReason: true,
        releaseResultsAutomatically: false,
      },
      status: "completed",
      stats: { totalSubmissions: 0, gradedSubmissions: 0, avgScore: 0, passRate: 0 },
      createdBy: IDS["teacher0Uid"] || tenantAdminUid,
      createdAt: ts(30),
      updatedAt: ts(0),
    });

    IDS[`exam${ei}Id`] = examRef.id;
    console.log(`  Exam: ${exam.title} (${examRef.id})`);

    for (let qi = 0; qi < exam.questions.length; qi++) {
      const q = exam.questions[qi];
      const qRef = db.collection(`tenants/${tenantId}/exams/${examRef.id}/questions`).doc();
      await qRef.set({
        id: qRef.id,
        examId: examRef.id,
        tenantId,
        questionNumber: qi + 1,
        text: q.text,
        marks: q.marks,
        type: q.type,
        rubric: { criteria: [{ description: "Correctness", maxMarks: q.marks }] },
        orderIndex: qi,
        createdAt: ts(30),
        updatedAt: ts(0),
      });
      console.log(`    Q${qi + 1}: ${q.text.substring(0, 50)}... (${q.marks} marks)`);
    }
  }
  console.log("");

  // =========================================================================
  // STEP 12: Student Progress
  // =========================================================================
  console.log("[12/14] Creating student progress...");
  const firstSpaceId = SPACE_IDS[0];
  const firstSpSP0 = IDS["space0_sp0Id"]!;

  for (let si = 0; si < 4 && si < STUDENT_UIDS.length; si++) {
    const studentUid = STUDENT_UIDS[si];
    const progressDocId = `${studentUid}_${firstSpSP0}`;

    const itemsSnap = await db
      .collection(`tenants/${tenantId}/spaces/${firstSpaceId}/items`)
      .where("storyPointId", "==", firstSpSP0)
      .get();

    const itemsMap: Record<string, any> = {};
    let totalEarned = 0;
    let totalPoints = 0;

    itemsSnap.docs.forEach((doc) => {
      const itemData = doc.data();
      const pts = itemData.meta?.totalPoints || 10;
      totalPoints += pts;
      const earned = si === 0 ? pts : Math.floor(pts * (0.5 + Math.random() * 0.5));
      totalEarned += earned;
      const completed = earned >= pts * 0.5;

      const entry: Record<string, any> = {
        itemId: doc.id,
        itemType: itemData.type,
        completed,
        completedAt: completed ? ts(10 - si).toMillis() : null,
        timeSpent: 30 + Math.floor(Math.random() * 120),
        interactions: 1 + Math.floor(Math.random() * 3),
        lastUpdatedAt: ts(10 - si).toMillis(),
      };
      if (itemData.type === "question") {
        entry.questionData = {
          questionId: doc.id,
          status: completed ? "correct" : "partial",
          attemptsCount: 1 + Math.floor(Math.random() * 2),
          bestScore: earned,
          pointsEarned: earned,
          totalPoints: pts,
          percentage: earned / pts,
          solved: completed,
          submissions: [
            {
              id: `sub_${doc.id}_${si}`,
              createdAt: ts(10 - si).toMillis(),
              mode: "tutorial",
              type: itemData.payload?.data?.questionType || "mcq",
              submission: { selectedOption: "a" },
              correctness: earned / pts,
              pointsEarned: earned,
              totalPoints: pts,
            },
          ],
        };
      } else {
        entry.progress = 100;
      }
      itemsMap[doc.id] = entry;
    });

    await db.doc(`tenants/${tenantId}/spaceProgress/${progressDocId}`).set({
      id: progressDocId,
      userId: studentUid,
      courseId: firstSpaceId,
      storyPointId: firstSpSP0,
      status: totalEarned >= totalPoints * 0.8 ? "completed" : "in_progress",
      pointsEarned: totalEarned,
      totalPoints,
      percentage: totalPoints > 0 ? totalEarned / totalPoints : 0,
      items: itemsMap,
      updatedAt: ts(10 - si).toMillis(),
    });
    console.log(
      `    Progress: Student ${si + 1} on ${firstSpSP0} — ${totalEarned}/${totalPoints} pts`
    );
  }
  console.log("");

  // =========================================================================
  // STEP 13: Exam Submissions
  // =========================================================================
  console.log("[13/14] Creating exam submissions...");
  for (const exam of EXAMS) {
    const examId = IDS[`exam${EXAMS.indexOf(exam)}Id`]!;
    const examStudents = STUDENTS.filter((s) =>
      s.classIds.some((cid) => exam.classIds.includes(cid))
    );

    const questionsSnap = await db
      .collection(`tenants/${tenantId}/exams/${examId}/questions`)
      .get();
    const questions = questionsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Record<string, any>),
    }));

    const submittingStudents = examStudents.slice(0, Math.ceil(examStudents.length * 0.7));
    let examTotalScore = 0;
    let gradedCount = 0;

    for (let si = 0; si < submittingStudents.length; si++) {
      const studentIdx = STUDENTS.indexOf(submittingStudents[si]);
      const studentEntityId = STUDENT_ENTITY_IDS[studentIdx];
      const studentUid = STUDENT_UIDS[studentIdx];

      const submissionRef = db.collection(`tenants/${tenantId}/submissions`).doc();
      const studentScore = randomBetween(Math.floor(exam.totalMarks * 0.3), exam.totalMarks);
      const percentage = (studentScore / exam.totalMarks) * 100;
      const gradeThresholds = [
        { min: 90, grade: "A+" },
        { min: 80, grade: "A" },
        { min: 70, grade: "B+" },
        { min: 60, grade: "B" },
        { min: 50, grade: "C" },
        { min: 40, grade: "D" },
        { min: 0, grade: "F" },
      ];
      const grade = gradeThresholds.find((t) => percentage >= t.min)?.grade || "F";

      await submissionRef.set({
        id: submissionRef.id,
        tenantId,
        examId,
        studentId: studentEntityId,
        studentName: `${submittingStudents[si].firstName} ${submittingStudents[si].lastName}`,
        rollNumber: submittingStudents[si].rollNumber,
        classId: submittingStudents[si].classIds[0],
        answerSheets: {
          images: [`gs://lvlup-ff6fa.appspot.com/submissions/${submissionRef.id}/page1.jpg`],
          uploadedAt: ts(10),
          uploadedBy: studentUid,
          uploadSource: "web",
        },
        summary: {
          totalScore: studentScore,
          maxScore: exam.totalMarks,
          percentage,
          grade,
          questionsGraded: questions.length,
          totalQuestions: questions.length,
          completedAt: ts(8),
        },
        pipelineStatus: "grading_complete",
        retryCount: 0,
        resultsReleased: true,
        resultsReleasedAt: ts(5),
        resultsReleasedBy: tenantAdminUid,
        createdAt: ts(10),
        updatedAt: ts(5),
      });

      examTotalScore += studentScore;
      gradedCount++;

      // Create question-level submissions
      let remainingScore = studentScore;
      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];
        const maxMarks = q.marks || 5;
        const isLast = qi === questions.length - 1;
        const qScore = isLast
          ? Math.max(0, Math.min(maxMarks, remainingScore))
          : Math.min(maxMarks, randomBetween(Math.floor(maxMarks * 0.3), maxMarks));
        remainingScore -= qScore;

        const qSubRef = db
          .collection(`tenants/${tenantId}/submissions/${submissionRef.id}/questionSubmissions`)
          .doc(q.id);
        await qSubRef.set({
          id: q.id,
          submissionId: submissionRef.id,
          questionId: q.id,
          examId,
          evaluation: {
            score: qScore,
            maxScore: maxMarks,
            correctness: qScore / maxMarks,
            percentage: (qScore / maxMarks) * 100,
            strengths: qScore >= maxMarks * 0.8 ? ["Good understanding"] : ["Attempted"],
            weaknesses: qScore < maxMarks * 0.6 ? ["Incomplete answer"] : [],
            confidence: 0.85 + Math.random() * 0.1,
            gradedAt: ts(8),
          },
          gradingStatus: "graded",
          createdAt: ts(10),
          updatedAt: ts(8),
        });
      }
    }

    const avgScore = gradedCount > 0 ? examTotalScore / gradedCount : 0;
    await db.doc(`tenants/${tenantId}/exams/${examId}`).update({
      "stats.totalSubmissions": submittingStudents.length,
      "stats.gradedSubmissions": submittingStudents.length,
      "stats.avgScore": Math.round(avgScore),
      status: "results_released",
      updatedAt: ts(0),
    });
    console.log(`  ${exam.title}: ${submittingStudents.length} submissions`);
  }
  console.log("");

  // =========================================================================
  // STEP 14: Chat Session Sample
  // =========================================================================
  console.log("[14/14] Creating sample chat session...");
  const chatRef = db.collection(`tenants/${tenantId}/chatSessions`).doc();
  await chatRef.set({
    id: chatRef.id,
    userId: STUDENT_UIDS[0],
    courseId: firstSpaceId,
    storyPointId: firstSpSP0,
    itemId: "sample_item",
    questionType: "mcq",
    sessionTitle: "Help with Algebraic Expressions",
    previewMessage: "Can you explain how to factorize x^2 + 5x + 6?",
    createdAt: ts(8),
    updatedAt: ts(8),
    messageCount: 4,
    language: "english",
    isActive: true,
    messages: [
      {
        id: "msg1",
        role: "user",
        text: "Can you explain how to factorize x^2 + 5x + 6?",
        timestamp: new Date(now - 8 * 86400000).toISOString(),
      },
      {
        id: "msg2",
        role: "assistant",
        text: "To factorize x^2 + 5x + 6, find two numbers that multiply to 6 and add to 5. Those are 2 and 3.",
        timestamp: new Date(now - 8 * 86400000 + 30000).toISOString(),
      },
      {
        id: "msg3",
        role: "user",
        text: "2 and 3! Because 2 * 3 = 6 and 2 + 3 = 5",
        timestamp: new Date(now - 8 * 86400000 + 60000).toISOString(),
      },
      {
        id: "msg4",
        role: "assistant",
        text: "Exactly! So x^2 + 5x + 6 = (x + 2)(x + 3). Verify by expanding: (x + 2)(x + 3) = x^2 + 5x + 6.",
        timestamp: new Date(now - 8 * 86400000 + 90000).toISOString(),
      },
    ],
    systemPrompt: "You are a helpful math tutor for Grade 8 students.",
  });
  console.log(`  Chat session: ${chatRef.id}\n`);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("==============================================================");
  console.log("  SEED COMPLETE");
  console.log("--------------------------------------------------------------");
  console.log(`  Tenant: ${SCHOOL_NAME}`);
  console.log(`  Tenant ID: ${tenantId}`);
  console.log(`  Tenant Code: ${TENANT_CODE}`);
  console.log("--------------------------------------------------------------");
  console.log("  LOGIN CREDENTIALS (all passwords: Test@12345)");
  console.log("--------------------------------------------------------------");
  console.log("  Super Admin:    superadmin@levelup.app");
  console.log("  Tenant Admin:   admin@greenwood.edu");
  console.log("  Teacher 1:      priya.sharma@greenwood.edu (Math)");
  console.log("  Teacher 2:      rajesh.kumar@greenwood.edu (Sci+Phy)");
  console.log("  Teacher 3:      anita.desai@greenwood.edu (Chem)");
  console.log("  Teacher 4:      vikram.singh@greenwood.edu (CS)");
  console.log("  Student 1:      aarav.patel@greenwood.edu");
  console.log("  Student 2:      diya.gupta@greenwood.edu");
  console.log("  ...and 18 more students");
  console.log("  Parent 1:       suresh.patel@gmail.com");
  console.log("  ...and 7 more parents");
  console.log("  Consumer:       consumer@gmail.test / Consumer123!");
  console.log("--------------------------------------------------------------");
  console.log("  DATA CREATED:");
  console.log(`  - 2 Tenants (Greenwood + Riverside)`);
  console.log(`  - 1 Academic Session (2025-26)`);
  console.log(`  - 5 Classes`);
  console.log(`  - 5 Teachers (1 admin + 4), 1 multi-org`);
  console.log(`  - 20 Students + 1 Consumer`);
  console.log(`  - 8 Parents`);
  console.log(
    `  - 5 Learning Spaces with ${ALL_SPACES.reduce((a, s) => a + s.storyPoints.length, 0)} Story Points`
  );
  console.log(
    `  - ~${ALL_SPACES.reduce((a, s) => a + s.storyPoints.reduce((b, sp) => b + sp.items.length, 0), 0)} Items (questions + materials)`
  );
  console.log(
    `  - 3 AutoGrade Exams with ${EXAMS.reduce((a, e) => a + e.questions.length, 0)} Questions`
  );
  console.log(`  - Exam submissions with grades`);
  console.log(`  - Student progress data`);
  console.log(`  - AI chat session sample`);
  console.log("==============================================================");
}

// ===========================================================================
// RUN
// ===========================================================================
seed().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
