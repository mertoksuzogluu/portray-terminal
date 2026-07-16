import { subDays } from "date-fns";
import { formatPercent } from "@/lib/format/tr";
import type { GeneratedInsight, InsightRule, PortfolioAnalysisContext } from "../types";
import {
  appendDisclaimer,
  monthKey,
  snapshotsInRange,
  twrReturnForSnapshots,
} from "./helpers";

const COMPARE_DAYS = 30;

export const benchmarkOutperformanceRule: InsightRule = {
  ruleId: "benchmark-outperformance",

  evaluate(context: PortfolioAnalysisContext): GeneratedInsight[] {
    const preferred =
      context.benchmarks.find(
        (b) => b.symbol === context.preferredBenchmarkSymbol
      ) ?? context.benchmarks[0];

    if (!preferred) {
      return [
        {
          category: "BENCHMARK",
          severity: "INFO",
          title: "Kıyas endeksi",
          message:
            "Karşılaştırma için tanımlı bir kıyas endeksi bulunamadı.",
          fingerprint: `benchmark-outperformance:${monthKey(context.asOf)}:no-benchmark`,
          periodType: "MONTHLY",
        },
      ];
    }

    const start = subDays(context.asOf, COMPARE_DAYS);
    const portfolioSnaps = snapshotsInRange(
      context.snapshots,
      start,
      context.asOf
    );

    if (portfolioSnaps.length < 2) {
      return [
        {
          category: "BENCHMARK",
          severity: "INFO",
          title: "Endeks karşılaştırması",
          message: `Son ${COMPARE_DAYS} gün için portföy verisi yetersiz; ${preferred.name} ile karşılaştırma yapılamadı.`,
          fingerprint: `benchmark-outperformance:${preferred.symbol}:${monthKey(context.asOf)}:insufficient`,
          periodType: "MONTHLY",
        },
      ];
    }

    const portfolioReturn = twrReturnForSnapshots(portfolioSnaps);
    const benchPrices = preferred.prices.filter(
      (p) => p.date.getTime() >= start.getTime() && p.date.getTime() <= context.asOf.getTime()
    );

    if (benchPrices.length < 2 || portfolioReturn === null) {
      return [
        {
          category: "BENCHMARK",
          severity: "INFO",
          title: "Endeks karşılaştırması",
          message: `${preferred.name} için yeterli fiyat verisi yok veya portföy getirisi hesaplanamadı.`,
          fingerprint: `benchmark-outperformance:${preferred.symbol}:${monthKey(context.asOf)}:null`,
          periodType: "MONTHLY",
        },
      ];
    }

    const benchStart = benchPrices[0].value;
    const benchEnd = benchPrices[benchPrices.length - 1].value;
    const benchReturn = benchEnd.minus(benchStart).div(benchStart);
    const alpha = portfolioReturn.minus(benchReturn);
    const outperformed = alpha.gt(0);

    const severity = outperformed
      ? "POSITIVE"
      : alpha.lt(0)
        ? "WARNING"
        : "INFO";

    return [
      {
        category: "BENCHMARK",
        severity,
        title: `${preferred.name} karşılaştırması`,
        message: appendDisclaimer(
          `Son ${COMPARE_DAYS} günde portföyünüz ${formatPercent(portfolioReturn)}, ${preferred.symbol} ${formatPercent(benchReturn)} getirdi. Fark ${formatPercent(alpha)} — portföy endeksin ${outperformed ? "üzerinde" : alpha.lt(0) ? "altında" : "eşit seviyesinde"} performans gösterdi.`
        ),
        fingerprint: `benchmark-outperformance:${preferred.symbol}:${monthKey(context.asOf)}`,
        periodType: "MONTHLY",
        metadata: {
          benchmarkSymbol: preferred.symbol,
          portfolioReturn: portfolioReturn.toString(),
          benchmarkReturn: benchReturn.toString(),
          alpha: alpha.toString(),
          lookbackDays: COMPARE_DAYS,
        },
      },
    ];
  },
};
