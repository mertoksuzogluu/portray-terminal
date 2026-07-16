import { startOfMonth } from "date-fns";
import { formatPercent } from "@/lib/format/tr";
import type { GeneratedInsight, InsightRule, PortfolioAnalysisContext } from "../types";
import {
  appendDisclaimer,
  monthKey,
  snapshotsInRange,
  twrReturnForSnapshots,
} from "./helpers";

export const monthlyPerformanceRule: InsightRule = {
  ruleId: "monthly-performance",

  evaluate(context: PortfolioAnalysisContext): GeneratedInsight[] {
    const monthStart = startOfMonth(context.asOf);
    const monthSnaps = snapshotsInRange(
      context.snapshots,
      monthStart,
      context.asOf
    );

    if (monthSnaps.length < 2) {
      return [
        {
          category: "PERFORMANCE",
          severity: "INFO",
          title: "Aylık performans",
          message:
            "Bu ay için yeterli günlük veri bulunmuyor; aylık getiri hesaplanamadı.",
          fingerprint: `monthly-performance:${monthKey(context.asOf)}:insufficient`,
          periodType: "MONTHLY",
          metadata: { observationCount: monthSnaps.length },
        },
      ];
    }

    const monthReturn = twrReturnForSnapshots(monthSnaps);
    if (monthReturn === null) {
      return [
        {
          category: "PERFORMANCE",
          severity: "INFO",
          title: "Aylık performans",
          message:
            "Bu ay için getiri hesaplanamadı; nakit akışları veya başlangıç değeri eksik olabilir.",
          fingerprint: `monthly-performance:${monthKey(context.asOf)}:null`,
          periodType: "MONTHLY",
        },
      ];
    }

    const pct = formatPercent(monthReturn);
    const severity = monthReturn.gt(0)
      ? "POSITIVE"
      : monthReturn.lt(0)
        ? "WARNING"
        : "INFO";

    return [
      {
        category: "PERFORMANCE",
        severity,
        title: "Bu ayki getiri",
        message: appendDisclaimer(
          `Portföyünüz bu ay ${pct} getiri sağladı.`
        ),
        fingerprint: `monthly-performance:${monthKey(context.asOf)}`,
        periodType: "MONTHLY",
        metadata: {
          monthReturn: monthReturn.toString(),
          observationCount: monthSnaps.length,
        },
      },
    ];
  },
};
