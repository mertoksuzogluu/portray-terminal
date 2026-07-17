/** Volatilite + dinamik bakış penceresi yardımcıları. */

export interface AssetPriceSeries {
  assetId: string;
  symbol: string;
  name: string;
  assetType: string;
  closes: number[];
}

export interface SeriesWindowStats {
  current: number;
  low: number;
  high: number;
  /** 0 = pencere dibi, 1 = pencere zirvesi */
  rangePosition: number | null;
  drawdownFromHigh: number | null;
  /** Yıllıklandırılmış gerçekleşmiş volatilite (0–1+) */
  realizedVol: number | null;
  /** Analizde kullanılan işlem günü sayısı */
  lookbackDays: number;
  /** İnsan okunur dönem: "3 ay", "6 ay" ... */
  lookbackLabel: string;
  /** Volatilite sınıfı */
  volBucket: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
}

/** Son ~3 aylık getirilerden yıllıklandırılmış vol. */
export function realizedVolAnnual(closes: number[]): number | null {
  if (closes.length < 25) return null;
  const slice = closes.slice(Math.max(0, closes.length - 63));
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1];
    const cur = slice[i];
    if (prev > 0 && cur > 0) rets.push(Math.log(cur / prev));
  }
  if (rets.length < 15) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  let ss = 0;
  for (const r of rets) ss += (r - mean) ** 2;
  const daily = Math.sqrt(ss / (rets.length - 1));
  return daily * Math.sqrt(252);
}

export function lookbackTradingDays(
  vol: number | null,
  assetType: string
): number {
  const isMacro = assetType === "GOLD" || assetType === "FX";

  if (isMacro) {
    if (vol == null) return 126; // ~6 ay
    if (vol >= 0.28) return 84; // ~4 ay
    if (vol >= 0.18) return 126; // ~6 ay
    return 189; // ~9 ay
  }

  // Hisse / fon: yüksek vol → kısa pencere (2y’de hep zirve yanılsamasını kırar)
  if (vol == null) return 126;
  if (vol >= 0.55) return 42; // ~2 ay
  if (vol >= 0.4) return 63; // ~3 ay
  if (vol >= 0.3) return 84; // ~4 ay
  if (vol >= 0.22) return 126; // ~6 ay
  if (vol >= 0.15) return 189; // ~9 ay
  return 252; // ~12 ay
}

export function lookbackLabelFromDays(days: number): string {
  if (days <= 50) return "2 ay";
  if (days <= 75) return "3 ay";
  if (days <= 100) return "4 ay";
  if (days <= 150) return "6 ay";
  if (days <= 220) return "9 ay";
  return "12 ay";
}

export function volBucketFromVol(
  vol: number | null
): SeriesWindowStats["volBucket"] {
  if (vol == null) return "UNKNOWN";
  if (vol >= 0.35) return "HIGH";
  if (vol >= 0.2) return "MEDIUM";
  return "LOW";
}

/**
 * Volatiliteye göre pencere keser ve banda göre istatistik üretir.
 * fullCloses en uzun seri olmalı (vol tahmini için).
 */
export function computeAdaptiveSeriesStats(
  fullCloses: number[],
  assetType: string
): SeriesWindowStats | null {
  if (fullCloses.length < 20) return null;

  const realizedVol = realizedVolAnnual(fullCloses);
  const lookbackDays = lookbackTradingDays(realizedVol, assetType);
  const closes = fullCloses.slice(-Math.min(lookbackDays, fullCloses.length));
  if (closes.length < 15) return null;

  const current = closes[closes.length - 1];
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const span = high - low;
  const rangePosition = span > 0 ? (current - low) / span : 0.5;
  const drawdownFromHigh = high > 0 ? (current - high) / high : null;

  return {
    current,
    low,
    high,
    rangePosition,
    drawdownFromHigh,
    realizedVol,
    lookbackDays: closes.length,
    lookbackLabel: lookbackLabelFromDays(lookbackDays),
    volBucket: volBucketFromVol(realizedVol),
  };
}

/** Geriye uyumluluk — sabit seri üzerinde basit bant. */
export function computeSeriesStats(closes: number[]): {
  current: number;
  low: number;
  high: number;
  rangePosition: number | null;
  drawdownFromHigh: number | null;
} | null {
  const adaptive = computeAdaptiveSeriesStats(closes, "STOCK");
  if (!adaptive) return null;
  return {
    current: adaptive.current,
    low: adaptive.low,
    high: adaptive.high,
    rangePosition: adaptive.rangePosition,
    drawdownFromHigh: adaptive.drawdownFromHigh,
  };
}

/**
 * Dip/zirve kararı: kısa pencerede bant + vol’a göre anlamlı pullback.
 */
export function classifyBandSignal(stats: SeriesWindowStats): {
  signal: "NEAR_LOW" | "NEAR_HIGH" | "MID_RANGE";
  reason: string;
} {
  const rp = stats.rangePosition ?? 0.5;
  const dd = stats.drawdownFromHigh ?? 0;
  const vol = stats.realizedVol ?? 0.3;
  // Haftalık vol yaklaşık; 1.8 haftalık vol kadar geri çekilme “anlamlı pullback”
  const weeklyVol = vol / Math.sqrt(52);
  const meaningfulPullback = dd <= -1.8 * weeklyVol;

  if (rp <= 0.18 || (meaningfulPullback && rp <= 0.45)) {
    return {
      signal: "NEAR_LOW",
      reason: meaningfulPullback && rp > 0.18 ? "vol-pullback" : "range-low",
    };
  }
  if (rp >= 0.85 && !meaningfulPullback) {
    return { signal: "NEAR_HIGH", reason: "range-high" };
  }
  return { signal: "MID_RANGE", reason: "mid" };
}
