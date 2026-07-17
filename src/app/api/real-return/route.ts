import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import { calculateRealReturn } from "@/lib/calculations/inflation";
import { getPortfolioSnapshots, requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { toDateKey } from "@/lib/utils/dates";

export async function GET() {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const [snapshots, inflation] = await Promise.all([
      getPortfolioSnapshots(portfolioId, 730),
      prisma.inflationIndex.findMany({
        where: { countryCode: "TR", indexType: "TUFE" },
        orderBy: { period: "asc" },
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
    let computedReal: { realReturn: number | null; inflationAdjustedCapital: number | null } = {
      realReturn: null,
      inflationAdjustedCapital: null,
    };

    if (latest && inflationPoints.length > 0) {
      const result = calculateRealReturn({
        currentValue: d(latest.totalMarketValue.toString()),
        cashFlows: [],
        inflationSeries: inflationPoints,
        asOf: latest.snapshotDate,
      });
      computedReal = {
        realReturn: result.realReturn?.toNumber() ?? null,
        inflationAdjustedCapital: result.inflationAdjustedCapital.toNumber(),
      };
    }

    const latestInf = inflation.at(-1);
    const monthlyReal = series.filter((_, i) => i % 22 === 0);

    return jsonOk({
      summary: {
        nominalReturn: latest?.cumulativeReturn
          ? Number(latest.cumulativeReturn.toString())
          : null,
        realReturn: latest?.realReturn
          ? Number(latest.realReturn.toString())
          : computedReal.realReturn,
        inflationAdjustedCapital:
          latest?.inflationAdjustedCapital
            ? Number(latest.inflationAdjustedCapital.toString())
            : computedReal.inflationAdjustedCapital,
        latestInflationRate: latestInf?.annualRate
          ? Number(latestInf.annualRate.toString())
          : null,
        latestMonthlyInflation: latestInf?.monthlyRate
          ? Number(latestInf.monthlyRate.toString())
          : null,
        latestPeriod: latestInf?.period ?? null,
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
