import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { getFundProvider } from "@/lib/providers";
import { endOfMonth, periodRanges, startOfMonth, subMonths } from "@/lib/utils/dates";
import { prisma } from "@/lib/db/prisma";

export interface MonthlyFundLeader {
  rank: number;
  code: string;
  name: string;
  /** Seçilen takvim ayı getirisi (%). */
  returnPct: number;
  /** Son 1 ay rolling getiri (%). */
  return1m: number | null;
  /** Son 3 ay rolling getiri (%). */
  return3m: number | null;
  /** Son 6 ay rolling getiri (%). */
  return6m: number | null;
  /** Yıl başından beri getiri (%). */
  returnYtd: number | null;
  /** Son 1 yıl getiri (%). */
  return1y: number | null;
  riskLevel: number | null;
  category: string | null;
  founder: string | null;
  inPortfolio: boolean;
}

export interface MonthlyFundAnalysis {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  fundType: "YAT" | "EMK" | "BYF";
  fundCount: number;
  top: MonthlyFundLeader[];
  stats: {
    topAvgReturn: number;
    marketMedianReturn: number;
    marketAvgReturn: number;
    bestReturn: number;
    worstInTopReturn: number;
  };
  categoryBreakdown: { category: string; count: number; avgReturn: number }[];
  insights: { title: string; message: string; severity: "INFO" | "POSITIVE" | "WARNING" }[];
  portfolioOverlap: { code: string; name: string; returnPct: number }[];
  fetchedAt: string;
  source: string;
  disclaimer: string;
}

interface CacheEntry {
  expiresAt: number;
  data: MonthlyFundAnalysis;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 saat

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function buildInsights(
  periodLabel: string,
  top: MonthlyFundLeader[],
  marketMedian: number,
  categories: { category: string; count: number; avgReturn: number }[],
  portfolioOverlap: { code: string; name: string; returnPct: number }[]
): MonthlyFundAnalysis["insights"] {
  const insights: MonthlyFundAnalysis["insights"] = [];
  if (top.length === 0) {
    insights.push({
      title: "Veri yok",
      message: `${periodLabel} için TEFAS dönemsel getiri listesi boş döndü.`,
      severity: "WARNING",
    });
    return insights;
  }

  const leader = top[0];
  const topAvg = mean(top.map((t) => t.returnPct));
  const spread = leader.returnPct - top[top.length - 1].returnPct;
  const with3m = top.filter((t) => t.return3m != null);
  const avg3m = with3m.length ? mean(with3m.map((t) => t.return3m!)) : null;

  insights.push({
    title: "Ayın lideri",
    message: `${periodLabel} döneminde en yüksek getiri ${leader.code} (${leader.name}) ile %${leader.returnPct.toFixed(2)} oldu. Piyasa medyanı %${marketMedian.toFixed(2)}.`,
    severity: "POSITIVE",
  });

  insights.push({
    title: "İlk 10 özeti",
    message: `İlk 10 fonun ortalama getirisi %${topAvg.toFixed(2)}. Lider ile 10. sıradaki fark ${spread.toFixed(2)} puan — ${spread > 15 ? "üst uç ayrışması yüksek" : "üst grup görece sıkışık"}.`,
    severity: "INFO",
  });

  if (avg3m != null && with3m.length > 0) {
    const best3m = [...with3m].sort((a, b) => (b.return3m ?? 0) - (a.return3m ?? 0))[0];
    insights.push({
      title: "Son 3 ay",
      message: `Listedeki fonların son 3 ay ortalama getirisi %${avg3m.toFixed(2)}. 3 ayda en güçlüsü ${best3m.code} (%${(best3m.return3m ?? 0).toFixed(2)}). Ay sıralaması ile 3 aylık sıralama farklı olabilir.`,
      severity: "INFO",
    });
  }

  if (categories.length > 0) {
    const dominant = categories[0];
    insights.push({
      title: "Kategori yoğunluğu",
      message: `İlk 10'da en sık görülen kategori: ${dominant.category} (${dominant.count} fon, ort. %${dominant.avgReturn.toFixed(2)}). ${
        dominant.count >= 5
          ? "Liste tek temaya yoğunlaşmış; çeşitlilik sınırlı."
          : "Üst sıralarda birden fazla tema var."
      }`,
      severity: dominant.count >= 6 ? "WARNING" : "INFO",
    });
  }

  const highRisk = top.filter((t) => (t.riskLevel ?? 0) >= 5).length;
  if (highRisk >= 5) {
    insights.push({
      title: "Risk notu",
      message: `İlk 10'un ${highRisk} tanesinde risk değeri ≥5. Yüksek getiri yüksek oynaklıkla birlikte gelmiş olabilir.`,
      severity: "WARNING",
    });
  }

  if (portfolioOverlap.length > 0) {
    insights.push({
      title: "Portföyünüzdeki örtüşme",
      message: `Portföyünüzde listedeki ${portfolioOverlap.length} fon var: ${portfolioOverlap
        .map((p) => `${p.code} (%${p.returnPct.toFixed(1)})`)
        .join(", ")}.`,
      severity: "POSITIVE",
    });
  } else {
    insights.push({
      title: "Portföy karşılaştırması",
      message: `Bu ayın ilk 10 fonundan hiçbiri portföyünüzde yok. Bu bir tavsiye değil; yalnızca bilgilendirme.`,
      severity: "INFO",
    });
  }

  return insights;
}

/**
 * Bir önceki takvim ayının (veya istenen ayın) en iyi performans gösteren
 * TEFAS yatırım fonlarını getirir ve kural tabanlı Türkçe analiz üretir.
 */
export async function getMonthlyFundLeaders(options?: {
  portfolioId?: string;
  fundType?: "YAT" | "EMK" | "BYF";
  /** YYYY-MM, örn. 2026-06. Yoksa bir önceki takvim ayı. */
  yearMonth?: string;
  topN?: number;
  forceRefresh?: boolean;
}): Promise<MonthlyFundAnalysis> {
  const fundType = options?.fundType ?? "YAT";
  const topN = options?.topN ?? 10;

  let start: Date;
  let end: Date;
  if (options?.yearMonth && /^\d{4}-\d{2}$/.test(options.yearMonth)) {
    const [y, m] = options.yearMonth.split("-").map(Number);
    start = startOfMonth(new Date(y, m - 1, 1));
    end = endOfMonth(start);
  } else {
    const last = periodRanges().lastMonth;
    start = last.start;
    end = last.end;
  }

  const periodLabel = format(start, "LLLL yyyy", { locale: tr });
  const cacheKey = `v2:${fundType}:${format(start, "yyyy-MM")}:${topN}`;

  if (!options?.forceRefresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      // Portföy örtüşmesini taze tut
      if (options?.portfolioId) {
        return withPortfolioOverlap(hit.data, options.portfolioId);
      }
      return hit.data;
    }
  }

  const provider = getFundProvider();
  if (!provider.getPeriodReturns) {
    throw new Error("Fon dönemsel getiri sağlayıcısı yapılandırılmamış.");
  }

  // Takvim ayı sıralaması + standart dönemler (1a/3a/6a/…) paralel
  const [rows, rollingRows] = await Promise.all([
    provider.getPeriodReturns(fundType, start, end),
    provider.getPeriodReturns(fundType).catch(() => []),
  ]);
  if (rows.length === 0) {
    throw new Error(
      `TEFAS ${periodLabel} için getiri verisi döndürmedi. Bir süre sonra tekrar deneyin.`
    );
  }

  const rollingByCode = new Map(
    rollingRows.map((r) => [r.code, r] as const)
  );

  const returns = rows.map((r) => r.periodReturnPct);
  const marketMedianReturn = median(returns);
  const marketAvgReturn = mean(returns);

  const sorted = [...rows].sort(
    (a, b) => b.periodReturnPct - a.periodReturnPct
  );
  const topRows = sorted.slice(0, topN);

  const top: MonthlyFundLeader[] = topRows.map((r, i) => {
    const roll = rollingByCode.get(r.code);
    return {
      rank: i + 1,
      code: r.code,
      name: r.name,
      returnPct: r.periodReturnPct,
      return1m: roll?.return1m ?? null,
      return3m: roll?.return3m ?? null,
      return6m: roll?.return6m ?? null,
      returnYtd: roll?.returnYtd ?? null,
      return1y: roll?.return1y ?? null,
      riskLevel: r.riskLevel ?? roll?.riskLevel ?? null,
      category: r.category ?? roll?.category ?? null,
      founder: r.founder ?? roll?.founder ?? null,
      inPortfolio: false,
    };
  });

  const categoryMap = new Map<string, number[]>();
  for (const t of top) {
    const key = t.category?.trim() || "Belirtilmemiş";
    const list = categoryMap.get(key) ?? [];
    list.push(t.returnPct);
    categoryMap.set(key, list);
  }
  const categoryBreakdown = [...categoryMap.entries()]
    .map(([category, vals]) => ({
      category,
      count: vals.length,
      avgReturn: mean(vals),
    }))
    .sort((a, b) => b.count - a.count || b.avgReturn - a.avgReturn);

  let analysis: MonthlyFundAnalysis = {
    periodLabel,
    periodStart: format(start, "yyyy-MM-dd"),
    periodEnd: format(end, "yyyy-MM-dd"),
    fundType,
    fundCount: rows.length,
    top,
    stats: {
      topAvgReturn: mean(top.map((t) => t.returnPct)),
      marketMedianReturn,
      marketAvgReturn,
      bestReturn: top[0]?.returnPct ?? 0,
      worstInTopReturn: top[top.length - 1]?.returnPct ?? 0,
    },
    categoryBreakdown,
    insights: [],
    portfolioOverlap: [],
    fetchedAt: new Date().toISOString(),
    source: "tefas",
    disclaimer:
      "Yatırım tavsiyesi değildir. Geçmiş getiri gelecek performansı göstermez. Veri kaynağı TEFAS.",
  };

  if (options?.portfolioId) {
    analysis = await withPortfolioOverlap(analysis, options.portfolioId);
  } else {
    analysis.insights = buildInsights(
      periodLabel,
      analysis.top,
      marketMedianReturn,
      categoryBreakdown,
      []
    );
  }

  cache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data: analysis,
  });

  return analysis;
}

async function withPortfolioOverlap(
  analysis: MonthlyFundAnalysis,
  portfolioId: string
): Promise<MonthlyFundAnalysis> {
  const assets = await prisma.asset.findMany({
    where: {
      assetType: "MUTUAL_FUND",
      transactions: { some: { portfolioId } },
    },
    select: { symbol: true, tefasCode: true, name: true },
  });

  const heldCodes = new Set(
    assets
      .map((a) => (a.tefasCode ?? a.symbol ?? "").toUpperCase())
      .filter(Boolean)
  );

  const top = analysis.top.map((t) => ({
    ...t,
    inPortfolio: heldCodes.has(t.code),
  }));

  const portfolioOverlap = top
    .filter((t) => t.inPortfolio)
    .map((t) => ({
      code: t.code,
      name: t.name,
      returnPct: t.returnPct,
    }));

  return {
    ...analysis,
    top,
    portfolioOverlap,
    insights: buildInsights(
      analysis.periodLabel,
      top,
      analysis.stats.marketMedianReturn,
      analysis.categoryBreakdown,
      portfolioOverlap
    ),
  };
}

/** Önceki ay etiketini UI için. */
export function previousMonthLabel(asOf = new Date()): string {
  return format(subMonths(asOf, 1), "LLLL yyyy", { locale: tr });
}
