import { subDays } from "date-fns";
import { analyzeContributions } from "@/lib/calculations/contribution";
import { formatPercent } from "@/lib/format/tr";
import type { GeneratedInsight, InsightRule, PortfolioAnalysisContext } from "../types";
import { appendDisclaimer, monthKey, snapshotsInRange } from "./helpers";

const LOOKBACK_DAYS = 7;

export const contributionRule: InsightRule = {
  ruleId: "contribution",

  evaluate(context: PortfolioAnalysisContext): GeneratedInsight[] {
    const start = subDays(context.asOf, LOOKBACK_DAYS);
    const rangeSnaps = snapshotsInRange(context.snapshots, start, context.asOf);

    if (rangeSnaps.length < 2) {
      return [
        {
          category: "CONTRIBUTION",
          severity: "INFO",
          title: "Getiri katkısı",
          message: `Son ${LOOKBACK_DAYS} gün için yeterli veri yok; varlık katkı analizi yapılamadı.`,
          fingerprint: `contribution:${monthKey(context.asOf)}:insufficient`,
          periodType: "WEEKLY",
        },
      ];
    }

    const latestPositions = context.positionSnapshots.filter(
      (p) =>
        p.snapshotDate.getTime() ===
        Math.max(...context.positionSnapshots.map((x) => x.snapshotDate.getTime()))
    );

    if (latestPositions.length === 0) {
      return [
        {
          category: "CONTRIBUTION",
          severity: "INFO",
          title: "Getiri katkısı",
          message: "Pozisyon verisi bulunamadı.",
          fingerprint: `contribution:${monthKey(context.asOf)}:no-positions`,
          periodType: "WEEKLY",
        },
      ];
    }

    const periodReturn =
      rangeSnaps.at(-1)!.totalMarketValue
        .minus(rangeSnaps[0]!.totalMarketValue)
        .div(rangeSnaps[0]!.totalMarketValue);

    const cumulativeReturn = context.snapshots.at(-1)?.cumulativeReturn ?? null;

    const inputs = latestPositions
      .filter((p) => p.dailyReturn !== null && p.portfolioWeight !== null)
      .map((p) => ({
        assetId: p.assetId,
        symbol: p.symbol,
        weight: p.portfolioWeight!,
        assetReturn: p.dailyReturn!,
        profitLoss: p.dailyProfitLoss,
      }));

    if (inputs.length === 0) {
      return [
        {
          category: "CONTRIBUTION",
          severity: "INFO",
          title: "Getiri katkısı",
          message: "Varlık bazında günlük getiri verisi eksik; katkı analizi yapılamadı.",
          fingerprint: `contribution:${monthKey(context.asOf)}:no-returns`,
          periodType: "WEEKLY",
        },
      ];
    }

    const analysis = analyzeContributions(inputs);
    const top = analysis.topContributor;
    const worst = analysis.worstContributor;

    if (!top) {
      return [];
    }

    const cumText =
      cumulativeReturn != null
        ? ` Yatırılan sermayeye göre kümülatif getiri ${formatPercent(cumulativeReturn)}.`
        : "";

    const insights: GeneratedInsight[] = [
      {
        category: "CONTRIBUTION",
        severity: top.contributionPoints.gt(0) ? "POSITIVE" : "INFO",
        title: "En yüksek katkı",
        message: appendDisclaimer(
          `Bugünkü getiriye en yüksek katkıyı ${top.symbol} sağladı (ağırlık ${formatPercent(top.weight)}, günlük getiri ${formatPercent(top.assetReturn)}). Son ${LOOKBACK_DAYS} günlük değer değişimi ${formatPercent(periodReturn)}.${cumText}`
        ),
        fingerprint: `contribution:top:${monthKey(context.asOf)}`,
        periodType: "WEEKLY",
        metadata: {
          topAssetId: top.assetId,
          topSymbol: top.symbol,
          contributionPoints: top.contributionPoints.toString(),
          lookbackDays: LOOKBACK_DAYS,
          periodReturn: periodReturn.toString(),
          cumulativeReturn: cumulativeReturn?.toString() ?? null,
        },
      },
    ];

    if (
      worst &&
      worst.assetId !== top.assetId &&
      worst.contributionPoints.lt(0)
    ) {
      insights.push({
        category: "CONTRIBUTION",
        severity: "WARNING",
        title: "En düşük katkı",
        message: appendDisclaimer(
          `${worst.symbol} bugünkü portföy getirisine olumsuz katkı sağladı (${formatPercent(worst.contributionPoints)} etki).`
        ),
        fingerprint: `contribution:worst:${monthKey(context.asOf)}`,
        periodType: "WEEKLY",
        metadata: {
          worstAssetId: worst.assetId,
          worstSymbol: worst.symbol,
          contributionPoints: worst.contributionPoints.toString(),
        },
      });
    }

    return insights;
  },
};
