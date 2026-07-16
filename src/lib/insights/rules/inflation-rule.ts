import { formatPercent, formatSignedMoney } from "@/lib/format/tr";
import type { GeneratedInsight, InsightRule, PortfolioAnalysisContext } from "../types";
import { appendDisclaimer, monthKey } from "./helpers";

export const inflationRule: InsightRule = {
  ruleId: "inflation",

  evaluate(context: PortfolioAnalysisContext): GeneratedInsight[] {
    const latest = context.snapshots.at(-1);

    if (!latest) {
      return [
        {
          category: "INFLATION",
          severity: "INFO",
          title: "Reel getiri",
          message: "Portföy snapshot verisi bulunamadı; reel getiri hesaplanamadı.",
          fingerprint: `inflation:${monthKey(context.asOf)}:no-snapshot`,
          periodType: "MONTHLY",
        },
      ];
    }

    if (context.inflationSeries.length === 0) {
      return [
        {
          category: "INFLATION",
          severity: "INFO",
          title: "Reel getiri",
          message:
            "TÜFE endeks verisi bulunamadı; enflasyona göre düzeltilmiş getiri hesaplanamadı.",
          fingerprint: `inflation:${monthKey(context.asOf)}:no-inflation-data`,
          periodType: "MONTHLY",
        },
      ];
    }

    const realReturn = latest.realReturn;
    const nominalReturn = latest.cumulativeReturn;
    const realProfit = latest.realProfitLoss;

    if (realReturn === null) {
      return [
        {
          category: "INFLATION",
          severity: "INFO",
          title: "Reel getiri",
          message:
            "Enflasyona göre düzeltilmiş getiri hesaplanamadı; yeterli katkı veya endeks verisi olmayabilir.",
          fingerprint: `inflation:${monthKey(context.asOf)}:null`,
          periodType: "MONTHLY",
        },
      ];
    }

    const beatsInflation = realReturn.gt(0);
    const severity = beatsInflation
      ? "POSITIVE"
      : realReturn.lt(0)
        ? "WARNING"
        : "INFO";

    const nominalText =
      nominalReturn !== null
        ? ` Nominal kümülatif getiriniz ${formatPercent(nominalReturn)}.`
        : "";

    const profitText =
      realProfit !== null
        ? ` Reel kâr/zarar: ${formatSignedMoney(realProfit)}.`
        : "";

    return [
      {
        category: "INFLATION",
        severity,
        title: "Enflasyona göre reel getiri",
        message: appendDisclaimer(
          `Enflasyona göre düzeltilmiş kümülatif reel getiriniz ${formatPercent(realReturn)}.${nominalText}${profitText} ${beatsInflation ? "Satın alma gücünüz artmış görünüyor." : realReturn.lt(0) ? "Satın alma gücünüz azalmış görünüyor." : "Satın alma gücünüzde anlamlı bir değişim görünmüyor."}`
        ),
        fingerprint: `inflation:${monthKey(context.asOf)}`,
        periodType: "MONTHLY",
        metadata: {
          realReturn: realReturn.toString(),
          nominalReturn: nominalReturn?.toString() ?? null,
          realProfitLoss: realProfit?.toString() ?? null,
        },
      },
    ];
  },
};
