import { formatPercent } from "@/lib/format/tr";
import type { GeneratedInsight, InsightRule, PortfolioAnalysisContext } from "../types";
import { appendDisclaimer, lastNMonthlyReturnStats, monthKey } from "./helpers";

const LOOKBACK_MONTHS = 5;

export const rollingAverageRule: InsightRule = {
  ruleId: "rolling-average",

  evaluate(context: PortfolioAnalysisContext): GeneratedInsight[] {
    const { monthly, stats } = lastNMonthlyReturnStats(
      context.snapshots,
      LOOKBACK_MONTHS,
      context.asOf
    );

    const currentMonth = monthly.at(-1);
    const currentReturn = currentMonth?.return ?? null;

    if (stats.monthCount < 2) {
      return [
        {
          category: "TREND",
          severity: "INFO",
          title: "Hareketli ortalama",
          message: `Son ${LOOKBACK_MONTHS} ay için yeterli aylık veri yok; hareketli ortalama karşılaştırması yapılamadı.`,
          fingerprint: `rolling-average:${monthKey(context.asOf)}:insufficient`,
          periodType: "MONTHLY",
          metadata: { monthCount: stats.monthCount },
        },
      ];
    }

    const arithmetic = stats.arithmeticMonthlyAverage;
    const geometric = stats.geometricMonthlyAverage;

    if (currentReturn === null || arithmetic === null) {
      return [
        {
          category: "TREND",
          severity: "INFO",
          title: "Hareketli ortalama",
          message:
            "Bu ayın getirisi veya son ayların ortalaması hesaplanamadı.",
          fingerprint: `rolling-average:${monthKey(context.asOf)}:null`,
          periodType: "MONTHLY",
        },
      ];
    }

    const diff = currentReturn.minus(arithmetic);
    const aboveAverage = diff.gt(0);
    const severity = aboveAverage ? "POSITIVE" : diff.lt(0) ? "WARNING" : "INFO";

    const geoText =
      geometric !== null
        ? ` geometrik ortalama ${formatPercent(geometric)}`
        : "";

    return [
      {
        category: "TREND",
        severity,
        title: "Aylık ortalama karşılaştırması",
        message: appendDisclaimer(
          `Bu ay ${formatPercent(currentReturn)} getiri elde ettiniz; son ${stats.monthCount} ayın aritmetik ortalaması ${formatPercent(arithmetic)}${geoText}. Bu ay ortalamanın ${aboveAverage ? "üzerinde" : diff.lt(0) ? "altında" : "eşit seviyesinde"}.`
        ),
        fingerprint: `rolling-average:${monthKey(context.asOf)}`,
        periodType: "MONTHLY",
        metadata: {
          currentReturn: currentReturn.toString(),
          arithmeticAverage: arithmetic.toString(),
          geometricAverage: geometric?.toString() ?? null,
          monthCount: stats.monthCount,
        },
      },
    ];
  },
};
