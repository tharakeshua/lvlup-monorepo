import { z } from "zod";

/** value tuple member type. */
export type ValuesOf<T extends readonly string[]> = T[number];

/** Build a z.enum from an as-const tuple. Members are identical to the type. */
export const zEnum = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);
