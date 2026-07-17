import { appendDisclaimer, monthKey } from "./helpers";
import type { InsightRule } from "../types";
import {
  classifyBandSignal,
  computeAdaptiveSeriesStats,
} from "./market-opportunity-rule-utils";

/**
 * Portföy varlıklarında volatiliteye göre seçilen pencerede dip/zirve bağlamı.
 */
export const marketOpportunityRule: InsightRule = {
  ruleId: "market-opportunity",
  evaluate(context) {
    const series = context.assetPriceSeries;
    if (!series?.length) return [];

    const insights = [];
    const mk = monthKey(context.asOf);

    for (const asset of series) {
      const stats = computeAdaptiveSeriesStats(
        asset.closes,
        asset.assetType
      );
      if (!stats || stats.rangePosition == null) continue;

      const { signal } = classifyBandSignal(stats);
      if (signal === "NEAR_LOW") {
        insights.push({
          category: "TREND" as const,
          severity: "POSITIVE" as const,
          periodType: "MONTHLY" as const,
          fingerprint: `market-opportunity:${asset.symbol}:low:${mk}:${stats.lookbackLabel}`,
          title: `${asset.symbol}: ${stats.lookbackLabel} banda göre düşük bölge`,
          message: appendDisclaimer(
            `${asset.name} volatiliteye göre seçilen ${stats.lookbackLabel} penceresinde bandın alt %${(
              stats.rangePosition * 100
            ).toFixed(0)} diliminde (güncel ${stats.current.toLocaleString(
              "tr-TR",
              { maximumFractionDigits: 2 }
            )}, dip ${stats.low.toLocaleString("tr-TR", {
              maximumFractionDigits: 2,
            })}). Bu bir alım tavsiyesi değildir.`
          ),
          metadata: {
            symbol: asset.symbol,
            signal: "NEAR_LOW",
            rangePosition: stats.rangePosition,
            lookbackLabel: stats.lookbackLabel,
            realizedVol: stats.realizedVol,
          },
        });
      } else if (signal === "NEAR_HIGH") {
        insights.push({
          category: "TREND" as const,
          severity: "WARNING" as const,
          periodType: "MONTHLY" as const,
          fingerprint: `market-opportunity:${asset.symbol}:high:${mk}:${stats.lookbackLabel}`,
          title: `${asset.symbol}: ${stats.lookbackLabel} banda göre yüksek bölge`,
          message: appendDisclaimer(
            `${asset.name} ${stats.lookbackLabel} penceresinde bandın üst bölgesinde (güncel ${stats.current.toLocaleString(
              "tr-TR",
              { maximumFractionDigits: 2 }
            )}, zirve ${stats.high.toLocaleString("tr-TR", {
              maximumFractionDigits: 2,
            })}). Bu bir satış tavsiyesi değildir.`
          ),
          metadata: {
            symbol: asset.symbol,
            signal: "NEAR_HIGH",
            rangePosition: stats.rangePosition,
            lookbackLabel: stats.lookbackLabel,
            realizedVol: stats.realizedVol,
          },
        });
      }
    }

    return insights.slice(0, 6);
  },
};
