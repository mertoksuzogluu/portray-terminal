import { subYears } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { getPortfolioPositions } from "@/lib/services/position-engine";
import { startOfDay } from "@/lib/utils/dates";
import {
  classifyBandSignal,
  computeAdaptiveSeriesStats,
} from "@/lib/insights/rules/market-opportunity-rule-utils";
import {
  pickWeeklyWatchSymbols,
  type WatchUniverseItem,
} from "@/lib/data/market-watch-universe";

export type OpportunitySignal =
  | "NEAR_LOW"
  | "NEAR_HIGH"
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
  /** 0 = pencere dibi, 1 = pencere zirvesi */
  rangePosition: number | null;
  drawdownFromHigh: number | null;
  upsideToHigh: number | null;
  return1y: number | null;
  return3m: number | null;
  observationCount: number;
  lookbackDays: number;
  lookbackLabel: string;
  realizedVol: number | null;
  volBucket: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  signal: OpportunitySignal;
  title: string;
  message: string;
  severity: "INFO" | "POSITIVE" | "WARNING";
}

export interface MarketOpportunityAnalysis {
  asOf: string;
  /** Geriye uyumluluk — artık sabit yıl yok; medyan pencere. */
  years: number;
  weekKey: string;
  weekLabel: string;
  opportunities: AssetOpportunity[];
  portfolioHighlights: AssetOpportunity[];
  watchlistHighlights: AssetOpportunity[];
  methodology: string;
  disclaimer: string;
}

function extendStats(
  fullCloses: number[],
  assetType: string
): (NonNullable<ReturnType<typeof computeAdaptiveSeriesStats>> & {
  return1y: number | null;
  return3m: number | null;
  upsideToHigh: number | null;
}) | null {
  const base = computeAdaptiveSeriesStats(fullCloses, assetType);
  if (!base) return null;
  const current = base.current;
  const approx1y = Math.min(fullCloses.length - 1, 252);
  const approx3m = Math.min(fullCloses.length - 1, 63);
  const return1y =
    approx1y > 20 && fullCloses[fullCloses.length - 1 - approx1y] > 0
      ? current / fullCloses[fullCloses.length - 1 - approx1y] - 1
      : null;
  const return3m =
    approx3m > 10 && fullCloses[fullCloses.length - 1 - approx3m] > 0
      ? current / fullCloses[fullCloses.length - 1 - approx3m] - 1
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
  signal: Exclude<OpportunitySignal, "INSUFFICIENT_DATA">;
  reason: string;
}): Pick<AssetOpportunity, "signal" | "title" | "message" | "severity"> {
  const { symbol, name, assetType, inPortfolio, stats, signal, reason } = input;
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

  const volTxt =
    stats.realizedVol == null
      ? "vol bilinmiyor"
      : `yıllık vol ~%${(stats.realizedVol * 100).toFixed(0)} (${stats.volBucket.toLowerCase()})`;

  const windowNote = `Bakış penceresi volatiliteye göre ${stats.lookbackLabel} seçildi (${volTxt}).`;

  if (signal === "NEAR_LOW") {
    const pullNote =
      reason === "vol-pullback"
        ? " Zirveden volatiliteye göre anlamlı geri çekilme var."
        : "";
    return {
      signal: "NEAR_LOW",
      severity: "POSITIVE",
      title: `${symbol}: ${stats.lookbackLabel} banda göre düşük bölge`,
      message: `${name} (${typeLabel}) ${stats.lookbackLabel} fiyat bandının alt %${(
        (stats.rangePosition ?? 0) * 100
      ).toFixed(0)} diliminde. Dip ${stats.low.toLocaleString("tr-TR", {
        maximumFractionDigits: 2,
      })}, güncel ${stats.current.toLocaleString("tr-TR", {
        maximumFractionDigits: 2,
      })}. Zirveden ${pct(stats.drawdownFromHigh)}.${pullNote} ${windowNote} ${holdNote} Bu bir alım tavsiyesi değil.`,
    };
  }

  if (signal === "NEAR_HIGH") {
    return {
      signal: "NEAR_HIGH",
      severity: "WARNING",
      title: `${symbol}: ${stats.lookbackLabel} banda göre yüksek bölge`,
      message: `${name} ${stats.lookbackLabel} bandın üst bölgesinde. Zirve ${stats.high.toLocaleString(
        "tr-TR",
        { maximumFractionDigits: 2 }
      )}, güncel ${stats.current.toLocaleString("tr-TR", {
        maximumFractionDigits: 2,
      })}. 3A ${pct(stats.return3m)}, 1Y ${pct(stats.return1y)}. ${windowNote} ${holdNote}`,
    };
  }

  return {
    signal: "MID_RANGE",
    severity: "INFO",
    title: `${symbol}: ${stats.lookbackLabel} orta bant`,
    message: `${name} ${stats.lookbackLabel} bandın ~%${(
      (stats.rangePosition ?? 0.5) * 100
    ).toFixed(0)} seviyesinde. 3A ${pct(stats.return3m)}, 1Y ${pct(
      stats.return1y
    )}. ${windowNote} ${holdNote}`,
  };
}

/** Havuzdaki sembolleri DB’de varlık olarak garanti eder. */
export async function ensureWatchAssets(
  items: WatchUniverseItem[]
): Promise<Map<string, string>> {
  const symbolToId = new Map<string, string>();
  for (const item of items) {
    const existing = await prisma.asset.findFirst({
      where: { symbol: item.symbol, assetType: item.assetType },
      select: { id: true },
    });
    if (existing) {
      await prisma.asset.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          providerSymbol: item.providerSymbol,
          provider: "twelve_data",
          name: item.name,
          exchange: item.assetType === "STOCK" ? "BIST" : null,
        },
      });
      symbolToId.set(item.symbol, existing.id);
      continue;
    }
    const created = await prisma.asset.create({
      data: {
        symbol: item.symbol,
        name: item.name,
        assetType: item.assetType,
        currency: "TRY",
        providerSymbol: item.providerSymbol,
        provider: "twelve_data",
        exchange: item.assetType === "STOCK" ? "BIST" : null,
        isActive: true,
      },
      select: { id: true },
    });
    symbolToId.set(item.symbol, created.id);
  }
  return symbolToId;
}

/**
 * Portföy + haftalık izleme listesi için volatilite-ayarlı bant analizi.
 */
export async function analyzeMarketOpportunities(options: {
  portfolioId: string;
  stockCount?: number;
}): Promise<MarketOpportunityAnalysis> {
  const asOf = startOfDay(new Date());
  // Vol tahmini için en fazla 1y veri yeter; 2y sabiti kaldırıldı.
  const since = subYears(asOf, 1);
  const weekly = pickWeeklyWatchSymbols({
    asOf,
    stockCount: options.stockCount ?? 6,
  });
  await ensureWatchAssets(weekly.all);

  const positions = await getPortfolioPositions(options.portfolioId, asOf);
  const heldIds = new Set(positions.byAsset.map((p) => p.assetId));
  const weightByAsset = new Map<string, number | null>();

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

  const watchSymbols = weekly.all.map((w) => w.symbol);
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

    const byDay = new Map<string, number>();
    for (const p of prices) {
      const key = p.priceDate.toISOString().slice(0, 10);
      byDay.set(key, Number(p.close.toString()));
    }
    const closes = [...byDay.values()];
    const stats = extendStats(closes, asset.assetType);

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
        lookbackDays: 0,
        lookbackLabel: "—",
        realizedVol: null,
        volBucket: "UNKNOWN",
        signal: "INSUFFICIENT_DATA",
        title: `${asset.symbol}: yetersiz geçmiş`,
        message: `${asset.name} için volatilite penceresi hesaplanacak kadar fiyat yok (${closes.length} gün). Geçmişi doldur & yenile deneyin.`,
        severity: "INFO",
      });
      continue;
    }

    const { signal, reason } = classifyBandSignal(stats);
    const narrative = buildNarrative({
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
      inPortfolio: heldIds.has(asset.id),
      stats,
      signal,
      reason,
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
      lookbackDays: stats.lookbackDays,
      lookbackLabel: stats.lookbackLabel,
      realizedVol: stats.realizedVol,
      volBucket: stats.volBucket,
      ...narrative,
    });
  }

  const rank = (o: AssetOpportunity) => {
    let s = 0;
    if (o.signal === "NEAR_LOW") s += 100;
    if (o.signal === "NEAR_HIGH") s += 80;
    if (o.inPortfolio) s += 20;
    if (o.rangePosition != null) s += (1 - o.rangePosition) * 10;
    return s;
  };
  opportunities.sort((a, b) => rank(b) - rank(a));

  const lookbacks = opportunities
    .map((o) => o.lookbackDays)
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  const medianDays =
    lookbacks.length > 0 ? lookbacks[Math.floor(lookbacks.length / 2)] : 126;

  return {
    asOf: asOf.toISOString().slice(0, 10),
    years: medianDays / 252,
    weekKey: weekly.weekKey,
    weekLabel: `Hafta ${weekly.weekKey}`,
    opportunities,
    portfolioHighlights: opportunities.filter((o) => o.inPortfolio),
    watchlistHighlights: opportunities.filter((o) => !o.inPortfolio),
    methodology:
      "Bakış süresi varlık volatilitesine göre otomatik seçilir (yüksek vol → 2–4 ay, düşük vol → 9–12 ay). İzleme hisseleri her ISO haftası döner; altın/döviz sabit çapa kalır.",
    disclaimer:
      "Yatırım tavsiyesi değildir. Bant konumu gelecek performansı göstermez; yalnızca göreli bağlamdır.",
  };
}

/** Insight motoru: portföy varlıkları için vol-ayarlı pencere serisi. */
export async function loadAssetPriceSeriesForInsights(
  assetIds: string[],
  years = 1
): Promise<
  Array<{
    assetId: string;
    symbol: string;
    name: string;
    assetType: string;
    closes: number[];
    lookbackLabel?: string;
    realizedVol?: number | null;
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
      byDay.set(
        p.priceDate.toISOString().slice(0, 10),
        Number(p.close.toString())
      );
    }
    const full = [...byDay.values()];
    const stats = computeAdaptiveSeriesStats(full, asset.assetType);
    const closes = stats
      ? full.slice(-Math.min(stats.lookbackDays, full.length))
      : full;
    result.push({
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
      closes,
      lookbackLabel: stats?.lookbackLabel,
      realizedVol: stats?.realizedVol ?? null,
    });
  }
  return result;
}
