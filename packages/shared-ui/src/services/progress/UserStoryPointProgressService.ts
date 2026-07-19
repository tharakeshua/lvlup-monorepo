/**
 * UserStoryPointProgressService stub — manages story point progress documents.
 * Implementation will subscribe to Firestore progress docs.
 */

import type { ItemProgressEntry } from "../../types/items";

export interface UserStoryPointProgressDoc {
  userId: string;
  storyPointId: string;
  items: Record<string, ItemProgressEntry>;
  updatedAt?: unknown;
}

const UserStoryPointProgressService = {
  subscribe(
    _userId: string,
    _storyPointId: string,
    _onUpdate: (doc: UserStoryPointProgressDoc | null) => void
  ): () => void {
    return () => {};
  },
};

export default UserStoryPointProgressService;
