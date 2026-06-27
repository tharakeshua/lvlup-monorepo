/**
 * A calendar date (YYYY-MM-DD), branded — kept distinct from the instant
 * `Timestamp` so timezone-stable streak/date math (gamification) never collides
 * with wall-clock instants.
 */
import type { Brand } from "./brand.js";

export type IsoDate = Brand<string, "IsoDate">;

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (v: unknown): v is IsoDate => typeof v === "string" && ISO_DATE.test(v);

export const asIsoDate = (s: string): IsoDate => {
  if (!ISO_DATE.test(s)) throw new RangeError(`not a YYYY-MM-DD date: ${s}`);
  return s as IsoDate;
};
