import { Timestamp } from "firebase-admin/firestore";
export interface ListVersionsResponse {
  versions: Array<{
    id: string;
    version: number;
    entityType: string;
    entityId: string;
    changeType: string;
    changeSummary: string;
    changedBy: string;
    changedAt: Timestamp | null;
  }>;
  hasMore: boolean;
  lastId: string | null;
}
export declare const listVersions: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    versions: {
      id: string;
      version: any;
      entityType: any;
      entityId: any;
      changeType: any;
      changeSummary: any;
      changedBy: any;
      changedAt: any;
    }[];
    hasMore: boolean;
    lastId: string | null;
  }>,
  unknown
>;
