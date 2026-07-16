import { d, Decimal, type DecimalInput } from "./decimal";

/**
 * Günlük TWR faktörü.
 * Nakit akışı gün başında varsayılır (Modified Dietz benzeri sadeleştirme):
 * factor = (endValue - cashFlow) / beginValue
 * cashFlow > 0: para girişi, cashFlow < 0: para çıkışı
 */
export function dailyTwrFactor(
  beginValue: DecimalInput,
  endValue: DecimalInput,
  externalCashFlow: DecimalInput = 0
): Decimal | null {
  const begin = d(beginValue);
  const end = d(endValue);
  const cf = d(externalCashFlow);

  if (begin.isZero()) {
    const adjustedBegin = cf;
    if (adjustedBegin.isZero()) return null;
    return end.div(adjustedBegin);
  }

  // Nakit akışı gün içinde: başlangıç değerine ekle (gün başı varsayımı)
  const denominator = begin.plus(cf);
  if (denominator.isZero()) return null;
  return end.div(denominator);
}

export function dailyReturnFromFactor(factor: DecimalInput | null): Decimal | null {
  if (factor === null) return null;
  return d(factor).minus(1);
}

/**
 * Basit günlük getiri — nakit akışı yoksa.
 * Nakit akışı varsa kullanmayın; TWR tercih edin.
 */
export function simpleDailyReturn(
  beginValue: DecimalInput,
  endValue: DecimalInput
): Decimal | null {
  const begin = d(beginValue);
  if (begin.isZero()) return null;
  return d(endValue).minus(begin).div(begin);
}

export function compoundReturns(returns: DecimalInput[]): Decimal | null {
  if (returns.length === 0) return null;
  let factor = d(1);
  for (const r of returns) {
    factor = factor.times(d(1).plus(d(r)));
  }
  return factor.minus(1);
}

export function compoundFactors(factors: DecimalInput[]): Decimal | null {
  if (factors.length === 0) return null;
  let product = d(1);
  for (const f of factors) {
    product = product.times(d(f));
  }
  return product.minus(1);
}

export function arithmeticMean(values: DecimalInput[]): Decimal | null {
  if (values.length === 0) return null;
  const total = values.reduce<Decimal>((acc, v) => acc.plus(d(v)), d(0));
  return total.div(values.length);
}

export function geometricMeanReturns(returns: DecimalInput[]): Decimal | null {
  if (returns.length === 0) return null;
  let product = d(1);
  for (const r of returns) {
    const factor = d(1).plus(d(r));
    if (factor.lte(0)) return null;
    product = product.times(factor);
  }
  const n = valuesLength(returns.length);
  return product.pow(d(1).div(n)).minus(1);
}

function valuesLength(n: number): Decimal {
  return d(n);
}

export interface MonthlyReturnStats {
  arithmeticMonthlyAverage: Decimal | null;
  geometricMonthlyAverage: Decimal | null;
  compoundedTotalReturn: Decimal | null;
  monthCount: number;
}

export function monthlyReturnStats(monthlyReturns: DecimalInput[]): MonthlyReturnStats {
  return {
    arithmeticMonthlyAverage: arithmeticMean(monthlyReturns),
    geometricMonthlyAverage: geometricMeanReturns(monthlyReturns),
    compoundedTotalReturn: compoundReturns(monthlyReturns),
    monthCount: monthlyReturns.length,
  };
}

export function chainTwr(dailyFactors: DecimalInput[]): Decimal | null {
  return compoundFactors(dailyFactors);
}

export function normalizeSeriesToBase(
  values: DecimalInput[],
  base = 100
): Array<Decimal | null> {
  if (values.length === 0) return [];
  const first = d(values[0]);
  if (first.isZero()) {
    return values.map(() => null);
  }
  return values.map((v) => d(v).div(first).times(base));
}

export function periodReturnFromValues(
  startValue: DecimalInput,
  endValue: DecimalInput
): Decimal | null {
  const start = d(startValue);
  if (start.isZero()) return null;
  return d(endValue).minus(start).div(start);
}

export function contributionToReturn(
  assetWeight: DecimalInput,
  assetReturn: DecimalInput
): Decimal {
  return d(assetWeight).times(d(assetReturn));
}

export interface NominalReturnResult {
  currentValue: Decimal;
  netContributions: Decimal;
  nominalProfit: Decimal;
  nominalReturn: Decimal | null;
}

export function nominalReturn(
  currentValue: DecimalInput,
  netContributions: DecimalInput
): NominalReturnResult {
  const value = d(currentValue);
  const contrib = d(netContributions);
  const profit = value.minus(contrib);
  return {
    currentValue: value,
    netContributions: contrib,
    nominalProfit: profit,
    nominalReturn: contrib.isZero() ? null : profit.div(contrib),
  };
}
