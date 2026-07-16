import { subDays } from "date-fns";
import { annualizedVolatility, standardDeviation } from "@/lib/calculations/risk";
import { formatPercentPlain } from "@/lib/format/tr";
import type { GeneratedInsight, InsightRule, PortfolioAnalysisContext } from "../types";
import { appendDisclaimer, monthKey, snapshotsInRange } from "./helpers";

const RECENT_WINDOW = 14;
const PRIOR_WINDOW = 14;
const MIN_OBS = 5;

export const volatilityTrendRule: InsightRule = {
  ruleId: "volatility-trend",

  evaluate(context: PortfolioAnalysisContext): GeneratedInsight[] {
    const priorEnd = subDays(context.asOf, RECENT_WINDOW);
    const priorStart = subDays(priorEnd, PRIOR_WINDOW);
    const recentStart = subDays(context.asOf, RECENT_WINDOW);

    const recentSnaps = snapshotsInRange(
      context.snapshots,
      recentStart,
      context.asOf
    );
    const priorSnaps = snapshotsInRange(
      context.snapshots,
      priorStart,
      priorEnd
    );

    const recentReturns = recentSnaps
      .map((s) => s.dailyReturn)
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const priorReturns = priorSnaps
      .map((s) => s.dailyReturn)
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (recentReturns.length < MIN_OBS || priorReturns.length < MIN_OBS) {
      return [
        {
          category: "RISK",
          severity: "INFO",
          title: "Volatilite trendi",
          message: `Volatilite karşılaştırması için yeterli günlük getiri verisi yok (her pencere için en az ${MIN_OBS} gün gerekli).`,
          fingerprint: `volatility-trend:${monthKey(context.asOf)}:insufficient`,
          periodType: "WEEKLY",
          metadata: {
            recentCount: recentReturns.length,
            priorCount: priorReturns.length,
          },
        },
      ];
    }

    const recentVol = standardDeviation(recentReturns);
    const priorVol = standardDeviation(priorReturns);

    if (recentVol === null || priorVol === null || priorVol.isZero()) {
      return [
        {
          category: "RISK",
          severity: "INFO",
          title: "Volatilite trendi",
          message: "Volatilite trendi hesaplanamadı.",
          fingerprint: `volatility-trend:${monthKey(context.asOf)}:null`,
          periodType: "WEEKLY",
        },
      ];
    }

    const change = recentVol.minus(priorVol).div(priorVol);
    const rising = change.gt(0.15);
    const falling = change.lt(-0.15);
    const recentAnn = annualizedVolatility(recentReturns);
    const priorAnn = annualizedVolatility(priorReturns);

    let severity: GeneratedInsight["severity"] = "INFO";
    if (rising) severity = "WARNING";
    else if (falling) severity = "POSITIVE";

    return [
      {
        category: "RISK",
        severity,
        title: "Volatilite trendi",
        message: appendDisclaimer(
          `Son ${RECENT_WINDOW} günlük günlük volatilite ${recentAnn ? formatPercentPlain(recentAnn) : "—"}, önceki ${PRIOR_WINDOW} gün ${priorAnn ? formatPercentPlain(priorAnn) : "—"}. Volatilite ${rising ? "artış eğiliminde" : falling ? "azalış eğiliminde" : "nispeten stabil"}.`
        ),
        fingerprint: `volatility-trend:${monthKey(context.asOf)}`,
        periodType: "WEEKLY",
        metadata: {
          recentDailyVol: recentVol.toString(),
          priorDailyVol: priorVol.toString(),
          changeRatio: change.toString(),
          recentAnnualized: recentAnn?.toString() ?? null,
          priorAnnualized: priorAnn?.toString() ?? null,
        },
      },
    ];
  },
};
