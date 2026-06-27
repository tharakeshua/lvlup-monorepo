import { z } from "zod";
import { ISO_DATE } from "./iso-date.js";
import type { IsoDate } from "./iso-date.js";

export const zIsoDate = z
  .string()
  .regex(ISO_DATE)
  .transform((s) => s as IsoDate);
