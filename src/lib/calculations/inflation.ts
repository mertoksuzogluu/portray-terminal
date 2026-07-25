import { d, Decimal, type DecimalInput } from "./decimal";

/** Ortalama ay uzunluğu (gün) — prorata için */
const DAYS_PER_MONTH = 30.436875;

export interface InflationPoint {
  /** YYYY-MM */
  period: string;
  indexValue: DecimalInput;
  monthlyRate?: DecimalInput | null;
}

export interface CashFlowForInflation {
  date: Date;
  amount: DecimalInput;
}

export interface RealReturnResult {
  currentValue: Decimal;
  nominalContributions: Decimal;
  inflationAdjustedCapital: Decimal;
  purchasingPowerGap: Decimal;
  realProfit: Decimal;
  realReturn: Decimal | null;
  isEstimated: boolean;
}

function toPeriod(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function daysBetween(from: Date, to: Date): number {
  const a = utcDay(from).getTime();
  const b = utcDay(to).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Dönemin son günü (UTC), örn. 2026-06 → 2026-06-30 */
export function endOfPeriod(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0));
}

export function findIndexAtPeriod(
  series: InflationPoint[],
  period: string
): Decimal | null {
  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));
  const exact = sorted.find((p) => p.period === period);
  if (exact) return d(exact.indexValue);

  // En son açıklanan endeksi kullan
  const earlier = [...sorted].reverse().find((p) => p.period <= period);
  return earlier ? d(earlier.indexValue) : null;
}

export function inflateAmount(
  amount: DecimalInput,
  fromIndex: DecimalInput,
  toIndex: DecimalInput
): Decimal {
  const from = d(fromIndex);
  const to = d(toIndex);
  if (from.isZero()) return d(amount);
  return d(amount).times(to).div(from);
}

/**
 * Son yayımlanan aylık orana göre gün bazlı taşıma: (1+r)^(gün/30.44)
 */
export function applyProratedMonthlyInflation(
  amount: DecimalInput,
  monthlyRate: DecimalInput | null | undefined,
  fromDate: Date,
  toDate: Date
): Decimal {
  const base = d(amount);
  if (monthlyRate == null) return base;
  const rate = d(monthlyRate);
  const days = daysBetween(fromDate, toDate);
  if (days <= 0 || rate.isZero()) return base;
  return base.times(d(1).plus(rate).pow(d(days).div(DAYS_PER_MONTH)));
}

function inflateFlow(
  amount: Decimal,
  flowDate: Date,
  asOf: Date,
  toIndex: Decimal,
  inflationSeries: InflationPoint[],
  latestPeriod: string | undefined
): Decimal {
  const fromIndex = findIndexAtPeriod(inflationSeries, toPeriod(flowDate));
  let inflated = fromIndex
    ? inflateAmount(amount, fromIndex, toIndex)
    : amount;

  // Son TÜFE ayından sonraki günler için son aylık oranı prorata uygula
  if (!latestPeriod) return inflated;
  const latestPoint = inflationSeries.find((p) => p.period === latestPeriod);
  const monthlyRate = latestPoint?.monthlyRate;
  const periodEnd = endOfPeriod(latestPeriod);
  if (utcDay(asOf).getTime() <= periodEnd.getTime()) return inflated;

  const prorataStart =
    utcDay(flowDate).getTime() > periodEnd.getTime() ? flowDate : periodEnd;
  return applyProratedMonthlyInflation(
    inflated,
    monthlyRate,
    prorataStart,
    asOf
  );
}

/**
 * Her nakit girişini kendi tarihindeki TÜFE'den bugünkü TÜFE'ye taşır.
 * Son yayımlanan aydan sonraki günler için aylık oran gün bazlı prorata edilir
 * (aksi halde Temmuz katkıları + Haziran son TÜFE → reel = nominal kalır).
 */
export function inflationAdjustedCapital(
  cashFlows: CashFlowForInflation[],
  inflationSeries: InflationPoint[],
  asOf: Date
): { capital: Decimal; isEstimated: boolean } {
  const asOfPeriod = toPeriod(asOf);
  const latestPeriod = [...inflationSeries]
    .map((p) => p.period)
    .sort()
    .at(-1);
  const isEstimated = !latestPeriod || latestPeriod < asOfPeriod;

  const toIndex =
    findIndexAtPeriod(inflationSeries, asOfPeriod) ??
    (latestPeriod ? findIndexAtPeriod(inflationSeries, latestPeriod) : null);

  if (!toIndex) {
    const nominal = cashFlows.reduce((acc, f) => acc.plus(d(f.amount)), d(0));
    return { capital: nominal, isEstimated: true };
  }

  let capital = d(0);
  for (const flow of cashFlows) {
    const amount = d(flow.amount);
    capital = capital.plus(
      inflateFlow(amount, flow.date, asOf, toIndex, inflationSeries, latestPeriod)
    );
  }

  return { capital, isEstimated };
}

export function calculateRealReturn(params: {
  currentValue: DecimalInput;
  cashFlows: CashFlowForInflation[];
  inflationSeries: InflationPoint[];
  asOf: Date;
}): RealReturnResult {
  const currentValue = d(params.currentValue);
  const nominalContributions = params.cashFlows.reduce(
    (acc, f) => acc.plus(d(f.amount)),
    d(0)
  );

  const { capital, isEstimated } = inflationAdjustedCapital(
    params.cashFlows,
    params.inflationSeries,
    params.asOf
  );

  const realProfit = currentValue.minus(capital);
  const purchasingPowerGap = capital.minus(nominalContributions);

  return {
    currentValue,
    nominalContributions,
    inflationAdjustedCapital: capital,
    purchasingPowerGap,
    realProfit,
    realReturn: capital.isZero() ? null : realProfit.div(capital),
    isEstimated,
  };
}

export function computeMonthlyRateFromIndex(
  previousIndex: DecimalInput,
  currentIndex: DecimalInput
): Decimal | null {
  const prev = d(previousIndex);
  if (prev.isZero()) return null;
  return d(currentIndex).minus(prev).div(prev);
}
