import { d, Decimal, type DecimalInput } from "./decimal";

export interface CashFlow {
  date: Date;
  amount: DecimalInput;
}

const DAYS_IN_YEAR = 365.25;
const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-7;

function yearFraction(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return ms / (1000 * 60 * 60 * 24 * DAYS_IN_YEAR);
}

function npv(rate: Decimal, flows: CashFlow[], start: Date): Decimal {
  let total = d(0);
  for (const flow of flows) {
    const t = yearFraction(start, flow.date);
    const denom = d(1).plus(rate).pow(t);
    if (denom.isZero()) return d(Infinity);
    total = total.plus(d(flow.amount).div(denom));
  }
  return total;
}

function dNpv(rate: Decimal, flows: CashFlow[], start: Date): Decimal {
  let total = d(0);
  for (const flow of flows) {
    const t = yearFraction(start, flow.date);
    if (t === 0) continue;
    const denom = d(1).plus(rate).pow(t + 1);
    if (denom.isZero()) continue;
    total = total.minus(d(flow.amount).times(t).div(denom));
  }
  return total;
}

/**
 * XIRR — Newton-Raphson; yakınsamazsa bisection fallback.
 * Sonuç yıllıklandırılmış orandır (örn. 0.25 = %25).
 */
export function calculateXirr(cashFlows: CashFlow[]): Decimal | null {
  if (cashFlows.length < 2) return null;

  const sorted = [...cashFlows].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const hasPositive = sorted.some((f) => d(f.amount).gt(0));
  const hasNegative = sorted.some((f) => d(f.amount).lt(0));
  if (!hasPositive || !hasNegative) return null;

  const start = sorted[0].date;
  let guess = d(0.1);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const value = npv(guess, sorted, start);
    const deriv = dNpv(guess, sorted, start);

    if (!deriv.isFinite() || deriv.abs().lt(1e-12)) break;

    const next = guess.minus(value.div(deriv));
    if (!next.isFinite() || next.lt(-0.999999)) break;

    if (next.minus(guess).abs().lt(TOLERANCE)) {
      return next;
    }
    guess = next;
  }

  return bisectionXirr(sorted, start);
}

function bisectionXirr(flows: CashFlow[], start: Date): Decimal | null {
  let low = d(-0.9999);
  let high = d(10);
  let fLow = npv(low, flows, start);
  let fHigh = npv(high, flows, start);

  // İşaret değişimi yoksa aralığı genişlet
  for (let expand = 0; expand < 20 && fLow.times(fHigh).gt(0); expand++) {
    high = high.times(2);
    fHigh = npv(high, flows, start);
  }

  if (fLow.times(fHigh).gt(0)) {
    return null;
  }

  let mid = d(0);
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    mid = low.plus(high).div(2);
    const fMid = npv(mid, flows, start);
    if (fMid.abs().lt(TOLERANCE) || high.minus(low).lt(TOLERANCE)) {
      return mid;
    }
    if (fLow.times(fMid).lt(0)) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }
  return mid;
}

/**
 * Portföy XIRR için nakit akışları:
 * - Yatırma/alış finansmanı: negatif
 * - Çekme/satış tahsilatı: pozitif
 * - Bugünkü portföy değeri: pozitif son akış
 */
export function buildPortfolioXirrFlows(params: {
  contributions: Array<{ date: Date; amount: DecimalInput }>;
  withdrawals: Array<{ date: Date; amount: DecimalInput }>;
  currentValue: DecimalInput;
  asOf: Date;
}): CashFlow[] {
  const flows: CashFlow[] = [];

  for (const c of params.contributions) {
    flows.push({ date: c.date, amount: d(c.amount).neg() });
  }
  for (const w of params.withdrawals) {
    flows.push({ date: w.date, amount: d(w.amount) });
  }
  flows.push({ date: params.asOf, amount: d(params.currentValue) });

  return flows;
}
