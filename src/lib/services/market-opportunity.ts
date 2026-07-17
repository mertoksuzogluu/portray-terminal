import { subYears } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { getPortfolioPositions } from "@/lib/services/position-engine";
import { startOfDay } from "@/lib/utils/dates";
import { computeSeriesStats } from "@/lib/insights/rules/market-opportunity-rule-utils";

export type OpportunitySignal =
  | "NEAR_2Y_LOW"
  | "NEAR_2Y_HIGH"
  | "MID_RANGE"
  | "INSUFFICIENT_DATA";

export interface AssetOpportunity {
  assetId: string;
  symbol: string;
  name: string;
  assetType: string;
  inPortfolio: boolean;
  portfolioWeight: number | null;
  currentPrice: number;
  low2y: number;
  high2y: number;
  /** 0 = 2y dip, 1 = 2y zirve */
  rangePosition: number | null;
  drawdownFromHigh: number | null;
  upsideToHigh: number | null;
  return1y: number | null;
  return3m: number | null;
  observationCount: number;
  signal: OpportunitySignal;
  title: string;
  message: string;
  severity: "INFO" | "POSITIVE" | "WARNING";
}

export interface MarketOpportunityAnalysis {
  asOf: string;
  years: number;
  opportunities: AssetOpportunity[];
  portfolioHighlights: AssetOpportunity[];
  watchlistHighlights: AssetOpportunity[];
  disclaimer: string;
}

function extendStats(closes: number[]) {
  const base = computeSeriesStats(closes);
  if (!base) return null;
  const current = base.current;
  const approx1y = Math.min(closes.length - 1, 252);
  const approx3m = Math.min(closes.length - 1, 63);
  const return1y =
    approx1y > 20 && closes[closes.length - 1 - approx1y] > 0
      ? current / closes[closes.length - 1 - approx1y] - 1
      : null;
  const return3m =
    approx3m > 10 && closes[closes.length - 1 - approx3m] > 0
      ? current / closes[closes.length - 1 - approx3m] - 1
      : null;
  const upsideToHigh = current > 0 ? (base.high - current) / current : null;
  return { ...base, return1y, return3m, upsideToHigh };
}

function buildNarrative(input: {
  symbol: string;
  name: string;
  assetType: string;
  inPortfolio: boolean;
  stats: NonNullable<ReturnType<typeof extendStats>>;
  years: number;
}): Pick<AssetOpportunity, "signal" | "title" | "message" | "severity"> {
  const { symbol, name, assetType, inPortfolio, stats, years } = input;
  const typeLabel =
    assetType === "GOLD"
      ? "altın"
      : assetType === "FX"
        ? "döviz"
        : assetType === "MUTUAL_FUND"
          ? "fon"
          : assetType === "STOCK"
            ? "hisse"
            : "varlık";

  const holdNote = inPortfolio
    ? "Bu varlık portföyünüzde."
    : "Portföyünüzde yok; yalnızca piyasa bağlamı.";

  const pct = (v: number | null) =>
    v == null ? "—" : `%${(v * 100).toFixed(1)}`;

  if (stats.rangePosition != null && stats.rangePosition <= 0.15) {
    return {
      signal: "NEAR_2Y_LOW",
      severity: "POSITIVE",
      title: `${symbol}: ${years} yıllık banda göre düşük bölge`,
      message: `${name} (${typeLabel}) son ${years} yıldaki fiyat bandının alt %${(
        stats.rangePosition * 100
      ).toFixed(0)} diliminde. 2y dip ${stats.low.toLocaleString("tr-TR", {
        maximumFractionDigits: 2,
      })}, güncel ${stats.current.toLocaleString("tr-TR", {
        maximumFractionDigits: 2,
      })}. Zirveden uzaklık ${pct(stats.drawdownFromHigh)}. ${holdNote} Bu bir alım tavsiyesi değil; göreli ucuzluk bağlamıdır.`,
    };
  }

  if (stats.rangePosition != null && stats.rangePosition >= 0.85) {
    return {
      signal: "NEAR_2Y_HIGH",
      severity: "WARNING",
      title: `${symbol}: ${years} yıllık banda göre yüksek bölge`,
      message: `${name} son ${years} yıldaki bandın üst %${(
        (1 - stats.rangePosition) * 100
      ).toFixed(0)} dilimine yakın. 2y zirve ${stats.high.toLocaleString(
        "tr-TR",
        { maximumFractionDigits: 2 }
      )}, güncel ${stats.current.toLocaleString("tr-TR", {
        maximumFractionDigits: 2,
      })}. 3A getiri ${pct(stats.return3m)}, 1Y ${pct(stats.return1y)}. ${holdNote} Yüksek bölgede ekleme/çıkarma kararları daha dikkat ister.`,
    };
  }

  return {
    signal: "MID_RANGE",
    severity: "INFO",
    title: `${symbol}: orta bant`,
    message: `${name} son ${years} yıllık bandın yaklaşık %${(
      (stats.rangePosition ?? 0.5) * 100
    ).toFixed(0)} seviyesinde. 3A ${pct(stats.return3m)}, 1Y ${pct(
      stats.return1y
    )}. ${holdNote}`,
  };
}

/**
 * Portföy + izleme listesi varlıkları için 2y fiyat bandı analizi.
 */
export async function analyzeMarketOpportunities(options: {
  portfolioId: string;
  years?: number;
}): Promise<MarketOpportunityAnalysis> {
  const years = options.years ?? 2;
  const asOf = startOfDay(new Date());
  const since = subYears(asOf, years);

  const positions = await getPortfolioPositions(options.portfolioId, asOf);
  const heldIds = new Set(positions.byAsset.map((p) => p.assetId));
  const weightByAsset = new Map<string, number | null>();

  // Latest snapshot weights if available
  const latestSnap = await prisma.positionDailySnapshot.findFirst({
    where: { portfolioId: options.portfolioId, accountId: "" },
    orderBy: { snapshotDate: "desc" },
    select: { snapshotDate: true },
  });
  if (latestSnap) {
    const weights = await prisma.positionDailySnapshot.findMany({
      where: {
        portfolioId: options.portfolioId,
        snapshotDate: latestSnap.snapshotDate,
        accountId: "",
      },
      select: { assetId: true, portfolioWeight: true },
    });
    for (const w of weights) {
      weightByAsset.set(
        w.assetId,
        w.portfolioWeight ? Number(w.portfolioWeight.toString()) : null
      );
    }
  }

  const watchSymbols = ["GRAMALTIN", "USDTRY", "THYAO", "TUPRS"];
  const assets = await prisma.asset.findMany({
    where: {
      isActive: true,
      OR: [
        { id: { in: [...heldIds] } },
        { symbol: { in: watchSymbols } },
      ],
    },
  });

  const opportunities: AssetOpportunity[] = [];

  for (const asset of assets) {
    const prices = await prisma.assetPrice.findMany({
      where: { assetId: asset.id, priceDate: { gte: since, lte: asOf } },
      orderBy: { priceDate: "asc" },
      select: { close: true, priceDate: true },
    });

    // Aynı güne birden fazla kaynak olabilir — gün başına son close
    const byDay = new Map<string, number>();
    for (const p of prices) {
      const key = p.priceDate.toISOString().slice(0, 10);
      byDay.set(key, Number(p.close.toString()));
    }
    const closes = [...byDay.values()];
    const stats = extendStats(closes);

    if (!stats) {
      opportunities.push({
        assetId: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        inPortfolio: heldIds.has(asset.id),
        portfolioWeight: weightByAsset.get(asset.id) ?? null,
        currentPrice: closes.at(-1) ?? 0,
        low2y: 0,
        high2y: 0,
        rangePosition: null,
        drawdownFromHigh: null,
        upsideToHigh: null,
        return1y: null,
        return3m: null,
        observationCount: closes.length,
        signal: "INSUFFICIENT_DATA",
        title: `${asset.symbol}: yetersiz geçmiş`,
        message: `${asset.name} için son ${years} yılda yeterli fiyat serisi yok (${closes.length} gün). Fiyatları Güncelle ile geçmiş çekilebilir.`,
        severity: "INFO",
      });
      continue;
    }

    const narrative = buildNarrative({
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
      inPortfolio: heldIds.has(asset.id),
      stats,
      years,
    });

    opportunities.push({
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
      inPortfolio: heldIds.has(asset.id),
      portfolioWeight: weightByAsset.get(asset.id) ?? null,
      currentPrice: stats.current,
      low2y: stats.low,
      high2y: stats.high,
      rangePosition: stats.rangePosition,
      drawdownFromHigh: stats.drawdownFromHigh,
      upsideToHigh: stats.upsideToHigh,
      return1y: stats.return1y,
      return3m: stats.return3m,
      observationCount: closes.length,
      ...narrative,
    });
  }

  // Öncelik: dip sinyali, sonra zirve, sonra portföydekiler
  const rank = (o: AssetOpportunity) => {
    let s = 0;
    if (o.signal === "NEAR_2Y_LOW") s += 100;
    if (o.signal === "NEAR_2Y_HIGH") s += 80;
    if (o.inPortfolio) s += 20;
    if (o.rangePosition != null) s += (1 - o.rangePosition) * 10;
    return s;
  };
  opportunities.sort((a, b) => rank(b) - rank(a));

  return {
    asOf: asOf.toISOString().slice(0, 10),
    years,
    opportunities,
    portfolioHighlights: opportunities.filter((o) => o.inPortfolio),
    watchlistHighlights: opportunities.filter((o) => !o.inPortfolio),
    disclaimer:
      "Yatırım tavsiyesi değildir. Geçmiş fiyat bandı gelecek performansı göstermez; yalnızca göreli konum bilgisidir.",
  };
}

/** Insight motoru için sadeleştirilmiş seri bağlamı. */
export async function loadAssetPriceSeriesForInsights(
  assetIds: string[],
  years = 2
): Promise<
  Array<{
    assetId: string;
    symbol: string;
    name: string;
    assetType: string;
    closes: number[];
  }>
> {
  if (assetIds.length === 0) return [];
  const since = subYears(new Date(), years);
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, symbol: true, name: true, assetType: true },
  });
  const result = [];
  for (const asset of assets) {
    const prices = await prisma.assetPrice.findMany({
      where: { assetId: asset.id, priceDate: { gte: since } },
      orderBy: { priceDate: "asc" },
      select: { close: true, priceDate: true },
    });
    const byDay = new Map<string, number>();
    for (const p of prices) {
      byDay.set(p.priceDate.toISOString().slice(0, 10), Number(p.close.toString()));
    }
    result.push({
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
      closes: [...byDay.values()],
    });
  }
  return result;
}
