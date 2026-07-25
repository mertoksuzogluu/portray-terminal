import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import {
  adjustPnlByHurdle,
  annualToMonthlyRate,
} from "@/lib/calculations/monthly-hurdle";
import {
  computeRiskMetrics,
  concentrationAnalysis,
} from "@/lib/calculations/risk";
import { assetTypeToClass } from "@/lib/recommendations/asset-class";
import { toDateKey } from "@/lib/utils/dates";
import type { MonthlyAiMetrics } from "./types";

const CLASS_LABELS: Record<string, string> = {
  EQUITY: "Hisse / ETF",
  FUND: "Fon",
  FX: "Döviz",
  GOLD: "Altın",
  CASH: "Nakit",
};

/** Yerel dip → zirve arası maksimum yükseliş. */
export function calculateMaxRise(
  values: Array<{ date: Date; value: number }>
): {
  maxRise: number | null;
  start: string | null;
  peak: string | null;
} {
  if (values.length < 2) {
    return { maxRise: null, start: null, peak: null };
  }

  let trough = values[0]!.value;
  let troughDate = values[0]!.date;
  let maxRise = 0;
  let start: Date | null = null;
  let peak: Date | null = null;

  for (const point of values) {
    if (point.value < trough) {
      trough = point.value;
      troughDate = point.date;
      continue;
    }
    if (trough > 0) {
      const rise = (point.value - trough) / trough;
      if (rise > maxRise) {
        maxRise = rise;
        start = troughDate;
        peak = point.date;
      }
    }
  }

  return {
    maxRise: maxRise > 0 ? maxRise : 0,
    start: start ? toDateKey(start) : null,
    peak: peak ? toDateKey(peak) : null,
  };
}

function alignBenchmarkReturns(
  portfolio: Array<{ date: string; dailyReturn: number | null }>,
  benchByDate: Map<string, number>
): number[] | null {
  const out: number[] = [];
  for (const row of portfolio) {
    if (row.dailyReturn == null) continue;
    const b = benchByDate.get(row.date);
    if (b == null) return null;
    out.push(b);
  }
  return out.length >= 5 ? out : null;
}

export async function buildMonthlyAiMetrics(
  portfolioId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<MonthlyAiMetrics> {
  const portfolio = await prisma.portfolio.findUniqueOrThrow({
    where: { id: portfolioId },
    include: { user: { select: { riskFreeRateAnnual: true } } },
  });

  const snapshots = await prisma.portfolioDailySnapshot.findMany({
    where: {
      portfolioId,
      snapshotDate: { gte: periodStart, lte: periodEnd },
    },
    orderBy: { snapshotDate: "asc" },
  });

  const first = snapshots[0] ?? null;
  const last = snapshots[snapshots.length - 1] ?? null;

  const startValue = first ? Number(first.totalMarketValue.toString()) : null;
  const endValue = last ? Number(last.totalMarketValue.toString()) : null;
  const startNet = first ? Number(first.netContributions.toString()) : null;
  const endNet = last ? Number(last.netContributions.toString()) : null;
  const investedCapital = endNet;

  let nominalPnl: number | null = null;
  let nominalReturn: number | null = null;
  if (startValue != null && endValue != null && startNet != null && endNet != null) {
    nominalPnl = endValue - startValue - (endNet - startNet);
    const denom = startValue > 0 ? startValue : endNet;
    nominalReturn = denom > 0 ? nominalPnl / denom : null;
  }

  const valueSeries = snapshots.map((s) => ({
    date: s.snapshotDate,
    value: Number(s.totalMarketValue.toString()),
  }));
  const dailyReturns = snapshots
    .map((s) =>
      s.dailyReturn != null ? Number(s.dailyReturn.toString()) : null
    )
    .filter((r): r is number => r != null);

  const xu100 = await prisma.benchmark.findFirst({
    where: { symbol: "XU100", isActive: true },
  });
  let bistStart: number | null = null;
  let bistEnd: number | null = null;
  let bistReturn: number | null = null;
  let benchDailyByDate = new Map<string, number>();

  if (xu100) {
    const benchPrices = await prisma.benchmarkPrice.findMany({
      where: {
        benchmarkId: xu100.id,
        priceDate: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { priceDate: "asc" },
    });
    // Kaynak tutarlılığı: her gün için son çekilen satır
    const byDate = new Map<string, { value: number; fetchedAt: number }>();
    for (const row of benchPrices) {
      if (row.source === "demo-seed") continue;
      const key = toDateKey(row.priceDate);
      const value = Number(row.value.toString());
      const fetchedAt = row.fetchedAt.getTime();
      const prev = byDate.get(key);
      if (!prev || fetchedAt > prev.fetchedAt) {
        byDate.set(key, { value, fetchedAt });
      }
    }
    const dates = [...byDate.keys()].sort();
    if (dates.length >= 2) {
      bistStart = byDate.get(dates[0]!)!.value;
      bistEnd = byDate.get(dates[dates.length - 1]!)!.value;
      if (bistStart > 0) bistReturn = (bistEnd - bistStart) / bistStart;
    }
    for (let i = 1; i < dates.length; i++) {
      const prev = byDate.get(dates[i - 1]!)!.value;
      const cur = byDate.get(dates[i]!)!.value;
      if (prev > 0) {
        benchDailyByDate.set(dates[i]!, (cur - prev) / prev);
      }
    }
  }

  const portfolioForAlign = snapshots.map((s) => ({
    date: toDateKey(s.snapshotDate),
    dailyReturn:
      s.dailyReturn != null ? Number(s.dailyReturn.toString()) : null,
  }));
  const alignedBench = alignBenchmarkReturns(
    portfolioForAlign,
    benchDailyByDate
  );
  // Sadece dailyReturn olan günlerle portföy serisini hizala
  const alignedPortfolioReturns = portfolioForAlign
    .filter((r) => r.dailyReturn != null)
    .map((r) => r.dailyReturn!);

  const rf = Number(portfolio.user.riskFreeRateAnnual.toString());
  const risk = computeRiskMetrics({
    dailyReturns:
      alignedBench && alignedBench.length === alignedPortfolioReturns.length
        ? alignedPortfolioReturns
        : dailyReturns,
    values: valueSeries,
    benchmarkReturns:
      alignedBench && alignedBench.length === alignedPortfolioReturns.length
        ? alignedBench
        : undefined,
    annualRiskFreeRate: rf,
  });

  const maxRise = calculateMaxRise(
    valueSeries.map((v) => ({ date: v.date, value: Number(d(v.value).toString()) }))
  );

  const latestInf = await prisma.inflationIndex.findFirst({
    orderBy: { period: "desc" },
  });
  const inflationHurdle =
    latestInf?.monthlyRate != null
      ? Number(latestInf.monthlyRate.toString())
      : null;
  const depositHurdle = annualToMonthlyRate(rf).toNumber();

  const vsInflationPnl =
    nominalPnl != null && inflationHurdle != null
      ? adjustPnlByHurdle(nominalPnl, inflationHurdle).toNumber()
      : null;
  const vsDepositPnl =
    nominalPnl != null
      ? adjustPnlByHurdle(nominalPnl, depositHurdle).toNumber()
      : null;

  const vsInflationReturn =
    vsInflationPnl != null && startValue != null && startValue > 0
      ? vsInflationPnl / startValue
      : null;
  const vsDepositReturn =
    vsDepositPnl != null && startValue != null && startValue > 0
      ? vsDepositPnl / startValue
      : null;

  const positionDate = last?.snapshotDate ?? periodEnd;
  const positions = await prisma.positionDailySnapshot.findMany({
    where: { portfolioId, snapshotDate: positionDate },
    include: { asset: true },
  });

  const cashValue = last ? Number(last.cashValue.toString()) : 0;
  const totalForAlloc =
    endValue != null && endValue > 0
      ? endValue
      : positions.reduce((a, p) => a + Number(p.marketValue.toString()), 0) +
        cashValue;

  const byClass = new Map<string, number>();
  for (const p of positions) {
    const cls = assetTypeToClass(p.asset.assetType);
    byClass.set(
      cls,
      (byClass.get(cls) ?? 0) + Number(p.marketValue.toString())
    );
  }
  if (cashValue > 0) {
    byClass.set("CASH", (byClass.get("CASH") ?? 0) + cashValue);
  }

  const allocationByClass = [...byClass.entries()]
    .map(([key, value]) => ({
      key,
      label: CLASS_LABELS[key] ?? key,
      value,
      weight: totalForAlloc > 0 ? value / totalForAlloc : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  const allocationBySymbol = positions
    .map((p) => ({
      key: p.asset.symbol,
      label: p.asset.symbol,
      value: Number(p.marketValue.toString()),
      weight:
        totalForAlloc > 0
          ? Number(p.marketValue.toString()) / totalForAlloc
          : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  const concentration = concentrationAnalysis(
    positions.map((p) => ({
      assetId: p.assetId,
      marketValue: p.marketValue.toString(),
    }))
  );

  const alphaVsBist =
    nominalReturn != null && bistReturn != null
      ? nominalReturn - bistReturn
      : null;

  return {
    startValue,
    endValue,
    investedCapital,
    nominalPnl,
    nominalReturn,
    maxDrawdown: risk.drawdown.maxDrawdown?.toNumber() ?? null,
    maxDrawdownStart: risk.drawdown.maxDrawdownStartDate
      ? toDateKey(risk.drawdown.maxDrawdownStartDate)
      : null,
    maxDrawdownTrough: risk.drawdown.maxDrawdownTroughDate
      ? toDateKey(risk.drawdown.maxDrawdownTroughDate)
      : null,
    maxRise: maxRise.maxRise,
    maxRiseStart: maxRise.start,
    maxRisePeak: maxRise.peak,
    volatilityAnnual: risk.annualizedVolatility?.toNumber() ?? null,
    sharpeRatio: risk.sharpeRatio?.toNumber() ?? null,
    sortinoRatio: risk.sortinoRatio?.toNumber() ?? null,
    bestDay: risk.bestDay?.toNumber() ?? null,
    worstDay: risk.worstDay?.toNumber() ?? null,
    positiveDayRatio: risk.positiveDayRatio?.toNumber() ?? null,
    observationCount: risk.observationCount,
    inflationHurdle,
    inflationLabel: latestInf
      ? `Aylık TÜFE ${latestInf.period}`
      : "Aylık TÜFE",
    vsInflationPnl,
    vsInflationReturn,
    depositHurdle,
    depositLabel: `Vadeli (yıllık %${(rf * 100).toFixed(0)} → aylık efektif)`,
    vsDepositPnl,
    vsDepositReturn,
    allocationByClass,
    allocationBySymbol,
    largestWeight: concentration.largestWeight?.toNumber() ?? null,
    top3Weight: concentration.top3Weight?.toNumber() ?? null,
    hhi: concentration.herfindahlHirschmanIndex?.toNumber() ?? null,
    bist100Return: bistReturn,
    bist100Start: bistStart,
    bist100End: bistEnd,
    alphaVsBist,
    betaVsBist: risk.beta?.toNumber() ?? null,
    correlationVsBist: risk.correlation?.toNumber() ?? null,
  };
}
