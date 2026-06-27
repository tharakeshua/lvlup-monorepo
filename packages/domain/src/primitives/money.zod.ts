import { z } from "zod";
import { zObject } from "../authoring/strict.js";
import { CURRENCIES } from "./money.js";

export const zCurrency = z.enum(CURRENCIES);

export const MoneySchema = zObject({
  amountMinor: z.number().int(),
  currency: zCurrency,
});
export const zMoney = MoneySchema;
