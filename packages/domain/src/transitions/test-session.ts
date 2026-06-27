import type { TransitionMap } from "./types.js";
import type { TestSessionStatus } from "../enums/test-session.js";

// testsession-progress §"ALLOWED_TRANSITIONS.testSession" (terminal states have no out-edges).
export const TEST_SESSION_TRANSITIONS = {
  in_progress: ["completed", "expired", "abandoned"],
  completed: [],
  expired: [],
  abandoned: [],
} as const satisfies TransitionMap<TestSessionStatus>;
