import { subMonths } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import type { InflationPoint } from "@/lib/calculations/inflation";
import { startOfDay } from "@/lib/utils/dates";
import { ALL_INSIGHT_RULES } from "./rules";
import type {
  AssetPriceQualityRecord,
  AssetPriceSeriesRecord,
  BenchmarkContext,
  GeneratedInsight,
  InsightRule,
  PortfolioAnalysisContext,
  PortfolioSnapshotRecord,
  PositionSnapshotRecord,
} from "./types";
import { loadAssetPriceSeriesForInsights } from "@/lib/services/market-opportunity";

const SEVERITY_RANK: Record<GeneratedInsight["severity"], number> = {
  CRITICAL: 4,
  WARNING: 3,
  INFO: 2,
  POSITIVE: 1,
};

function mapSnapshot(row: {
  snapshotDate: Date;
  totalMarketValue: Prisma.Decimal;
  cashValue: Prisma.Decimal;
  netContributions: Prisma.Decimal;
  dailyReturn: Prisma.Decimal | null;
  dailyProfitLoss: Prisma.Decimal;
  cumulativeReturn: Prisma.Decimal | null;
  twrDailyFactor: Prisma.Decimal | null;
  twrCumulative: Prisma.Decimal | null;
  realReturn: Prisma.Decimal | null;
  realProfitLoss: Prisma.Decimal | null;
  inflationAdjustedCapital: Prisma.Decimal | null;
}): PortfolioSnapshotRecord {
  return {
    snapshotDate: row.snapshotDate,
    totalMarketValue: d(row.totalMarketValue.toString()),
    cashValue: d(row.cashValue.toString()),
    netContributions: d(row.netContributions.toString()),
    dailyReturn: row.dailyReturn ? d(row.dailyReturn.toString()) : null,
    dailyProfitLoss: d(row.dailyProfitLoss.toString()),
    cumulativeReturn: row.cumulativeReturn
      ? d(row.cumulativeReturn.toString())
      : null,
    twrDailyFactor: row.twrDailyFactor
      ? d(row.twrDailyFactor.toString())
      : null,
    twrCumulative: row.twrCumulative ? d(row.twrCumulative.toString()) : null,
    realReturn: row.realReturn ? d(row.realReturn.toString()) : null,
    realProfitLoss: row.realProfitLoss ? d(row.realProfitLoss.toString()) : null,
    inflationAdjustedCapital: row.inflationAdjustedCapital
      ? d(row.inflationAdjustedCapital.toString())
      : null,
  };
}

export function dedupeInsights(insights: GeneratedInsight[]): GeneratedInsight[] {
  const byFingerprint = new Map<string, GeneratedInsight>();

  for (const insight of insights) {
    const existing = byFingerprint.get(insight.fingerprint);
    if (!existing) {
      byFingerprint.set(insight.fingerprint, insight);
      continue;
    }
    if (SEVERITY_RANK[insight.severity] > SEVERITY_RANK[existing.severity]) {
      byFingerprint.set(insight.fingerprint, insight);
    }
  }

  return [...byFingerprint.values()];
}

export async function buildPortfolioAnalysisContext(
  portfolioId: string,
  asOf: Date = new Date()
): Promise<PortfolioAnalysisContext | null> {
  const insightDate = startOfDay(asOf);
  const lookbackStart = subMonths(insightDate, 6);

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: {
      user: {
        select: {
          riskFreeRateAnnual: true,
          preferredBenchmarkId: true,
        },
      },
    },
  });

  if (!portfolio) return null;

  const [snapshots, positionRows, inflationRows, benchmarks] =
    await Promise.all([
      prisma.portfolioDailySnapshot.findMany({
        where: {
          portfolioId,
          snapshotDate: { gte: lookbackStart, lte: insightDate },
        },
        orderBy: { snapshotDate: "asc" },
      }),
      prisma.positionDailySnapshot.findMany({
        where: {
          portfolioId,
          snapshotDate: { gte: lookbackStart, lte: insightDate },
          accountId: "",
        },
        include: { asset: { select: { symbol: true, name: true } } },
        orderBy: { snapshotDate: "asc" },
      }),
      prisma.inflationIndex.findMany({
        where: { countryCode: "TR", indexType: "TUFE" },
        orderBy: { period: "asc" },
      }),
      prisma.benchmark.findMany({
        where: { isActive: true },
        include: {
          prices: {
            where: { priceDate: { gte: lookbackStart, lte: insightDate } },
            orderBy: { priceDate: "asc" },
          },
        },
      }),
    ]);

  const assetIds = [...new Set(positionRows.map((p) => p.assetId))];
  const assetPrices = assetIds.length
    ? await prisma.assetPrice.findMany({
        where: { assetId: { in: assetIds } },
        orderBy: [{ priceDate: "desc" }, { fetchedAt: "desc" }],
      })
    : [];

  const latestPriceByAsset = new Map<
    string,
    (typeof assetPrices)[number]
  >();
  for (const price of assetPrices) {
    if (!latestPriceByAsset.has(price.assetId)) {
      latestPriceByAsset.set(price.assetId, price);
    }
  }

  const preferredBenchmark = portfolio.user.preferredBenchmarkId
    ? benchmarks.find((b) => b.id === portfolio.user.preferredBenchmarkId)
    : benchmarks[0];

  const inflationSeries: InflationPoint[] = inflationRows.map((r) => ({
    period: r.period,
    indexValue: r.indexValue.toString(),
    monthlyRate: r.monthlyRate?.toString() ?? null,
  }));

  const benchmarkContexts: BenchmarkContext[] = benchmarks.map((b) => ({
    benchmarkId: b.id,
    symbol: b.symbol,
    name: b.name,
    prices: b.prices.map((p) => ({
      date: p.priceDate,
      value: d(p.value.toString()),
    })),
  }));

  const assetPriceQuality: AssetPriceQualityRecord[] = assetIds.map(
    (assetId) => {
      const pos = positionRows.find((p) => p.assetId === assetId);
      const price = latestPriceByAsset.get(assetId);
      return {
        assetId,
        symbol: pos?.asset.symbol ?? assetId,
        priceDate: price?.priceDate ?? null,
        fetchedAt: price?.fetchedAt ?? null,
        dataQuality: price?.dataQuality ?? "ERROR",
        isDelayed: price?.isDelayed ?? true,
      };
    }
  );

  const positionSnapshots: PositionSnapshotRecord[] = positionRows.map((p) => ({
    assetId: p.assetId,
    symbol: p.asset.symbol,
    name: p.asset.name,
    snapshotDate: p.snapshotDate,
    marketValue: d(p.marketValue.toString()),
    portfolioWeight: p.portfolioWeight
      ? d(p.portfolioWeight.toString())
      : null,
    dailyReturn: p.dailyReturn ? d(p.dailyReturn.toString()) : null,
    contributionToDailyReturn: p.contributionToDailyReturn
      ? d(p.contributionToDailyReturn.toString())
      : null,
    marketPrice: d(p.marketPrice.toString()),
    dailyProfitLoss: d(p.dailyProfitLoss.toString()),
  }));

  const assetPriceSeriesRaw = await loadAssetPriceSeriesForInsights(assetIds, 2);
  const assetPriceSeries: AssetPriceSeriesRecord[] = assetPriceSeriesRaw;

  return {
    portfolioId,
    insightDate,
    asOf: insightDate,
    baseCurrency: portfolio.baseCurrency,
    snapshots: snapshots.map(mapSnapshot),
    positionSnapshots,
    benchmarks: benchmarkContexts,
    inflationSeries,
    assetPriceQuality,
    assetPriceSeries,
    riskFreeRateAnnual: d(portfolio.user.riskFreeRateAnnual.toString()),
    preferredBenchmarkSymbol: preferredBenchmark?.symbol ?? null,
  };
}

export function evaluateInsightRules(
  context: PortfolioAnalysisContext,
  rules: InsightRule[] = ALL_INSIGHT_RULES
): GeneratedInsight[] {
  const generated = rules.flatMap((rule) => rule.evaluate(context));
  return dedupeInsights(generated);
}

export interface InsightEngineResult {
  created: number;
  updated: number;
  skipped: number;
  insights: GeneratedInsight[];
}

export async function runInsightEngine(
  portfolioId: string,
  asOf: Date = new Date(),
  rules: InsightRule[] = ALL_INSIGHT_RULES
): Promise<InsightEngineResult> {
  const context = await buildPortfolioAnalysisContext(portfolioId, asOf);
  if (!context) {
    throw new Error(`Portföy bulunamadı: ${portfolioId}`);
  }

  const generated = evaluateInsightRules(context, rules);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const insight of generated) {
    const existing = await prisma.analysisInsight.findUnique({
      where: {
        portfolioId_fingerprint_insightDate: {
          portfolioId,
          fingerprint: insight.fingerprint,
          insightDate: context.insightDate,
        },
      },
    });

    if (existing && existing.message === insight.message) {
      skipped += 1;
      continue;
    }

    await prisma.analysisInsight.upsert({
      where: {
        portfolioId_fingerprint_insightDate: {
          portfolioId,
          fingerprint: insight.fingerprint,
          insightDate: context.insightDate,
        },
      },
      create: {
        portfolioId,
        insightDate: context.insightDate,
        periodType: insight.periodType,
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        message: insight.message,
        fingerprint: insight.fingerprint,
        metadata: insight.metadata as Prisma.InputJsonValue | undefined,
      },
      update: {
        periodType: insight.periodType,
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        message: insight.message,
        metadata: insight.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return { created, updated, skipped, insights: generated };
}
