/**
 * Money in MINOR units (paise/cents) as an integer — never a float. Replaces the
 * live ad-hoc `{ amount: number; currency: string }` on PurchaseRecord.
 */
export const CURRENCIES = ["INR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Money {
  amountMinor: number;
  currency: Currency;
}

export const money = (amountMinor: number, currency: Currency): Money => ({
  amountMinor: Math.round(amountMinor),
  currency,
});

export const addMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
};

export const formatMoney = (m: Money): string => {
  const major = m.amountMinor / 100;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: m.currency }).format(
    major
  );
};
