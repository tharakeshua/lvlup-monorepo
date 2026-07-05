export declare const listAnnouncements: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    announcements: {
      id: string;
      title: any;
      body: any;
      authorName: any;
      scope: any;
      status: any;
      targetRoles: any;
      targetClassIds: any;
      publishedAt: import("@levelup/domain").Timestamp;
      archivedAt: import("@levelup/domain").Timestamp;
      expiresAt: import("@levelup/domain").Timestamp;
      createdAt: import("@levelup/domain").Timestamp;
      updatedAt: import("@levelup/domain").Timestamp;
    }[];
    nextCursor: string | undefined;
  }>,
  unknown
>;
