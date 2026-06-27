import type { TransitionMap } from "./types.js";
import type { SpaceStatus } from "../enums/space.js";

// levelup-content §"ALLOWED_TRANSITIONS.space".
export const SPACE_TRANSITIONS = {
  draft: ["published"],
  published: ["archived", "draft"],
  archived: ["draft"],
} as const satisfies TransitionMap<SpaceStatus>;
