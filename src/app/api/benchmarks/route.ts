import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import { normalizeSeriesToBase } from "@/lib/calculations/returns";
import { getPortfolioSnapshots, requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";
import { toDateKey } from "@/lib/utils/dates";

/** Tarih anahtarı → değer; anahtarlar artan sırada. */
function valueOnOrBefore(
  sortedKeys: string[],
  map: Map<string, number>,
  date: string
): number | null {
  // binary search last key <= date
  let lo = 0;
  let hi = sortedKeys.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedKeys[mid] <= date) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best < 0) return null;
  return map.get(sortedKeys[best]) ?? null;
}

export async function GET() {
  try {
    const { portfolioId } = await requirePortfolioContext();

    const [benchmarks, snapshots] = await Promise.all([
      prisma.benchmark.findMany({
        where: { isActive: true },
        include: {
          // Son ~400 işlem günü (eskiden asc+take ilk 365 alıyordu → güncel tarihler düşüyordu)
          prices: {
            orderBy: { priceDate: "desc" },
            take: 400,
          },
        },
      }),
      getPortfolioSnapshots(portfolioId, 365),
    ]);

    const portfolioNormValues = normalizeSeriesToBase(
      snapshots.map((s) => d(s.totalMarketValue.toString()))
    );

    const portfolioByDate = new Map<string, number>();
    const portfolioDates: string[] = [];
    snapshots.forEach((s, i) => {
      const key = toDateKey(s.snapshotDate);
      portfolioByDate.set(key, portfolioNormValues[i]?.toNumber() ?? 100);
      portfolioDates.push(key);
    });
    portfolioDates.sort();

    const comparison = benchmarks.map((b) => {
      // Aynı güne birden fazla kaynak gelebilir — gün başına tek değer
      const byDateRaw = new Map<string, number>();
      for (const p of [...b.prices].reverse()) {
        const key = toDateKey(p.priceDate);
        if (!byDateRaw.has(key)) byDateRaw.set(key, Number(p.value.toString()));
      }
      const pricesAsc = [...byDateRaw.entries()]
        .sort(([a], [c]) => a.localeCompare(c))
        .map(([date, value]) => ({ date, value }));

      const benchNormValues = normalizeSeriesToBase(
        pricesAsc.map((p) => d(p.value))
      );

      const benchByDate = new Map<string, number>();
      const benchDates: string[] = [];
      pricesAsc.forEach((p, i) => {
        benchByDate.set(p.date, benchNormValues[i]?.toNumber() ?? 100);
        benchDates.push(p.date);
      });

      // Portföy günlerinde benchmark’ı (o gün veya önceki son değer) hizala
      let series = portfolioDates
        .map((date) => {
          const portfolio = portfolioByDate.get(date);
          const benchmark = valueOnOrBefore(benchDates, benchByDate, date);
          if (portfolio == null || benchmark == null) return null;
          return { date, portfolio, benchmark };
        })
        .filter((p): p is NonNullable<typeof p> => p != null);

      // Portföy geçmişi çok kısa / örtüşme yoksa: son 90 benchmark günü + eldeki portföy noktaları
      if (series.length < 5 && benchDates.length > 0) {
        const recentBench = benchDates.slice(-90);
        series = recentBench.map((date) => {
          const benchmark = benchByDate.get(date) ?? 100;
          const portfolio =
            valueOnOrBefore(portfolioDates, portfolioByDate, date) ??
            (portfolioDates.length ? portfolioByDate.get(portfolioDates[0])! : 100);
          return { date, portfolio, benchmark };
        });
      }

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
        thinPortfolioHistory: portfolioDates.length < 10,
      };
    });

    return jsonOk({
      benchmarks: comparison,
      portfolioDays: portfolioDates.length,
    });
  } catch (error) {
    return jsonError(error);
  }
}
