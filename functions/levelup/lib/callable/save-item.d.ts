/**
 * Consolidated item endpoint — replaces: createItem, updateItem, deleteItem
 *
 * No id → create new item
 * id present → update existing item
 * data.deleted = true → soft-delete (actually hard-deletes document + answer keys, decrements stats)
 */
export declare const saveItem: import("firebase-functions/https").CallableFunction<
  any,
  Promise<
    | {
        id: string;
        created: false;
      }
    | {
        id: string;
        created: true;
      }
  >,
  unknown
>;
