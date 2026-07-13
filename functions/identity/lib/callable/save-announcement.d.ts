export declare const saveAnnouncement: import("firebase-functions/https").CallableFunction<
  any,
  Promise<
    | {
        id: string;
        deleted: true;
        created?: undefined;
      }
    | {
        id: string;
        created: true;
        deleted?: undefined;
      }
    | {
        id: string;
        created: false;
        deleted?: undefined;
      }
  >,
  unknown
>;
