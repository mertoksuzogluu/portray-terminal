import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import { normalizeSeriesToBase } from "@/lib/calculations/returns";
import { getPortfolioSnapshots, requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { toDateKey } from "@/lib/utils/dates";

export async function GET() {
  try {
    const { portfolioId } = await requirePortfolioContext();

    const [benchmarks, snapshots] = await Promise.all([
      prisma.benchmark.findMany({
        where: { isActive: true },
        include: {
          prices: {
            orderBy: { priceDate: "asc" },
            take: 365,
          },
        },
      }),
      getPortfolioSnapshots(portfolioId, 365),
    ]);

    const portfolioNormValues = normalizeSeriesToBase(
      snapshots.map((s) => d(s.totalMarketValue.toString()))
    );

    const portfolioMap = new Map(
      snapshots.map((s, i) => [toDateKey(s.snapshotDate), portfolioNormValues[i]?.toNumber() ?? 100])
    );

    const comparison = benchmarks.map((b) => {
      const benchNormValues = normalizeSeriesToBase(
        b.prices.map((p) => d(p.value.toString()))
      );

      const series = b.prices
        .map((p, i) => {
          const date = toDateKey(p.priceDate);
          const portfolio = portfolioMap.get(date);
          if (portfolio == null) return null;
          return {
            date,
            portfolio,
            benchmark: benchNormValues[i]?.toNumber() ?? 100,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p != null);

      const lastPortfolio = series.at(-1)?.portfolio ?? 100;
      const lastBenchmark = series.at(-1)?.benchmark ?? 100;

      return {
        id: b.id,
        name: b.name,
        symbol: b.symbol,
        type: b.benchmarkType,
        currency: b.currency,
        series,
        outperformance: lastPortfolio - lastBenchmark,
        dataPoints: series.length,
      };
    });

    return jsonOk({ benchmarks: comparison });
  } catch (error) {
    return jsonError(error);
  }
}
