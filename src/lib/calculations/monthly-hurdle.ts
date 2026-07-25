import { d, Decimal, type DecimalInput } from "./decimal";

/**
 * Bu ayki nominal kârı aylık hurdle oranına göre düşürür.
 * Örnek: 100_000 × (1 − 0.03) = 97_000
 */
export function adjustPnlByHurdle(
  nominalPnl: DecimalInput,
  monthlyHurdleRate: DecimalInput
): Decimal {
  const pnl = d(nominalPnl);
  const rate = d(monthlyHurdleRate);
  return pnl.times(d(1).minus(rate));
}

/**
 * Yıllık faiz oranını aylık efektif orana çevirir: (1+r)^(1/12) − 1
 */
export function annualToMonthlyRate(annualRate: DecimalInput): Decimal {
  const r = d(annualRate);
  if (r.lte(-1)) return d(0);
  // Decimal.js pow ile (1+r)^(1/12)
  return d(1).plus(r).pow(d(1).div(12)).minus(1);
}

export interface MonthlyHurdleAdjustment {
  nominalPnl: Decimal;
  hurdleRate: Decimal;
  adjustedPnl: Decimal;
}

export function monthlyHurdleAdjustment(
  nominalPnl: DecimalInput,
  monthlyHurdleRate: DecimalInput
): MonthlyHurdleAdjustment {
  const pnl = d(nominalPnl);
  const rate = d(monthlyHurdleRate);
  return {
    nominalPnl: pnl,
    hurdleRate: rate,
    adjustedPnl: adjustPnlByHurdle(pnl, rate),
  };
}
