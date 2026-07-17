import type {
  InsightCategory,
  InsightPeriodType,
  InsightSeverity,
} from "@prisma/client";
import type { Decimal } from "@/lib/calculations/decimal";
import type { InflationPoint } from "@/lib/calculations/inflation";

export const INSIGHT_DISCLAIMER =
  "Bu bilgi yatırım tavsiyesi değildir; yalnızca geçmiş performans verilerinize dayanmaktadır.";

export interface PortfolioSnapshotRecord {
  snapshotDate: Date;
  totalMarketValue: Decimal;
  cashValue: Decimal;
  netContributions: Decimal;
  dailyReturn: Decimal | null;
  dailyProfitLoss: Decimal;
  cumulativeReturn: Decimal | null;
  twrDailyFactor: Decimal | null;
  twrCumulative: Decimal | null;
  realReturn: Decimal | null;
  realProfitLoss: Decimal | null;
  inflationAdjustedCapital: Decimal | null;
}

export interface PositionSnapshotRecord {
  assetId: string;
  symbol: string;
  name: string;
  snapshotDate: Date;
  marketValue: Decimal;
  portfolioWeight: Decimal | null;
  dailyReturn: Decimal | null;
  contributionToDailyReturn: Decimal | null;
  marketPrice: Decimal;
  dailyProfitLoss: Decimal;
}

export interface BenchmarkPricePoint {
  date: Date;
  value: Decimal;
}

export interface BenchmarkContext {
  benchmarkId: string;
  symbol: string;
  name: string;
  prices: BenchmarkPricePoint[];
}

export interface AssetPriceQualityRecord {
  assetId: string;
  symbol: string;
  priceDate: Date | null;
  fetchedAt: Date | null;
  dataQuality: string;
  isDelayed: boolean;
}

export interface AssetPriceSeriesRecord {
  assetId: string;
  symbol: string;
  name: string;
  assetType: string;
  closes: number[];
}

export interface PortfolioAnalysisContext {
  portfolioId: string;
  insightDate: Date;
  asOf: Date;
  baseCurrency: string;
  snapshots: PortfolioSnapshotRecord[];
  positionSnapshots: PositionSnapshotRecord[];
  benchmarks: BenchmarkContext[];
  inflationSeries: InflationPoint[];
  assetPriceQuality: AssetPriceQualityRecord[];
  /** Portföy varlıklarının ~2y kapanış serisi (piyasa fırsat kuralları). */
  assetPriceSeries: AssetPriceSeriesRecord[];
  riskFreeRateAnnual: Decimal;
  preferredBenchmarkSymbol: string | null;
}

export interface GeneratedInsight {
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  message: string;
  fingerprint: string;
  periodType: InsightPeriodType;
  metadata?: Record<string, unknown>;
}

export interface InsightRule {
  readonly ruleId: string;
  evaluate(context: PortfolioAnalysisContext): GeneratedInsight[];
}
