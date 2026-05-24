// ── Edit your pricing & payment details here ────────────────────────────────
// Per-school license. Change these values to set your price.
export const PRICE_PER_SCHOOL = 100; // amount per school, per year
export const CURRENCY = "USD";
export const BILLING_NOTE = "per school / year";

// Whish Money payment recipient.
export const WHISH_NUMBER = "+961 76 934110";

export function formatMoney(amount: number): string {
  return `${CURRENCY} ${amount.toLocaleString()}`;
}
