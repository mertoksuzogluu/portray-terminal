import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import {
  calculateRealReturn,
  findIndexAtPeriod,
} from "@/lib/calculations/inflation";
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

type SnapshotRow = Awaited<ReturnType<typeof getPortfolioSnapshots>>[number];

type PeriodKey = "month" | "year" | "total";

interface PeriodBlock {
  key: PeriodKey;
  label: string;
  startDate: string;
  endDate: string;
  startValue: number | null;
  endValue: number | null;
  nominalPnl: number | null;
  nominalReturn: number | null;
  hurdles: {
    inflation: { rate: number | null; label: string };
    usd: { rate: number | null; label: string };
    deposit: { rate: number | null; label: string };
  };
  adjusted: {
    vsInflation: number | null;
    vsUsd: number | null;
    vsDeposit: number | null;
  };
}

function computePeriodPnl(
  snapshots: SnapshotRow[],
  start: Date,
  end: Date
): {
  startDate: string;
  endDate: string;
  startValue: number | null;
  endValue: number | null;
  nominalPnl: number | null;
  nominalReturn: number | null;
} {
  const snaps = snapshots.filter((s) => {
    const t = s.snapshotDate.getTime();
    return t >= start.getTime() && t <= end.getTime();
  });

  if (snaps.length === 0) {
    return {
      startDate: toDateKey(start),
      endDate: toDateKey(end),
      startValue: null,
      endValue: null,
      nominalPnl: null,
      nominalReturn: null,
    };
  }

  const first = snaps[0]!;
  const last = snaps[snaps.length - 1]!;
  const startValue = d(first.totalMarketValue.toString());
  const endValue = d(last.totalMarketValue.toString());
  const startNet = d(first.netContributions.toString());
  const endNet = d(last.netContributions.toString());
  const nominalPnl = endValue.minus(startValue).minus(endNet.minus(startNet));
  const nominalReturn =
    snaps.length >= 2 ? periodReturnFromValues(startValue, endValue) : null;

  return {
    startDate: toDateKey(first.snapshotDate),
    endDate: toDateKey(last.snapshotDate),
    startValue: startValue.toNumber(),
    endValue: endValue.toNumber(),
    nominalPnl: nominalPnl.toNumber(),
    nominalReturn: nominalReturn?.toNumber() ?? null,
  };
}

async function usdChange(
  rangeStart: Date,
  rangeEnd: Date
): Promise<{ rate: number | null; start: number | null; end: number | null }> {
  const benchmark = await prisma.benchmark.findUnique({
    where: { symbol: "USDTRY" },
    select: { id: true },
  });
  if (!benchmark) return { rate: null, start: null, end: null };

  const [startRow, endRow] = await Promise.all([
    prisma.benchmarkPrice.findFirst({
      where: {
        benchmarkId: benchmark.id,
        priceDate: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { priceDate: "asc" },
    }),
    prisma.benchmarkPrice.findFirst({
      where: {
        benchmarkId: benchmark.id,
        priceDate: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { priceDate: "desc" },
    }),
  ]);

  if (!startRow || !endRow) return { rate: null, start: null, end: null };

  const start = Number(startRow.value.toString());
  const end = Number(endRow.value.toString());
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) {
    return { rate: null, start, end };
  }

  return { rate: end / start - 1, start, end };
}

function holdingYears(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (365.25 * 86_400_000));
}

function buildAdjusted(
  nominalPnl: number | null,
  inflationRate: number | null,
  usdRate: number | null,
  depositRate: number | null
) {
  return {
    vsInflation:
      nominalPnl != null && inflationRate != null
        ? adjustPnlByHurdle(nominalPnl, inflationRate).toNumber()
        : null,
    vsUsd:
      nominalPnl != null && usdRate != null
        ? adjustPnlByHurdle(nominalPnl, usdRate).toNumber()
        : null,
    vsDeposit:
      nominalPnl != null && depositRate != null
        ? adjustPnlByHurdle(nominalPnl, depositRate).toNumber()
        : null,
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

    const cashFlowsAll = buildContributionCashFlows(transactions);

    // Grafik: her snapshot için canlı nominal + TÜFE reel (eski snapshot realReturn'ü kullanma)
    const series = snapshots.map((s) => {
      const value = d(s.totalMarketValue.toString());
      const net = d(s.netContributions.toString());
      const nominalPnl = value.minus(net);
      const nominalReturn = net.isZero() ? null : nominalPnl.div(net);

      const flowsToDate = cashFlowsAll.filter(
        (f) => f.date.getTime() <= s.snapshotDate.getTime()
      );
      const real =
        inflationPoints.length > 0 && flowsToDate.length > 0
          ? calculateRealReturn({
              currentValue: value,
              cashFlows: flowsToDate,
              inflationSeries: inflationPoints,
              asOf: s.snapshotDate,
            })
          : null;

      return {
        date: toDateKey(s.snapshotDate),
        nominalValue: value.toNumber(),
        investedCapital: net.toNumber(),
        nominalPnl: nominalPnl.toNumber(),
        nominalReturn: nominalReturn?.toNumber() ?? null,
        realReturn: real?.realReturn?.toNumber() ?? null,
        realPnl: real?.realProfit.toNumber() ?? null,
        inflationAdjustedCapital:
          real?.inflationAdjustedCapital.toNumber() ?? null,
      };
    });

    const latest = snapshots.at(-1);
    const latestSeries = series.at(-1);
    const computedReal = {
      realReturn: latestSeries?.realReturn ?? null,
      inflationAdjustedCapital: latestSeries?.inflationAdjustedCapital ?? null,
      isEstimated:
        latest && inflationPoints.length > 0
          ? (() => {
              const latestPeriod = inflation.at(-1)?.period;
              if (!latestPeriod || !latest) return false;
              const asOfPeriod = `${latest.snapshotDate.getUTCFullYear()}-${String(latest.snapshotDate.getUTCMonth() + 1).padStart(2, "0")}`;
              return latestPeriod < asOfPeriod;
            })()
          : false,
    };

    const latestInf = inflation.at(-1);
    const asOf = latest?.snapshotDate ?? new Date();
    const ranges = periodRanges(asOf);

    const firstSnap = snapshots[0] ?? null;
    const totalStart = firstSnap?.snapshotDate ?? ranges.thisMonth.start;
    const totalEnd = asOf;

    const monthPnl = computePeriodPnl(
      snapshots,
      ranges.thisMonth.start,
      ranges.thisMonth.end
    );
    const yearPnl = computePeriodPnl(
      snapshots,
      ranges.last1y.start,
      ranges.last1y.end
    );
    const totalPnl = computePeriodPnl(snapshots, totalStart, totalEnd);

    const inflationMonthly =
      latestInf?.monthlyRate != null
        ? Number(latestInf.monthlyRate.toString())
        : null;
    const inflationAnnual =
      latestInf?.annualRate != null
        ? Number(latestInf.annualRate.toString())
        : null;

    // Toplam enflasyon hurdle: ilk katkı ayı → son endeks (+ prorata zaten capital'de)
    let inflationTotal: number | null = null;
    if (firstSnap && inflationPoints.length > 0) {
      const fromPeriod = `${firstSnap.snapshotDate.getUTCFullYear()}-${String(firstSnap.snapshotDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const toPeriod = latestInf?.period ?? fromPeriod;
      const fromIdx = findIndexAtPeriod(inflationPoints, fromPeriod);
      const toIdx = findIndexAtPeriod(inflationPoints, toPeriod);
      if (fromIdx && toIdx && !fromIdx.isZero()) {
        inflationTotal = toIdx.div(fromIdx).minus(1).toNumber();
      }
    }

    const [usdMonth, usdYear, usdTotal] = await Promise.all([
      usdChange(ranges.thisMonth.start, ranges.thisMonth.end),
      usdChange(ranges.last1y.start, ranges.last1y.end),
      usdChange(totalStart, totalEnd),
    ]);

    const annualDeposit = Number(user.riskFreeRateAnnual);
    const depositMonthly = annualToMonthlyRate(annualDeposit).toNumber();
    const yearsHeld = holdingYears(totalStart, totalEnd);
    const depositTotal =
      yearsHeld > 0
        ? d(1).plus(annualDeposit).pow(yearsHeld).minus(1).toNumber()
        : 0;

    const periods: Record<PeriodKey, PeriodBlock> = {
      month: {
        key: "month",
        label: "Aylık",
        ...monthPnl,
        hurdles: {
          inflation: {
            rate: inflationMonthly,
            label: latestInf
              ? `Aylık TÜFE ${latestInf.period}`
              : "Aylık TÜFE",
          },
          usd: {
            rate: usdMonth.rate,
            label: "USD/TRY bu ay",
          },
          deposit: {
            rate: depositMonthly,
            label: "Vadeli (aylık efektif)",
          },
        },
        adjusted: buildAdjusted(
          monthPnl.nominalPnl,
          inflationMonthly,
          usdMonth.rate,
          depositMonthly
        ),
      },
      year: {
        key: "year",
        label: "Yıllık",
        ...yearPnl,
        hurdles: {
          inflation: {
            rate: inflationAnnual,
            label: latestInf
              ? `Yıllık TÜFE YoY ${latestInf.period}`
              : "Yıllık TÜFE YoY",
          },
          usd: {
            rate: usdYear.rate,
            label: "USD/TRY son 12 ay",
          },
          deposit: {
            rate: annualDeposit,
            label: "Vadeli (yıllık)",
          },
        },
        adjusted: buildAdjusted(
          yearPnl.nominalPnl,
          inflationAnnual,
          usdYear.rate,
          annualDeposit
        ),
      },
      total: {
        key: "total",
        label: "Toplam",
        ...totalPnl,
        hurdles: {
          inflation: {
            rate: inflationTotal,
            label: "TÜFE (dönem başı→son)",
          },
          usd: {
            rate: usdTotal.rate,
            label: "USD/TRY (dönem başı→son)",
          },
          deposit: {
            rate: depositTotal,
            label: `Vadeli (${yearsHeld.toFixed(2)} yıl bileşik)`,
          },
        },
        adjusted: buildAdjusted(
          totalPnl.nominalPnl,
          inflationTotal,
          usdTotal.rate,
          depositTotal
        ),
      },
    };

    // Geriye uyum: eski alanlar = aylık görünüm
    const month = {
      startDate: periods.month.startDate,
      endDate: periods.month.endDate,
      startValue: periods.month.startValue,
      endValue: periods.month.endValue,
      nominalPnl: periods.month.nominalPnl,
      nominalReturn: periods.month.nominalReturn,
    };

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
        investedCapital,
        currentValue,
        realReturn:
          computedReal.realReturn ??
          (latest?.realReturn ? Number(latest.realReturn.toString()) : null),
        inflationAdjustedCapital:
          computedReal.inflationAdjustedCapital ??
          (latest?.inflationAdjustedCapital
            ? Number(latest.inflationAdjustedCapital.toString())
            : null),
        realReturnIsEstimated: computedReal.isEstimated,
        latestInflationRate: inflationAnnual,
        latestMonthlyInflation: inflationMonthly,
        latestPeriod: latestInf?.period ?? null,
        month,
        periods,
        hurdles: {
          inflation: {
            period: latestInf?.period ?? null,
            rate: inflationMonthly,
            annualRate: inflationAnnual,
          },
          usd: {
            rate: usdMonth.rate,
            start: usdMonth.start,
            end: usdMonth.end,
          },
          deposit: {
            annualRate: annualDeposit,
            monthlyRate: depositMonthly,
          },
        },
        adjusted: periods.month.adjusted,
      },
      series,
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
