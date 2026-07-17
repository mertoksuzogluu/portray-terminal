import { appendDisclaimer, monthKey } from "./helpers";
import type { InsightRule } from "../types";
import { computeSeriesStats } from "./market-opportunity-rule-utils";

/**
 * Portföydeki varlıkların 2y fiyat bandına göre dip/zirve bağlamı.
 * Alım-satım tavsiyesi vermez; göreli konum bilgisi üretir.
 */
export const marketOpportunityRule: InsightRule = {
  ruleId: "market-opportunity",
  evaluate(context) {
    const series = context.assetPriceSeries;
    if (!series?.length) return [];

    const insights = [];
    const mk = monthKey(context.asOf);

    for (const asset of series) {
      const stats = computeSeriesStats(asset.closes);
      if (!stats || stats.rangePosition == null) continue;

      if (stats.rangePosition <= 0.15) {
        insights.push({
          category: "TREND" as const,
          severity: "POSITIVE" as const,
          periodType: "MONTHLY" as const,
          fingerprint: `market-opportunity:${asset.symbol}:low:${mk}`,
          title: `${asset.symbol}: 2 yıllık banda göre düşük bölge`,
          message: appendDisclaimer(
            `${asset.name} son 2 yıldaki fiyat bandının alt %${(
              stats.rangePosition * 100
            ).toFixed(0)} diliminde (güncel ${stats.current.toLocaleString(
              "tr-TR",
              { maximumFractionDigits: 2 }
            )}, 2y dip ${stats.low.toLocaleString("tr-TR", {
              maximumFractionDigits: 2,
            })}). Portföy ağırlığınız bağlamında göreli ucuzluk sinyali olabilir; bu bir alım tavsiyesi değildir.`
          ),
          metadata: {
            symbol: asset.symbol,
            signal: "NEAR_2Y_LOW",
            rangePosition: stats.rangePosition,
            drawdownFromHigh: stats.drawdownFromHigh,
          },
        });
      } else if (stats.rangePosition >= 0.85) {
        insights.push({
          category: "TREND" as const,
          severity: "WARNING" as const,
          periodType: "MONTHLY" as const,
          fingerprint: `market-opportunity:${asset.symbol}:high:${mk}`,
          title: `${asset.symbol}: 2 yıllık banda göre yüksek bölge`,
          message: appendDisclaimer(
            `${asset.name} son 2 yıldaki bandın üst bölgesinde (güncel ${stats.current.toLocaleString(
              "tr-TR",
              { maximumFractionDigits: 2 }
            )}, 2y zirve ${stats.high.toLocaleString("tr-TR", {
              maximumFractionDigits: 2,
            })}). Konsantrasyon ve kar realizasyonu açısından izlenebilir; bu bir satış tavsiyesi değildir.`
          ),
          metadata: {
            symbol: asset.symbol,
            signal: "NEAR_2Y_HIGH",
            rangePosition: stats.rangePosition,
            drawdownFromHigh: stats.drawdownFromHigh,
          },
        });
      }
    }

    return insights.slice(0, 6);
  },
};
