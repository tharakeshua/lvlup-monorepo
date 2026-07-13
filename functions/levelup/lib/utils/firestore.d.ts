import * as admin from "firebase-admin";
import type { Space, StoryPoint, UnifiedItem, Agent } from "../types";
export declare function getDb(): admin.firestore.Firestore;
export declare function getRtdb(): import("firebase-admin/database").Database;
export declare function loadSpace(tenantId: string, spaceId: string): Promise<Space>;
export declare function loadStoryPoint(
  tenantId: string,
  spaceId: string,
  storyPointId: string
): Promise<StoryPoint>;
export declare function loadItem(
  tenantId: string,
  spaceId: string,
  itemId: string,
  storyPointId?: string
): Promise<UnifiedItem>;
export declare function loadItems(
  tenantId: string,
  spaceId: string,
  storyPointId: string
): Promise<UnifiedItem[]>;
export declare function loadAgent(
  tenantId: string,
  spaceId: string,
  agentId: string
): Promise<Agent | null>;
