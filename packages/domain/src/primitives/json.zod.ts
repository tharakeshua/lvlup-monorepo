import { z } from "zod";
import type { JsonValue } from "./json.js";

export const zJsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(zJsonValue),
    z.record(z.string(), zJsonValue),
  ])
);

export const zJsonObject = z.record(z.string(), zJsonValue);
