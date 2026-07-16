import { d, Decimal, type DecimalInput } from "./decimal";
import { arithmeticMean } from "./returns";

export interface DrawdownResult {
  maxDrawdown: Decimal | null;
  maxDrawdownStartDate: Date | null;
  maxDrawdownTroughDate: Date | null;
  recoveryDate: Date | null;
  currentDrawdown: Decimal | null;
  peakDate: Date | null;
}

export interface RiskMetrics {
  dailyVolatility: Decimal | null;
  annualizedVolatility: Decimal | null;
  positiveDayRatio: Decimal | null;
  negativeDayRatio: Decimal | null;
  bestDay: Decimal | null;
  worstDay: Decimal | null;
  sharpeRatio: Decimal | null;
  sortinoRatio: Decimal | null;
  beta: Decimal | null;
  correlation: Decimal | null;
  drawdown: DrawdownResult;
  observationCount: number;
  insufficientData: boolean;
}

const TRADING_DAYS = 252;
const MIN_OBS = 5;

export function standardDeviation(values: DecimalInput[]): Decimal | null {
  if (values.length < 2) return null;
  const mean = arithmeticMean(values);
  if (!mean) return null;
  const variance = values
    .reduce<Decimal>((acc, v) => acc.plus(d(v).minus(mean).pow(2)), d(0))
    .div(values.length - 1);
  return variance.sqrt();
}

export function annualizedVolatility(dailyReturns: DecimalInput[]): Decimal | null {
  const dailyVol = standardDeviation(dailyReturns);
  if (!dailyVol) return null;
  return dailyVol.times(Math.sqrt(TRADING_DAYS));
}

export function calculateDrawdown(
  values: Array<{ date: Date; value: DecimalInput }>
): DrawdownResult {
  if (values.length === 0) {
    return {
      maxDrawdown: null,
      maxDrawdownStartDate: null,
      maxDrawdownTroughDate: null,
      recoveryDate: null,
      currentDrawdown: null,
      peakDate: null,
    };
  }

  let peak = d(values[0].value);
  let peakDate = values[0].date;
  let maxDd = d(0);
  let maxDdStart: Date | null = null;
  let maxDdTrough: Date | null = null;
  let troughValue = peak;
  let recovery: Date | null = null;
  let inDrawdown = false;

  for (const point of values) {
    const value = d(point.value);
    if (value.gte(peak)) {
      if (inDrawdown && maxDdStart && !recovery && maxDd.gt(0)) {
        // toparlanma yalnızca max DD için izlenir; basit yaklaşım
      }
      peak = value;
      peakDate = point.date;
      inDrawdown = false;
    } else if (!peak.isZero()) {
      const dd = peak.minus(value).div(peak);
      inDrawdown = true;
      if (dd.gt(maxDd)) {
        maxDd = dd;
        maxDdStart = peakDate;
        maxDdTrough = point.date;
        troughValue = value;
        recovery = null;
      }
    }
  }

  // Toparlanma: max DD dipinden sonra peak'e dönüş
  if (maxDdTrough && maxDdStart) {
    const peakAtStart = values.find(
      (v) => v.date.getTime() === maxDdStart!.getTime()
    );
    const peakLevel = peakAtStart ? d(peakAtStart.value) : null;
    if (peakLevel) {
      for (const point of values) {
        if (point.date.getTime() <= maxDdTrough.getTime()) continue;
        if (d(point.value).gte(peakLevel)) {
          recovery = point.date;
          break;
        }
      }
    }
  }

  const last = d(values[values.length - 1].value);
  let runningPeak = d(0);
  let currentDd: Decimal | null = null;
  let currentPeakDate: Date | null = null;
  for (const point of values) {
    const value = d(point.value);
    if (value.gt(runningPeak)) {
      runningPeak = value;
      currentPeakDate = point.date;
    }
  }
  if (!runningPeak.isZero()) {
    currentDd = runningPeak.minus(last).div(runningPeak);
  }

  void troughValue;

  return {
    maxDrawdown: maxDd.isZero() && values.length < MIN_OBS ? null : maxDd,
    maxDrawdownStartDate: maxDdStart,
    maxDrawdownTroughDate: maxDdTrough,
    recoveryDate: recovery,
    currentDrawdown: currentDd,
    peakDate: currentPeakDate,
  };
}

export function sharpeRatio(
  dailyReturns: DecimalInput[],
  annualRiskFreeRate: DecimalInput
): Decimal | null {
  if (dailyReturns.length < MIN_OBS) return null;
  const mean = arithmeticMean(dailyReturns);
  const vol = annualizedVolatility(dailyReturns);
  if (!mean || !vol || vol.isZero()) return null;
  const annualReturn = mean.times(TRADING_DAYS);
  return annualReturn.minus(d(annualRiskFreeRate)).div(vol);
}

export function sortinoRatio(
  dailyReturns: DecimalInput[],
  annualRiskFreeRate: DecimalInput
): Decimal | null {
  if (dailyReturns.length < MIN_OBS) return null;
  const mean = arithmeticMean(dailyReturns);
  if (!mean) return null;

  const downside = dailyReturns
    .map((r) => d(r))
    .filter((r) => r.lt(0))
    .map((r) => r.pow(2));

  if (downside.length < 2) return null;

  const downsideVar = downside
    .reduce<Decimal>((acc, v) => acc.plus(v), d(0))
    .div(downside.length);
  const downsideDev = downsideVar.sqrt().times(Math.sqrt(TRADING_DAYS));
  if (downsideDev.isZero()) return null;

  const annualReturn = mean.times(TRADING_DAYS);
  return annualReturn.minus(d(annualRiskFreeRate)).div(downsideDev);
}

export function covariance(
  xs: DecimalInput[],
  ys: DecimalInput[]
): Decimal | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const meanX = arithmeticMean(xs);
  const meanY = arithmeticMean(ys);
  if (!meanX || !meanY) return null;
  let sum = d(0);
  for (let i = 0; i < xs.length; i++) {
    sum = sum.plus(d(xs[i]).minus(meanX).times(d(ys[i]).minus(meanY)));
  }
  return sum.div(xs.length - 1);
}

export function correlation(
  xs: DecimalInput[],
  ys: DecimalInput[]
): Decimal | null {
  const cov = covariance(xs, ys);
  const sx = standardDeviation(xs);
  const sy = standardDeviation(ys);
  if (!cov || !sx || !sy || sx.isZero() || sy.isZero()) return null;
  return cov.div(sx.times(sy));
}

export function beta(
  assetReturns: DecimalInput[],
  benchmarkReturns: DecimalInput[]
): Decimal | null {
  const cov = covariance(assetReturns, benchmarkReturns);
  const benchVar = standardDeviation(benchmarkReturns);
  if (!cov || !benchVar) return null;
  const variance = benchVar.pow(2);
  if (variance.isZero()) return null;
  return cov.div(variance);
}

export function daySignRatios(dailyReturns: DecimalInput[]): {
  positiveDayRatio: Decimal | null;
  negativeDayRatio: Decimal | null;
  bestDay: Decimal | null;
  worstDay: Decimal | null;
} {
  if (dailyReturns.length === 0) {
    return {
      positiveDayRatio: null,
      negativeDayRatio: null,
      bestDay: null,
      worstDay: null,
    };
  }
  let pos = 0;
  let neg = 0;
  let best = d(dailyReturns[0]);
  let worst = d(dailyReturns[0]);
  for (const r of dailyReturns) {
    const v = d(r);
    if (v.gt(0)) pos += 1;
    if (v.lt(0)) neg += 1;
    if (v.gt(best)) best = v;
    if (v.lt(worst)) worst = v;
  }
  const n = dailyReturns.length;
  return {
    positiveDayRatio: d(pos).div(n),
    negativeDayRatio: d(neg).div(n),
    bestDay: best,
    worstDay: worst,
  };
}

export function computeRiskMetrics(params: {
  dailyReturns: DecimalInput[];
  values: Array<{ date: Date; value: DecimalInput }>;
  benchmarkReturns?: DecimalInput[];
  annualRiskFreeRate?: DecimalInput;
}): RiskMetrics {
  const { dailyReturns, values } = params;
  const insufficientData = dailyReturns.length < MIN_OBS;
  const signs = daySignRatios(dailyReturns);
  const rf = params.annualRiskFreeRate ?? 0.45;

  let betaVal: Decimal | null = null;
  let corrVal: Decimal | null = null;
  if (params.benchmarkReturns && params.benchmarkReturns.length === dailyReturns.length) {
    betaVal = beta(dailyReturns, params.benchmarkReturns);
    corrVal = correlation(dailyReturns, params.benchmarkReturns);
  }

  return {
    dailyVolatility: insufficientData ? null : standardDeviation(dailyReturns),
    annualizedVolatility: insufficientData
      ? null
      : annualizedVolatility(dailyReturns),
    positiveDayRatio: signs.positiveDayRatio,
    negativeDayRatio: signs.negativeDayRatio,
    bestDay: signs.bestDay,
    worstDay: signs.worstDay,
    sharpeRatio: insufficientData ? null : sharpeRatio(dailyReturns, rf),
    sortinoRatio: insufficientData ? null : sortinoRatio(dailyReturns, rf),
    beta: betaVal,
    correlation: corrVal,
    drawdown: calculateDrawdown(values),
    observationCount: dailyReturns.length,
    insufficientData,
  };
}

export interface ConcentrationResult {
  largestWeight: Decimal | null;
  top3Weight: Decimal | null;
  herfindahlHirschmanIndex: Decimal | null;
  weights: Array<{ assetId: string; weight: Decimal }>;
}

export function concentrationAnalysis(
  positions: Array<{ assetId: string; marketValue: DecimalInput }>
): ConcentrationResult {
  const total = positions.reduce<Decimal>((acc, p) => acc.plus(d(p.marketValue)), d(0));
  if (total.isZero() || positions.length === 0) {
    return {
      largestWeight: null,
      top3Weight: null,
      herfindahlHirschmanIndex: null,
      weights: [],
    };
  }

  const weights = positions
    .map((p) => ({
      assetId: p.assetId,
      weight: d(p.marketValue).div(total),
    }))
    .sort((a, b) => b.weight.cmp(a.weight));

  const largestWeight = weights[0]?.weight ?? null;
  const top3Weight = weights
    .slice(0, 3)
    .reduce<Decimal>((acc, w) => acc.plus(w.weight), d(0));
  const hhi = weights.reduce<Decimal>((acc, w) => acc.plus(w.weight.pow(2)), d(0));

  return {
    largestWeight,
    top3Weight,
    herfindahlHirschmanIndex: hhi,
    weights,
  };
}
