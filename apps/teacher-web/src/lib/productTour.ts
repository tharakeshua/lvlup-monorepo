/**
 * Guided product tour for the Teacher app (driver.js). Highlights each sidebar
 * feature on first login; dismissible at any point and re-triggerable later from
 * Settings. First-run state is persisted per-user in localStorage.
 */
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_DONE_KEY = "teacherProductTourDone.v1";

/** Ordered walkthrough of the sidebar. Each step targets a `data-tour` anchor
 * rendered on the sidebar rows (see AppLayout navGroups + AppSidebar). */
const STEPS: DriveStep[] = [
  {
    element: '[data-tour="dashboard"]',
    popover: {
      title: "Dashboard",
      description:
        "Your home base — at-a-glance totals for students, exams and spaces, plus a class-wise breakdown and recent activity.",
    },
  },
  {
    element: '[data-tour="spaces"]',
    popover: {
      title: "Spaces",
      description:
        "Build and manage learning spaces: story points, questions and materials. This is where you author content.",
    },
  },
  {
    element: '[data-tour="exams"]',
    popover: {
      title: "Exams",
      description:
        "Create written/AutoGrade exams, upload answer sheets, run AI grading and release results to students.",
    },
  },
  {
    element: '[data-tour="ai-settings"]',
    popover: {
      title: "AI Settings & Rubric Presets",
      description:
        "Configure AI grading behaviour and manage reusable rubric presets that you can attach to questions and exams.",
    },
  },
  {
    element: '[data-tour="grading"]',
    popover: {
      title: "Batch Grading",
      description:
        "Grade many submissions efficiently in one place — review AI scores, override, and release in bulk.",
    },
  },
  {
    element: '[data-tour="analytics-students"]',
    popover: {
      title: "Student Analytics",
      description: "Per-student performance trends, strengths and areas to grow.",
    },
  },
  {
    element: '[data-tour="analytics-exams"]',
    popover: {
      title: "Exam Analytics",
      description: "Question-level and cohort insights for each exam.",
    },
  },
  {
    element: '[data-tour="analytics-spaces"]',
    popover: {
      title: "Space Analytics",
      description: "Engagement and mastery across your learning spaces.",
    },
  },
  {
    element: '[data-tour="analytics-classes"]',
    popover: {
      title: "Class Analytics",
      description: "Compare classes and spot which cohorts need attention.",
    },
  },
  {
    element: '[data-tour="leaderboards"]',
    popover: {
      title: "Space Leaderboard",
      description: "Motivating leaderboards per space to celebrate top performers.",
    },
  },
  {
    element: '[data-tour="classes"]',
    popover: {
      title: "Classes",
      description: "Organise students into classes and manage their rosters.",
    },
  },
  {
    element: '[data-tour="students"]',
    popover: {
      title: "Students",
      description: "Your full student directory — enrolment, profiles and progress.",
    },
  },
  {
    element: '[data-tour="parents"]',
    popover: {
      title: "Parents",
      description: "Manage parent/guardian contacts linked to your students.",
    },
  },
  {
    element: '[data-tour="settings"]',
    popover: {
      title: "Settings",
      description:
        "Account and workspace preferences. You can replay this tour any time from here.",
    },
  },
];

export function hasSeenTeacherTour(): boolean {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) === "1";
  } catch {
    return true; // if storage is unavailable, don't nag
  }
}

function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Start the guided tour. Filters to steps whose target is actually present +
 * visible (e.g. the sidebar is hidden on mobile / a role may lack a page), so
 * driver.js never stalls on a missing element. Marks the tour seen the moment it
 * STARTS (not on destroy): driver.js's onDestroyed does not reliably fire across
 * exit paths — X button, Escape, or finishing all steps — so persisting on start
 * guarantees the auto-tour never re-shows regardless of how the user exits. */
export function startTeacherTour(): void {
  const steps = STEPS.filter((s) => {
    const sel = typeof s.element === "string" ? s.element : undefined;
    if (!sel) return false;
    const el = document.querySelector(sel) as HTMLElement | null;
    return !!el && el.offsetParent !== null;
  });
  if (steps.length === 0) return;

  // Persist BEFORE driving — one exposure is enough to count as "seen", and this
  // is immune to driver.js not calling onDestroyed on every exit path.
  markTourSeen();

  const d = driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.6,
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    steps,
    onDestroyed: () => markTourSeen(),
  });
  d.drive();
}

/** Auto-start the tour on a teacher's first login, once the sidebar has rendered.
 * No-op if already seen or if the sidebar isn't visible (mobile). Returns a
 * cleanup fn for the pending timer. */
export function maybeStartTeacherTourOnFirstLogin(): () => void {
  if (hasSeenTeacherTour()) return () => {};
  // Defer so the sidebar + main content have mounted and layout has settled.
  const timer = window.setTimeout(() => {
    const anchor = document.querySelector('[data-tour="dashboard"]') as HTMLElement | null;
    if (anchor && anchor.offsetParent !== null) {
      startTeacherTour();
    } else {
      // Sidebar not visible (e.g. mobile) — don't burn the first-run flag; let it
      // trigger on a later desktop session instead.
    }
  }, 900);
  return () => window.clearTimeout(timer);
}
