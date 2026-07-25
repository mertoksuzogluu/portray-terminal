import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import { calculateRealReturn } from "@/lib/calculations/inflation";
import {
  adjustPnlByHurdle,
  annualToMonthlyRate,
} from "@/lib/calculations/monthly-hurdle";
import { periodReturnFromValues } from "@/lib/calculations/returns";
import {
  getPortfolioSnapshots,
  requirePortfolioContext,
} from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { periodRanges, toDateKey } from "@/lib/utils/dates";
import { buildContributionCashFlows } from "@/lib/services/snapshot-service";

async function usdMonthlyChange(
  monthStart: Date,
  monthEnd: Date
): Promise<{ rate: number | null; start: number | null; end: number | null }> {
  const benchmark = await prisma.benchmark.findUnique({
    where: { symbol: "USDTRY" },
    select: { id: true },
  });
  if (!benchmark) {
    return { rate: null, start: null, end: null };
  }

  const [startRow, endRow] = await Promise.all([
    prisma.benchmarkPrice.findFirst({
      where: {
        benchmarkId: benchmark.id,
        priceDate: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { priceDate: "asc" },
    }),
    prisma.benchmarkPrice.findFirst({
      where: {
        benchmarkId: benchmark.id,
        priceDate: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { priceDate: "desc" },
    }),
  ]);

  if (!startRow || !endRow) {
    return { rate: null, start: null, end: null };
  }

  const start = Number(startRow.value.toString());
  const end = Number(endRow.value.toString());
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) {
    return { rate: null, start, end };
  }

  return {
    rate: end / start - 1,
    start,
    end,
  };
}

export async function GET() {
  try {
    const { user, portfolioId } = await requirePortfolioContext();
    const [snapshots, inflation, transactions] = await Promise.all([
      getPortfolioSnapshots(portfolioId, 730),
      prisma.inflationIndex.findMany({
        where: { countryCode: "TR", indexType: "TUFE" },
        orderBy: { period: "asc" },
      }),
      prisma.transaction.findMany({
        where: { portfolioId },
        orderBy: { transactionDate: "asc" },
      }),
    ]);

    const inflationPoints = inflation.map((i) => ({
      period: i.period,
      indexValue: d(i.indexValue.toString()),
      monthlyRate: i.monthlyRate ? d(i.monthlyRate.toString()) : null,
    }));

    const series = snapshots.map((s) => {
      const nominal = s.cumulativeReturn
        ? Number(s.cumulativeReturn.toString())
        : null;
      const real = s.realReturn ? Number(s.realReturn.toString()) : null;
      return {
        date: toDateKey(s.snapshotDate),
        nominalValue: Number(s.totalMarketValue.toString()),
        nominalReturn: nominal,
        realReturn: real,
        inflationAdjustedCapital: s.inflationAdjustedCapital
          ? Number(s.inflationAdjustedCapital.toString())
          : null,
        realPnl: s.realProfitLoss ? Number(s.realProfitLoss.toString()) : null,
      };
    });

    const latest = snapshots.at(-1);
    let computedReal: {
      realReturn: number | null;
      inflationAdjustedCapital: number | null;
      isEstimated: boolean;
    } = {
      realReturn: null,
      inflationAdjustedCapital: null,
      isEstimated: false,
    };

    if (latest && inflationPoints.length > 0) {
      const cashFlows = buildContributionCashFlows(transactions);
      const result = calculateRealReturn({
        currentValue: d(latest.totalMarketValue.toString()),
        cashFlows,
        inflationSeries: inflationPoints,
        asOf: latest.snapshotDate,
      });
      computedReal = {
        realReturn: result.realReturn?.toNumber() ?? null,
        inflationAdjustedCapital: result.inflationAdjustedCapital.toNumber(),
        isEstimated: result.isEstimated,
      };
    }

    const latestInf = inflation.at(-1);
    const asOf = latest?.snapshotDate ?? new Date();
    const ranges = periodRanges(asOf);
    const monthStart = ranges.thisMonth.start;
    const monthEnd = ranges.thisMonth.end;

    const monthSnaps = snapshots.filter((s) => {
      const t = s.snapshotDate.getTime();
      return t >= monthStart.getTime() && t <= monthEnd.getTime();
    });

    let month: {
      startDate: string;
      endDate: string;
      startValue: number | null;
      endValue: number | null;
      nominalPnl: number | null;
      nominalReturn: number | null;
    } = {
      startDate: toDateKey(monthStart),
      endDate: toDateKey(monthEnd),
      startValue: null,
      endValue: null,
      nominalPnl: null,
      nominalReturn: null,
    };

    if (monthSnaps.length >= 1) {
      const first = monthSnaps[0]!;
      const last = monthSnaps[monthSnaps.length - 1]!;
      const startValue = d(first.totalMarketValue.toString());
      const endValue = d(last.totalMarketValue.toString());
      const startNet = d(first.netContributions.toString());
      const endNet = d(last.netContributions.toString());
      const nominalPnl = endValue.minus(startValue).minus(endNet.minus(startNet));
      const nominalReturn =
        monthSnaps.length >= 2
          ? periodReturnFromValues(startValue, endValue)
          : null;

      month = {
        startDate: toDateKey(first.snapshotDate),
        endDate: toDateKey(last.snapshotDate),
        startValue: startValue.toNumber(),
        endValue: endValue.toNumber(),
        nominalPnl: nominalPnl.toNumber(),
        nominalReturn: nominalReturn?.toNumber() ?? null,
      };
    }

    const inflationRate =
      latestInf?.monthlyRate != null
        ? Number(latestInf.monthlyRate.toString())
        : null;
    const annualInflation =
      latestInf?.annualRate != null
        ? Number(latestInf.annualRate.toString())
        : null;
    const usd = await usdMonthlyChange(monthStart, monthEnd);
    const annualDeposit = Number(user.riskFreeRateAnnual);
    const depositMonthly = annualToMonthlyRate(annualDeposit).toNumber();

    const nominalPnl = month.nominalPnl;
    const adjusted = {
      vsInflation:
        nominalPnl != null && inflationRate != null
          ? adjustPnlByHurdle(nominalPnl, inflationRate).toNumber()
          : null,
      vsUsd:
        nominalPnl != null && usd.rate != null
          ? adjustPnlByHurdle(nominalPnl, usd.rate).toNumber()
          : null,
      vsDeposit:
        nominalPnl != null
          ? adjustPnlByHurdle(nominalPnl, depositMonthly).toNumber()
          : null,
    };

    const monthlyReal = series.filter((_, i) => i % 22 === 0);
    const nominalReturn = latest?.cumulativeReturn
      ? Number(latest.cumulativeReturn.toString())
      : null;

    const investedCapital = latest
      ? Number(latest.netContributions.toString())
      : null;
    const currentValue = latest
      ? Number(latest.totalMarketValue.toString())
      : null;

    return jsonOk({
      summary: {
        nominalReturn,
        // Yatırılan ana para (getiri eklenmez) — net katkılar
        investedCapital,
        currentValue,
        // Canlı hesap (prorata dahil); eski snapshot'taki eşit nominal/reel değerini ez
        realReturn: computedReal.realReturn ?? (
          latest?.realReturn
            ? Number(latest.realReturn.toString())
            : null
        ),
        inflationAdjustedCapital:
          computedReal.inflationAdjustedCapital ??
          (latest?.inflationAdjustedCapital
            ? Number(latest.inflationAdjustedCapital.toString())
            : null),
        realReturnIsEstimated: computedReal.isEstimated,
        latestInflationRate: annualInflation,
        latestMonthlyInflation: inflationRate,
        latestPeriod: latestInf?.period ?? null,
        month,
        hurdles: {
          inflation: {
            period: latestInf?.period ?? null,
            rate: inflationRate,
            annualRate: annualInflation,
          },
          usd: {
            rate: usd.rate,
            start: usd.start,
            end: usd.end,
          },
          deposit: {
            annualRate: annualDeposit,
            monthlyRate: depositMonthly,
          },
        },
        adjusted,
      },
      series,
      monthlyReal,
      inflation: inflation
        .slice(-18)
        .reverse()
        .map((i) => ({
          period: i.period,
          indexValue: Number(i.indexValue.toString()),
          monthlyRate: i.monthlyRate ? Number(i.monthlyRate.toString()) : null,
          annualRate: i.annualRate ? Number(i.annualRate.toString()) : null,
          source: i.source,
        })),
      inflationAvailable: inflation.length > 0,
    });
  } catch (error) {
    return jsonError(error);
  }
}
