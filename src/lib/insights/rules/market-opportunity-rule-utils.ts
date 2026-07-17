/** Insight kuralı ile market-opportunity servisi arasında paylaşılan yardımcılar. */

export interface AssetPriceSeries {
  assetId: string;
  symbol: string;
  name: string;
  assetType: string;
  closes: number[];
}

export function computeSeriesStats(closes: number[]): {
  current: number;
  low: number;
  high: number;
  rangePosition: number | null;
  drawdownFromHigh: number | null;
} | null {
  if (closes.length < 20) return null;
  const current = closes[closes.length - 1];
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const span = high - low;
  const rangePosition = span > 0 ? (current - low) / span : 0.5;
  const drawdownFromHigh = high > 0 ? (current - high) / high : null;
  return { current, low, high, rangePosition, drawdownFromHigh };
}
