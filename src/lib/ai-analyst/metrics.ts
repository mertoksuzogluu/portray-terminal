import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import {
  computeRiskMetrics,
  concentrationAnalysis,
} from "@/lib/calculations/risk";
import { assetTypeToClass } from "@/lib/recommendations/asset-class";
import { toDateKey } from "@/lib/utils/dates";
import type { MonthlyAiMetrics } from "./types";

/** Yıllık faiz → elde tutulan güne: (1+r)^(gün/365) − 1 */
function holdingPeriodRate(annualRate: number, days: number): number {
  if (days <= 0 || !Number.isFinite(annualRate)) return 0;
  return d(1).plus(annualRate).pow(d(days).div(365)).minus(1).toNumber();
}

/** Aylık oran → elde tutulan güne: (1+m)^(gün/ayGünü) − 1 */
function prorateMonthlyRate(
  monthlyRate: number,
  days: number,
  daysInMonth: number
): number {
  if (days <= 0 || daysInMonth <= 0 || !Number.isFinite(monthlyRate)) return 0;
  return d(1)
    .plus(monthlyRate)
    .pow(d(days).div(daysInMonth))
    .minus(1)
    .toNumber();
}

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

  // BIST kıyası: portföy gözlem penceresi (ay başı demo fiyatıyla karışmasın)
  const bistFrom = first?.snapshotDate ?? periodStart;
  const bistTo = last?.snapshotDate ?? periodEnd;

  if (xu100) {
    const benchPrices = await prisma.benchmarkPrice.findMany({
      where: {
        benchmarkId: xu100.id,
        priceDate: { gte: bistFrom, lte: bistTo },
        NOT: { source: "demo-seed" },
      },
      orderBy: { priceDate: "asc" },
    });

    const LIVE = new Set([
      "yahoo_finance",
      "twelve_data",
      "twelve_data_fx",
      "tcmb_evds",
      "tcmb_evds_fx",
    ]);
    const hasLive = benchPrices.some((r) => LIVE.has(r.source));
    // Canlı kaynak varsa yalnızca onu kullan — carry-forward(~10.7k) + yahoo(~13.9k) = sahte %30
    const usable = hasLive
      ? benchPrices.filter((r) => LIVE.has(r.source))
      : benchPrices.filter((r) => r.source !== "carry-forward");

    const byDate = new Map<string, { value: number; rank: number }>();
    for (const row of usable) {
      const key = toDateKey(row.priceDate);
      const value = Number(row.value.toString());
      const rank = LIVE.has(row.source) ? 0 : 10;
      const prev = byDate.get(key);
      if (!prev || rank < prev.rank) {
        byDate.set(key, { value, rank });
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
        const dayRet = (cur - prev) / prev;
        if (Math.abs(dayRet) <= 0.15) {
          benchDailyByDate.set(dates[i]!, dayRet);
        }
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

  // Kâr hangi penceredeyse vadeli/enflasyon da aynı gün sayısıyla
  const heldDays =
    first && last
      ? Math.max(
          1,
          Math.round(
            (last.snapshotDate.getTime() - first.snapshotDate.getTime()) /
              86_400_000
          )
        )
      : null;
  const daysInMonth = new Date(
    Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, 0)
  ).getUTCDate();

  const capitalForOpp =
    startValue != null && startValue > 0
      ? startValue
      : investedCapital != null && investedCapital > 0
        ? investedCapital
        : null;

  const inflationMonthlyRaw =
    latestInf?.monthlyRate != null
      ? Number(latestInf.monthlyRate.toString())
      : null;
  const inflationHurdle =
    inflationMonthlyRaw != null && heldDays != null
      ? prorateMonthlyRate(inflationMonthlyRaw, heldDays, daysInMonth)
      : inflationMonthlyRaw;

  const depositHurdle =
    heldDays != null ? holdingPeriodRate(rf, heldDays) : null;

  const inflationOpportunityPnl =
    capitalForOpp != null && inflationHurdle != null
      ? capitalForOpp * inflationHurdle
      : null;
  const depositOpportunityPnl =
    capitalForOpp != null && depositHurdle != null
      ? capitalForOpp * depositHurdle
      : null;

  // Fark = portföy kârı − fırsat maliyeti (eksi ⇒ vadeli/enflasyon daha iyi)
  const vsInflationPnl =
    nominalPnl != null && inflationOpportunityPnl != null
      ? nominalPnl - inflationOpportunityPnl
      : null;
  const vsDepositPnl =
    nominalPnl != null && depositOpportunityPnl != null
      ? nominalPnl - depositOpportunityPnl
      : null;

  const vsInflationReturn =
    vsInflationPnl != null && capitalForOpp != null && capitalForOpp > 0
      ? vsInflationPnl / capitalForOpp
      : null;
  const vsDepositReturn =
    vsDepositPnl != null && capitalForOpp != null && capitalForOpp > 0
      ? vsDepositPnl / capitalForOpp
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
    heldDays,
    inflationHurdle,
    inflationLabel: latestInf
      ? heldDays != null
        ? `TÜFE ${latestInf.period} · ${heldDays} gün`
        : `Aylık TÜFE ${latestInf.period}`
      : "Enflasyon kıyası",
    inflationOpportunityPnl,
    vsInflationPnl,
    vsInflationReturn,
    depositHurdle,
    depositLabel:
      heldDays != null
        ? `Vadeli (yıllık %${(rf * 100).toFixed(0)} · ${heldDays} gün)`
        : `Vadeli (yıllık %${(rf * 100).toFixed(0)})`,
    depositOpportunityPnl,
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
