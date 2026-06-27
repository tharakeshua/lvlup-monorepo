/**
 * ALLOWED_TRANSITIONS aggregate + pure pre-check / enforcement helpers.
 *
 * `canTransition` is the UX-only pre-check repos run; the server re-enforces via
 * `assertTransition` (SDK-SERVER-DESIGN §2.4/§3). Each machine is `as const
 * satisfies TransitionMap<EnumType>` so literal values are preserved for narrowing
 * while enum-key membership is enforced at compile time.
 */
import { InvalidTransitionError } from "./types.js";
import { SPACE_TRANSITIONS } from "./space.js";
import { EXAM_TRANSITIONS } from "./exam.js";
import { SUBMISSION_TRANSITIONS } from "./submission.js";
import { QUESTION_GRADING_TRANSITIONS } from "./question-grading.js";
import { TEST_SESSION_TRANSITIONS } from "./test-session.js";
import {
  TENANT_TRANSITIONS,
  MEMBERSHIP_TRANSITIONS,
  ENTITY_STATUS_TRANSITIONS,
  ANNOUNCEMENT_TRANSITIONS,
} from "./tenant.js";

export * from "./types.js";
export { SPACE_TRANSITIONS } from "./space.js";
export { EXAM_TRANSITIONS } from "./exam.js";
export { SUBMISSION_TRANSITIONS } from "./submission.js";
export { QUESTION_GRADING_TRANSITIONS } from "./question-grading.js";
export { TEST_SESSION_TRANSITIONS } from "./test-session.js";
export {
  TENANT_TRANSITIONS,
  MEMBERSHIP_TRANSITIONS,
  ENTITY_STATUS_TRANSITIONS,
  ANNOUNCEMENT_TRANSITIONS,
} from "./tenant.js";

export const ALLOWED_TRANSITIONS = {
  space: SPACE_TRANSITIONS,
  exam: EXAM_TRANSITIONS,
  submission: SUBMISSION_TRANSITIONS,
  questionGrading: QUESTION_GRADING_TRANSITIONS,
  testSession: TEST_SESSION_TRANSITIONS,
  tenant: TENANT_TRANSITIONS,
  membership: MEMBERSHIP_TRANSITIONS,
  entityStatus: ENTITY_STATUS_TRANSITIONS,
  announcement: ANNOUNCEMENT_TRANSITIONS,
} as const;

export type TransitionDomain = keyof typeof ALLOWED_TRANSITIONS;

/** Pure pre-check (UX in repos; server re-enforces). */
export const canTransition = <D extends TransitionDomain>(
  domain: D,
  from: keyof (typeof ALLOWED_TRANSITIONS)[D],
  to: string
): boolean => {
  const map = ALLOWED_TRANSITIONS[domain] as Record<string, readonly string[]> | undefined;
  const targets = map?.[from as string];
  return targets != null && targets.includes(to);
};

/** Server enforcement helper (used by @levelup/services). Throws InvalidTransitionError. */
export const assertTransition = <D extends TransitionDomain>(
  domain: D,
  from: keyof (typeof ALLOWED_TRANSITIONS)[D],
  to: string
): void => {
  if (!canTransition(domain, from, to)) {
    throw new InvalidTransitionError(domain, String(from), to);
  }
};
