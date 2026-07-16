import { concentrationAnalysis } from "@/lib/calculations/risk";
import { formatPercentPlain } from "@/lib/format/tr";
import type { GeneratedInsight, InsightRule, PortfolioAnalysisContext } from "../types";
import { appendDisclaimer, monthKey } from "./helpers";

const HIGH_CONCENTRATION = 0.4;
const MODERATE_CONCENTRATION = 0.25;

export const concentrationRule: InsightRule = {
  ruleId: "concentration",

  evaluate(context: PortfolioAnalysisContext): GeneratedInsight[] {
    const latestDate = context.asOf.getTime();
    const latestPositions = context.positionSnapshots.filter(
      (p) => p.snapshotDate.getTime() === latestDate
    );

    if (latestPositions.length === 0) {
      const fallback = context.positionSnapshots.filter(
        (p) => p.snapshotDate.getTime() <= latestDate
      );
      if (fallback.length === 0) {
        return [
          {
            category: "CONCENTRATION",
            severity: "INFO",
            title: "Yoğunlaşma",
            message: "Pozisyon verisi bulunamadı; yoğunlaşma analizi yapılamadı.",
            fingerprint: `concentration:${monthKey(context.asOf)}:empty`,
            periodType: "DAILY",
          },
        ];
      }
    }

    const positions =
      latestPositions.length > 0
        ? latestPositions
        : context.positionSnapshots.filter((p) => {
            const maxDate = Math.max(
              ...context.positionSnapshots.map((x) => x.snapshotDate.getTime())
            );
            return p.snapshotDate.getTime() === maxDate;
          });

    const analysis = concentrationAnalysis(
      positions.map((p) => ({
        assetId: p.assetId,
        marketValue: p.marketValue,
      }))
    );

    if (!analysis.largestWeight || analysis.weights.length === 0) {
      return [
        {
          category: "CONCENTRATION",
          severity: "INFO",
          title: "Yoğunlaşma",
          message: "Portföy değeri sıfır veya pozisyon bulunamadı.",
          fingerprint: `concentration:${monthKey(context.asOf)}:zero`,
          periodType: "DAILY",
        },
      ];
    }

    const top = analysis.weights[0];
    const topPosition = positions.find((p) => p.assetId === top.assetId);
    const topSymbol = topPosition?.symbol ?? top.assetId;
    const top3 = analysis.top3Weight;
    const weightRatio = analysis.largestWeight;

    let severity: GeneratedInsight["severity"] = "INFO";
    if (weightRatio.gte(HIGH_CONCENTRATION)) {
      severity = "WARNING";
    } else if (weightRatio.gte(MODERATE_CONCENTRATION)) {
      severity = "INFO";
    } else {
      severity = "POSITIVE";
    }

    const top3Text =
      top3 !== null && analysis.weights.length >= 3
        ? ` İlk 3 varlık toplam ağırlığı ${formatPercentPlain(top3)}.`
        : "";

    return [
      {
        category: "CONCENTRATION",
        severity,
        title: "Portföy yoğunlaşması",
        message: appendDisclaimer(
          `En büyük pozisyonunuz ${topSymbol} portföyün ${formatPercentPlain(weightRatio)}'ini oluşturuyor.${top3Text} ${weightRatio.gte(HIGH_CONCENTRATION) ? "Portföy tek bir varlıkta yüksek yoğunlaşma gösteriyor." : weightRatio.gte(MODERATE_CONCENTRATION) ? "Orta düzeyde yoğunlaşma mevcut." : "Dağılım nispeten dengeli görünüyor."}`
        ),
        fingerprint: `concentration:${monthKey(context.asOf)}`,
        periodType: "DAILY",
        metadata: {
          largestAssetId: top.assetId,
          largestSymbol: topSymbol,
          largestWeight: weightRatio.toString(),
          top3Weight: top3?.toString() ?? null,
          hhi: analysis.herfindahlHirschmanIndex?.toString() ?? null,
          positionCount: analysis.weights.length,
        },
      },
    ];
  },
};
