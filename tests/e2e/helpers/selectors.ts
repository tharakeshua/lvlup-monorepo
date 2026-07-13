// Common selectors used across E2E tests
export const SELECTORS = {
  // Inputs
  email: "#email",
  password: "#password",
  schoolCode: "#schoolCode",
  credential: "#credential",
  consumerEmail: "#consumerEmail",
  consumerPassword: "#consumerPassword",
  signupName: "#signupName",
  signupEmail: "#signupEmail",
  signupPassword: "#signupPassword",

  // Buttons (text-based)
  signIn: 'button[type="submit"]:has-text("Sign In")',
  continue: 'button[type="submit"]:has-text("Continue")',
  signOut: 'button:has-text("Sign Out")',
  change: 'button:has-text("Change")',
  createAccount: 'button[type="submit"]:has-text("Create Account")',

  // Dashboard headings
  dashboards: {
    superAdmin: "Super Admin Dashboard",
    schoolAdmin: "School Admin Dashboard",
    teacher: "Teacher Dashboard",
    student: "Dashboard",
    parent: "Parent Dashboard",
    consumer: "My Learning",
  },
} as const;

// Test credentials (production Firebase - Greenwood International School)
export const CREDENTIALS = {
  superAdmin: { email: "superadmin@levelup.app", password: "Test@12345" },
  tenantAdmin: { email: "admin@greenwood.edu", password: "Test@12345" },
  teacher1: { email: "priya.sharma@greenwood.edu", password: "Test@12345" },
  teacher2: { email: "rajesh.kumar@greenwood.edu", password: "Test@12345" },
  teacher3: { email: "anita.desai@greenwood.edu", password: "Test@12345" },
  teacher4: { email: "vikram.singh@greenwood.edu", password: "Test@12345" },
  student1: { email: "aarav.patel@greenwood.edu", password: "Test@12345" },
  student2: { email: "diya.gupta@greenwood.edu", password: "Test@12345" },
  studentRoll: { rollNumber: "2025001", password: "Test@12345" },
  parent1: { email: "suresh.patel@gmail.com", password: "Test@12345" },
  parent2: { email: "meena.gupta@gmail.com", password: "Test@12345" },
  consumer: { email: "consumer@gmail.test", password: "Consumer123!" },
} as const;

export const SCHOOL_CODE = "GRN001";
export const SCHOOL_NAME = "Greenwood International School";

// ── Seed dataset credentials (loaded from scripts/seed-results/*.json) ────
export const SEED_DATASETS = {
  subhang: {
    schoolCode: "SUB001",
    schoolName: "Subhang Academy",
    admin: { email: "subhang.rocklee@gmail.com", password: "Test@12345" },
    student: { email: "student.test@subhang.academy", password: "Test@12345" },
    parent: { email: "parent.test@subhang.academy", password: "Test@12345" },
  },
} as const;
