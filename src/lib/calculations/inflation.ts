import { d, Decimal, type DecimalInput } from "./decimal";

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
 * Her nakit girişini kendi tarihindeki TÜFE'den bugünkü TÜFE'ye taşır.
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
    // Yalnızca pozitif katkılar (yatırımlar) enflasyona taşınır
    if (amount.lte(0)) {
      // Çekimler enflasyonlu sermayeyi azaltır (çekim date index)
      const fromIndex = findIndexAtPeriod(inflationSeries, toPeriod(flow.date));
      if (!fromIndex) {
        capital = capital.plus(amount);
      } else {
        capital = capital.plus(inflateAmount(amount, fromIndex, toIndex));
      }
      continue;
    }

    const fromIndex = findIndexAtPeriod(inflationSeries, toPeriod(flow.date));
    if (!fromIndex) {
      capital = capital.plus(amount);
    } else {
      capital = capital.plus(inflateAmount(amount, fromIndex, toIndex));
    }
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
