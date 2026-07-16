import { startOfMonth } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { d, type Decimal } from "@/lib/calculations/decimal";
import {
  buildPortfolioXirrFlows,
  calculateXirr,
} from "@/lib/calculations/xirr";
import {
  chainTwr,
  monthlyReturnStats,
  periodReturnFromValues,
} from "@/lib/calculations/returns";
import { periodRanges, startOfDay } from "@/lib/utils/dates";

export interface PeriodPerformance {
  label: string;
  startDate: Date;
  endDate: Date;
  valueReturn: Decimal | null;
  twrReturn: Decimal | null;
  observationCount: number;
}

export interface MonthlyPerformanceBreakdown {
  months: Array<{
    month: string;
    twrReturn: Decimal | null;
    valueReturn: Decimal | null;
  }>;
  arithmeticAverage: Decimal | null;
  geometricAverage: Decimal | null;
  compoundedReturn: Decimal | null;
  monthCount: number;
}

export interface PortfolioPerformanceMetrics {
  portfolioId: string;
  asOf: Date;
  totalMarketValue: Decimal | null;
  netContributions: Decimal | null;
  cumulativeReturn: Decimal | null;
  twrCumulative: Decimal | null;
  xirr: Decimal | null;
  periods: {
    last7d: PeriodPerformance | null;
    last30d: PeriodPerformance | null;
    thisMonth: PeriodPerformance | null;
    last5Months: MonthlyPerformanceBreakdown;
  };
}

function mapSnapshot(row: {
  snapshotDate: Date;
  totalMarketValue: Prisma.Decimal;
  netContributions: Prisma.Decimal;
  cumulativeReturn: Prisma.Decimal | null;
  twrDailyFactor: Prisma.Decimal | null;
  twrCumulative: Prisma.Decimal | null;
}) {
  return {
    snapshotDate: row.snapshotDate,
    totalMarketValue: d(row.totalMarketValue.toString()),
    netContributions: d(row.netContributions.toString()),
    cumulativeReturn: row.cumulativeReturn
      ? d(row.cumulativeReturn.toString())
      : null,
    twrDailyFactor: row.twrDailyFactor
      ? d(row.twrDailyFactor.toString())
      : null,
    twrCumulative: row.twrCumulative ? d(row.twrCumulative.toString()) : null,
  };
}

function computePeriodPerformance(
  label: string,
  snapshots: ReturnType<typeof mapSnapshot>[],
  startDate: Date,
  endDate: Date
): PeriodPerformance | null {
  const filtered = snapshots.filter((s) => {
    const t = s.snapshotDate.getTime();
    return t >= startDate.getTime() && t <= endDate.getTime();
  });

  if (filtered.length === 0) return null;

  const factors = filtered
    .map((s) => s.twrDailyFactor)
    .filter((f): f is Decimal => f !== null);

  const valueReturn =
    filtered.length >= 2
      ? periodReturnFromValues(
          filtered[0]!.totalMarketValue,
          filtered[filtered.length - 1]!.totalMarketValue
        )
      : null;

  return {
    label,
    startDate,
    endDate,
    valueReturn,
    twrReturn: factors.length > 0 ? chainTwr(factors) : null,
    observationCount: filtered.length,
  };
}

function monthKey(date: Date): string {
  return startOfMonth(date).toISOString().slice(0, 7);
}

function computeLast5MonthsBreakdown(
  snapshots: ReturnType<typeof mapSnapshot>[],
  asOf: Date
): MonthlyPerformanceBreakdown {
  const months: MonthlyPerformanceBreakdown["months"] = [];
  const cursor = startOfMonth(asOf);

  for (let i = 4; i >= 0; i -= 1) {
    const monthStart = new Date(cursor);
    monthStart.setMonth(cursor.getMonth() - i);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthStart.getMonth() + 1);
    monthEnd.setDate(0);

    const monthSnaps = snapshots.filter((s) => {
      const t = s.snapshotDate.getTime();
      return t >= monthStart.getTime() && t <= monthEnd.getTime();
    });

    const factors = monthSnaps
      .map((s) => s.twrDailyFactor)
      .filter((f): f is Decimal => f !== null);

    months.push({
      month: monthKey(monthStart),
      twrReturn: factors.length > 0 ? chainTwr(factors) : null,
      valueReturn:
        monthSnaps.length >= 2
          ? periodReturnFromValues(
              monthSnaps[0]!.totalMarketValue,
              monthSnaps[monthSnaps.length - 1]!.totalMarketValue
            )
          : null,
    });
  }

  const validReturns = months
    .map((m) => m.twrReturn)
    .filter((r): r is Decimal => r !== null);
  const stats = monthlyReturnStats(validReturns);

  return {
    months,
    arithmeticAverage: stats.arithmeticMonthlyAverage,
    geometricAverage: stats.geometricMonthlyAverage,
    compoundedReturn: stats.compoundedTotalReturn,
    monthCount: stats.monthCount,
  };
}

async function computeXirr(
  portfolioId: string,
  asOf: Date,
  currentValue: Decimal
): Promise<Decimal | null> {
  const txs = await prisma.transaction.findMany({
    where: {
      portfolioId,
      transactionDate: { lte: asOf },
      transactionType: {
        in: ["CASH_DEPOSIT", "CASH_WITHDRAWAL", "TRANSFER_IN", "TRANSFER_OUT"],
      },
      assetId: null,
    },
    orderBy: { transactionDate: "asc" },
  });

  const contributions: Array<{ date: Date; amount: Decimal }> = [];
  const withdrawals: Array<{ date: Date; amount: Decimal }> = [];

  for (const tx of txs) {
    const amount = d(tx.grossAmount.toString()).times(
      d(tx.fxRateToBase.toString())
    );
    if (
      tx.transactionType === "CASH_DEPOSIT" ||
      tx.transactionType === "TRANSFER_IN"
    ) {
      contributions.push({ date: tx.transactionDate, amount });
    } else {
      withdrawals.push({ date: tx.transactionDate, amount });
    }
  }

  const flows = buildPortfolioXirrFlows({
    contributions,
    withdrawals,
    currentValue,
    asOf,
  });

  return calculateXirr(flows);
}

export async function computePortfolioPerformance(
  portfolioId: string,
  asOf: Date = new Date()
): Promise<PortfolioPerformanceMetrics | null> {
  const insightDate = startOfDay(asOf);
  const ranges = periodRanges(insightDate);

  const rows = await prisma.portfolioDailySnapshot.findMany({
    where: {
      portfolioId,
      snapshotDate: { lte: insightDate },
    },
    orderBy: { snapshotDate: "asc" },
  });

  if (rows.length === 0) {
    return {
      portfolioId,
      asOf: insightDate,
      totalMarketValue: null,
      netContributions: null,
      cumulativeReturn: null,
      twrCumulative: null,
      xirr: null,
      periods: {
        last7d: null,
        last30d: null,
        thisMonth: null,
        last5Months: {
          months: [],
          arithmeticAverage: null,
          geometricAverage: null,
          compoundedReturn: null,
          monthCount: 0,
        },
      },
    };
  }

  const snapshots = rows.map(mapSnapshot);
  const latest = snapshots[snapshots.length - 1]!;

  const xirr = await computeXirr(
    portfolioId,
    insightDate,
    latest.totalMarketValue
  );

  return {
    portfolioId,
    asOf: insightDate,
    totalMarketValue: latest.totalMarketValue,
    netContributions: latest.netContributions,
    cumulativeReturn: latest.cumulativeReturn,
    twrCumulative: latest.twrCumulative,
    xirr,
    periods: {
      last7d: computePeriodPerformance(
        "7g",
        snapshots,
        ranges.last7d.start,
        ranges.last7d.end
      ),
      last30d: computePeriodPerformance(
        "30g",
        snapshots,
        ranges.last30d.start,
        ranges.last30d.end
      ),
      thisMonth: computePeriodPerformance(
        "Bu ay",
        snapshots,
        ranges.thisMonth.start,
        ranges.thisMonth.end
      ),
      last5Months: computeLast5MonthsBreakdown(snapshots, insightDate),
    },
  };
}
