/**
 * JSON value types — used by error meta (`ApiErrorDetails.meta`) downstream.
 * Kept here so api-contract doesn't redefine them.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type JsonObject = { [k: string]: JsonValue };
