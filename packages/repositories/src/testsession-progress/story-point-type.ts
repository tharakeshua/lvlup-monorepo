/**
 * Authoring `StoryPointType → runtime TestSessionType` mapping (SDK-LAYERS-PLAN
 * §2.3 D5 / domain plan). The authoring enum carries a `'standard'` material
 * type that has no runtime session; the runtime union is collapsed to one value
 * per concept (`timed_test`, never `test`). This is UX-only labelling — the
 * server still derives the session type authoritatively.
 */
import type { StoryPointType, TestSessionType } from "@levelup/domain";

/**
 * Map the authoring story-point type down to the runtime session type for UX
 * labelling. `'standard'` (non-test material) has no runtime session and maps to
 * `'practice'` (the most permissive runtime concept) so the label never crashes;
 * the server is the authority.
 */
export function storyPointTypeToSessionType(type: StoryPointType): TestSessionType {
  switch (type) {
    case "timed_test":
      return "timed_test";
    case "quiz":
      return "quiz";
    case "practice":
    case "standard":
    default:
      return "practice";
  }
}
